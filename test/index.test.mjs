import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(new URL("../src/index.mjs", import.meta.url).pathname).href;

async function withGenerateConfig({ nodeEnv, reactEnv, existingPaths }, run) {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalReactEnv = process.env.REACT_ENV;
  const originalExistsSync = fs.existsSync;

  process.env.NODE_ENV = nodeEnv;
  process.env.REACT_ENV = reactEnv;
  fs.existsSync = (filePath) => existingPaths.includes(filePath);

  try {
    const { default: generateConfig } = await import(`${moduleUrl}?case=${Math.random()}`);
    return await run(generateConfig);
  } finally {
    fs.existsSync = originalExistsSync;

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalReactEnv === undefined) {
      delete process.env.REACT_ENV;
    } else {
      process.env.REACT_ENV = originalReactEnv;
    }
  }
}

function getConfigByOutput(configs, file) {
  return configs.find((config) => config.output?.some((entry) => entry.file === file));
}

test("generateConfig creates UMD, module, and style outputs when sources exist", { concurrency: false }, async () => {
  const configs = await withGenerateConfig(
    {
      nodeEnv: "development",
      reactEnv: "react",
      existingPaths: ["src/main.ts", "src/style.ts"],
    },
    async (generateConfig) =>
      generateConfig({
        name: "@scope/button-group",
        version: "1.2.3",
        author: "Test Author",
        dependencies: {
          lodash: "^1.0.0",
        },
      }),
  );

  assert.equal(configs.length, 4);

  const umdConfig = getConfigByOutput(configs, "dist/index.umd.js");
  const cjsConfig = getConfigByOutput(configs, "dist/index.cjs");
  const esmConfig = getConfigByOutput(configs, "dist/index.mjs");
  const styleConfig = getConfigByOutput(configs, "dist/style/css.js");
  const dtsConfig = getConfigByOutput(configs, "dist/types/index.d.ts");

  assert.ok(umdConfig);
  assert.ok(cjsConfig);
  assert.ok(esmConfig);
  assert.ok(styleConfig);
  assert.equal(dtsConfig, undefined);

  assert.deepEqual(umdConfig.external, ["react/jsx-runtime", "react", "clsx"]);
  assert.deepEqual(cjsConfig.external, ["react/jsx-runtime", "react", "clsx", "lodash"]);
  assert.equal(umdConfig.output[0].name, "ButtonGroup");
  assert.deepEqual(umdConfig.output[0].globals, {
    react: "React",
    clsx: "clsx",
  });
  assert.equal(umdConfig.output[0].sourcemap, true);
  assert.equal(esmConfig.output[0].format, "esm");
  assert.equal(
    styleConfig.plugins.some((plugin) => plugin.name === "inject-css-require"),
    true,
  );

  const aliasPlugin = cjsConfig.plugins.find((plugin) => plugin.name === "alias");
  assert.ok(aliasPlugin);
  assert.equal(aliasPlugin.name, "alias");
});

test("generateConfig skips UMD and style builds in production when source files are absent", { concurrency: false }, async () => {
  const configs = await withGenerateConfig(
    {
      nodeEnv: "production",
      reactEnv: "",
      existingPaths: [],
    },
    async (generateConfig) =>
      generateConfig({
        name: "plain-package",
        version: "0.0.1",
        author: "Test Author",
        dependencies: {
          vue: "^3.0.0",
        },
      }),
  );

  assert.equal(configs.length, 2);
  assert.equal(getConfigByOutput(configs, "dist/index.umd.js"), undefined);
  assert.equal(getConfigByOutput(configs, "dist/style/css.js"), undefined);

  const cjsConfig = getConfigByOutput(configs, "dist/index.cjs");
  const esmConfig = getConfigByOutput(configs, "dist/index.mjs");
  const dtsConfig = getConfigByOutput(configs, "dist/types/index.d.ts");

  assert.ok(cjsConfig);
  assert.ok(esmConfig);
  assert.equal(dtsConfig, undefined);
  assert.equal(cjsConfig.output[0].sourcemap, false);
  assert.equal(esmConfig.output[0].sourcemap, false);
  assert.deepEqual(cjsConfig.external, ["react/jsx-runtime", "react", "clsx", "vue"]);
  assert.equal(
    cjsConfig.plugins.some((plugin) => plugin.name === "serve"),
    false,
  );
});

test("generateConfig supports custom input, output, and exportName", { concurrency: false }, async () => {
  const configs = await withGenerateConfig(
    {
      nodeEnv: "development",
      reactEnv: "react",
      existingPaths: ["src/custom-umd.ts", "src/custom-style.ts"],
    },
    async (generateConfig) =>
      generateConfig(
        {
          name: "@scope/custom-lib",
          version: "2.0.0",
          author: "Test Author",
          dependencies: {
            lodash: "^1.0.0",
          },
          main: "build/custom.cjs",
          module: "build/custom.mjs",
          types: "build/types.d.ts",
          umdOut: "build/custom.umd.js",
          styleOut: "build/style.cjs",
          input: "src/custom-entry.ts",
          umdInput: "src/custom-umd.ts",
          styleInput: "src/custom-style.ts",
          exportName: "CustomGlobal",
        },
        [],
      ),
  );

  assert.equal(configs.length, 5);

  const cjsConfig = getConfigByOutput(configs, "build/custom.cjs");
  const esmConfig = getConfigByOutput(configs, "build/custom.mjs");
  const umdConfig = getConfigByOutput(configs, "build/custom.umd.js");
  const styleConfig = getConfigByOutput(configs, "build/style.cjs");
  const dtsConfig = getConfigByOutput(configs, "build/types.d.ts");

  assert.ok(cjsConfig);
  assert.equal(cjsConfig.input, "src/custom-entry.ts");
  assert.equal(cjsConfig.output[0].format, "cjs");

  assert.ok(esmConfig);
  assert.equal(esmConfig.input, "src/custom-entry.ts");

  assert.ok(umdConfig);
  assert.equal(umdConfig.input, "src/custom-umd.ts");
  assert.equal(umdConfig.output[0].name, "CustomGlobal");

  assert.ok(styleConfig);
  assert.equal(styleConfig.input, "src/custom-style.ts");

  assert.ok(dtsConfig);
  assert.equal(dtsConfig.input, "src/custom-entry.ts");
});

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rollup } from "rollup";
import generateConfig from "../src/index.mjs";

const require = createRequire(import.meta.url);
const fixturesRoot = fileURLToPath(new URL("./fixtures/", import.meta.url));

/** @param {string} name @param {...string} segments */
function fixturePath(name, ...segments) {
  return path.join(fixturesRoot, name, ...segments);
}

/**
 * 以指定 fixture 目录为工作目录执行一次完整构建。
 *
 * generateConfig 内部依赖 process.cwd() 解析别名与 copy 插件路径，
 * 因此构建期间必须把工作目录切换到 fixture 根目录。
 *
 * @param {{ name: string, pkg: object, nodeEnv?: string, reactEnv?: string }} options
 * @returns {Promise<void>}
 */
async function buildFixture({ name, pkg, nodeEnv = "production", reactEnv }) {
  const dir = fixturePath(name);
  const previousCwd = process.cwd();

  fs.rmSync(path.join(dir, "dist"), { recursive: true, force: true });
  process.chdir(dir);
  process.env.NODE_ENV = nodeEnv;

  if (reactEnv === undefined) {
    delete process.env.REACT_ENV;
  } else {
    process.env.REACT_ENV = reactEnv;
  }

  try {
    const configs = generateConfig(pkg, []).filter(Boolean);

    for (const config of configs) {
      const { output, ...inputOptions } = config;
      const bundle = await rollup(inputOptions);
      try {
        for (const out of output) {
          await bundle.write(out);
        }
      } finally {
        await bundle.close();
      }
    }
  } finally {
    process.chdir(previousCwd);
  }
}

/** @param {string} name */
function cleanFixture(name) {
  fs.rmSync(path.join(fixturePath(name), "dist"), { recursive: true, force: true });
}

describe("swc compiler build", () => {
  const pkg = {
    name: "@skax/fixture-basic",
    version: "1.2.3",
    author: "Test Author",
    main: "dist/index.cjs",
    module: "dist/index.mjs",
    types: "dist/types/index.d.ts",
    umdOut: "dist/index.umd.js",
    styleOut: "dist/style/css.js",
    input: "src/index.ts",
    umdInput: "src/main.ts",
    styleInput: "src/style.ts",
  };

  let cjsModule;

  before(
    async () => {
      await buildFixture({ name: "basic", pkg });
      cjsModule = require(fixturePath("basic", "dist", "index.cjs"));
    },
    { timeout: 120000 },
  );

  after(() => cleanFixture("basic"));

  test("emits all expected output files", () => {
    const files = ["dist/index.cjs", "dist/index.mjs", "dist/index.umd.js", "dist/types/index.d.ts", "dist/style/css.js", "dist/style/css.css"];

    for (const file of files) {
      assert.ok(fs.existsSync(fixturePath("basic", file)), `expected ${file} to exist`);
    }
  });

  test("inlines the resolved version and removes the placeholder", () => {
    const code = fs.readFileSync(fixturePath("basic", "dist", "index.cjs"), "utf8");
    assert.match(code, /1\.2\.3/);
    assert.doesNotMatch(code, /__VERSION__/);
  });

  test("keeps the license banner in the bundle", () => {
    const code = fs.readFileSync(fixturePath("basic", "dist", "index.cjs"), "utf8");
    assert.match(code, /@skax\/fixture-basic v1\.2\.3/);
    assert.match(code, /Copyright \(c\)/);
  });

  test("declares exported members in the dts output", () => {
    const dts = fs.readFileSync(fixturePath("basic", "dist", "types", "index.d.ts"), "utf8");
    assert.match(dts, /greet/);
    assert.match(dts, /add/);
    assert.match(dts, /export/);
  });

  test("appends the css require to the style entry", () => {
    const styleJs = fs.readFileSync(fixturePath("basic", "dist", "style", "css.js"), "utf8");
    assert.match(styleJs, /require\("\.\/css\.css"\)/);
  });

  test("extracts and compiles sass into the css output", () => {
    const css = fs.readFileSync(fixturePath("basic", "dist", "style", "css.css"), "utf8");
    assert.match(css, /\.demo/);
    assert.match(css, /color\s*:/);
  });

  test("copies the raw style sources into dist/style", () => {
    assert.ok(fs.existsSync(fixturePath("basic", "dist", "style", "style.scss")));
    assert.ok(fs.existsSync(fixturePath("basic", "dist", "style", "index.js")));
  });

  test("cjs bundle executes correctly", () => {
    assert.equal(typeof cjsModule.greet, "function");
    assert.equal(typeof cjsModule.add, "function");
    assert.equal(cjsModule.add(1, 2), 3);
    assert.equal(cjsModule.greet("World"), "Hello, World!");
    assert.equal(cjsModule.VERSION, "1.2.3");
  });

  test("esm bundle executes correctly", async () => {
    const mod = await import(pathToFileURL(fixturePath("basic", "dist", "index.mjs")).href);
    assert.equal(mod.add(2, 5), 7);
    assert.equal(mod.greet("ESM"), "Hello, ESM!");
    assert.equal(mod.VERSION, "1.2.3");
  });

  test("umd bundle executes correctly", () => {
    const mod = require(fixturePath("basic", "dist", "index.umd.js"));
    assert.equal(typeof mod.greet, "function");
    assert.equal(mod.add(3, 4), 7);
    assert.equal(mod.greet("UMD"), "Hello, UMD!");
  });
});

describe("tsc compiler build", () => {
  const pkg = {
    name: "@skax/fixture-tsc",
    version: "2.5.0",
    author: "Test Author",
    compiler: "tsc",
    main: "dist/index.cjs",
    module: "dist/index.mjs",
    umdOut: "dist/index.umd.js",
    input: "src/index.ts",
    umdInput: "src/main.ts",
  };

  let cjsModule;

  before(
    async () => {
      await buildFixture({ name: "tsc", pkg });
      cjsModule = require(fixturePath("tsc", "dist", "index.cjs"));
    },
    { timeout: 120000 },
  );

  after(() => cleanFixture("tsc"));

  test("emits cjs, esm and umd artifacts but no dts when types is absent", () => {
    assert.ok(fs.existsSync(fixturePath("tsc", "dist", "index.cjs")));
    assert.ok(fs.existsSync(fixturePath("tsc", "dist", "index.mjs")));
    assert.ok(fs.existsSync(fixturePath("tsc", "dist", "index.umd.js")));
    assert.equal(fs.existsSync(fixturePath("tsc", "dist", "types", "index.d.ts")), false);
  });

  test("inlines the resolved version and removes the placeholder", () => {
    const code = fs.readFileSync(fixturePath("tsc", "dist", "index.cjs"), "utf8");
    assert.match(code, /2\.5\.0/);
    assert.doesNotMatch(code, /__VERSION__/);
  });

  test("cjs bundle executes correctly", () => {
    assert.equal(cjsModule.add(10, 20), 30);
    assert.equal(cjsModule.greet("TSC"), "Hello, TSC!");
    assert.equal(cjsModule.VERSION, "2.5.0");
  });

  test("esm bundle executes correctly", async () => {
    const mod = await import(pathToFileURL(fixturePath("tsc", "dist", "index.mjs")).href);
    assert.equal(mod.add(4, 6), 10);
    assert.equal(mod.greet("ESM"), "Hello, ESM!");
    assert.equal(mod.VERSION, "2.5.0");
  });

  test("umd bundle executes correctly", () => {
    const mod = require(fixturePath("tsc", "dist", "index.umd.js"));
    assert.equal(typeof mod.greet, "function");
    assert.equal(mod.greet("UMD"), "Hello, UMD!");
  });
});

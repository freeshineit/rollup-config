import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createDefaultConfigs, formatDate, getDefaultExportName, getOutputFiles } from "../src/util.mjs";

/**
 * mock fs.existsSync，仅对 existingPaths 中的路径返回 true。
 * @param {string[]} existingPaths
 * @param {() => *} run
 * @returns {*}
 */
function withExistsSync(existingPaths, run) {
  const original = fs.existsSync;
  fs.existsSync = (filePath) => existingPaths.includes(filePath);
  try {
    return run();
  } finally {
    fs.existsSync = original;
  }
}

const BANNER = "/* demo */";

describe("formatDate", () => {
  test("returns YYYY-MM-DD in UTC for the current time by default", () => {
    const result = formatDate();
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(result, formatDate(new Date()));
  });

  test("formats a Date instance", () => {
    assert.equal(formatDate(new Date("2026-04-30T00:00:00Z")), "2026-04-30");
  });

  test("formats an ISO string", () => {
    assert.equal(formatDate("2026-04-30T00:00:00Z"), "2026-04-30");
  });

  test("formats a numeric timestamp", () => {
    assert.equal(formatDate(Date.UTC(2026, 3, 30)), "2026-04-30");
  });

  test("uses UTC date regardless of local timezone", () => {
    // 2026-05-01T00:30:00+08:00 在 UTC 下仍是 2026-04-30
    // 无论测试机位于哪个时区，都应输出 UTC 日期
    assert.equal(formatDate("2026-05-01T00:30:00+08:00"), "2026-04-30");
  });

  test("falls back to the current UTC date for invalid input", () => {
    const result = formatDate("not-a-valid-date");
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(result, formatDate(new Date()));
  });
});

describe("getDefaultExportName", () => {
  test("converts a scoped package name to PascalCase", () => {
    assert.equal(getDefaultExportName("@scope/button-group"), "ButtonGroup");
  });

  test("converts a plain package name to PascalCase", () => {
    assert.equal(getDefaultExportName("plain-package"), "PlainPackage");
  });

  test("uses the last segment of a multi-segment scoped name", () => {
    assert.equal(getDefaultExportName("@a/b/c"), "C");
  });

  test("returns an empty string for missing or empty names", () => {
    assert.equal(getDefaultExportName(undefined), "");
    assert.equal(getDefaultExportName(""), "");
    assert.equal(getDefaultExportName(null), "");
  });
});

describe("getOutputFiles", () => {
  test("returns default output paths when input is undefined or empty", () => {
    const expected = {
      umd: "dist/index.umd.js",
      cjs: "dist/index.cjs",
      esm: "dist/index.mjs",
      style: "dist/style/css.js",
      types: "dist/types/index.d.ts",
    };
    assert.deepEqual(getOutputFiles(), expected);
    assert.deepEqual(getOutputFiles({}), expected);
  });

  test("overrides only the provided fields", () => {
    assert.deepEqual(getOutputFiles({ main: "build/index.cjs" }), {
      umd: "dist/index.umd.js",
      cjs: "build/index.cjs",
      esm: "dist/index.mjs",
      style: "dist/style/css.js",
      types: "dist/types/index.d.ts",
    });
  });

  test("supports fully custom output paths", () => {
    assert.deepEqual(
      getOutputFiles({
        umdOut: "build/custom.umd.js",
        main: "build/custom.cjs",
        module: "build/custom.mjs",
        styleOut: "build/style.cjs",
        types: "build/types.d.ts",
      }),
      {
        umd: "build/custom.umd.js",
        cjs: "build/custom.cjs",
        esm: "build/custom.mjs",
        style: "build/style.cjs",
        types: "build/types.d.ts",
      },
    );
  });
});

describe("createDefaultConfigs", () => {
  const baseArgs = {
    input: "src/index.ts",
    umdInput: "src/main.ts",
    styleInput: "src/style.ts",
    outputFiles: getOutputFiles(),
    isReact: false,
    isProduction: false,
    banner: BANNER,
    exportName: "Button",
  };

  test("creates umd, cjs, esm and style entries when both sources exist", () => {
    const configs = withExistsSync(["src/main.ts", "src/style.ts"], () => createDefaultConfigs(baseArgs));

    assert.equal(configs.length, 4);

    const [umdConfig, cjsConfig, esmConfig, styleConfig] = configs;

    assert.deepEqual(umdConfig.input, "src/main.ts");
    assert.deepEqual(umdConfig.output[0], {
      file: "dist/index.umd.js",
      format: "umd",
      name: "Button",
      sourcemap: true,
      banner: BANNER,
      globals: {},
    });

    assert.deepEqual(cjsConfig.input, "src/index.ts");
    assert.equal(cjsConfig.output[0].format, "cjs");
    assert.equal(cjsConfig.output[0].exports, "named");
    assert.equal(cjsConfig.output[0].file, "dist/index.cjs");

    assert.deepEqual(esmConfig.input, "src/index.ts");
    assert.equal(esmConfig.output[0].format, "esm");
    assert.equal(esmConfig.output[0].exports, "named");
    assert.equal(esmConfig.output[0].file, "dist/index.mjs");

    assert.deepEqual(styleConfig.input, "src/style.ts");
    assert.equal(styleConfig.output[0].format, "cjs");
    assert.equal(styleConfig.output[0].file, "dist/style/css.js");
  });

  test("skips umd and style entries when their source files are absent", () => {
    const configs = withExistsSync([], () => createDefaultConfigs(baseArgs));
    assert.equal(configs.length, 2);
    assert.equal(configs[0].output[0].format, "cjs");
    assert.equal(configs[1].output[0].format, "esm");
  });

  test("disables sourcemaps in production", () => {
    const configs = withExistsSync(["src/main.ts", "src/style.ts"], () => createDefaultConfigs({ ...baseArgs, isProduction: true }));

    for (const config of configs) {
      assert.equal(config.output[0].sourcemap, false);
    }
  });

  test("injects react globals for umd when isReact is true", () => {
    const configs = withExistsSync(["src/main.ts"], () => createDefaultConfigs({ ...baseArgs, isReact: true }));

    const umdConfig = configs.find((c) => c.output[0].format === "umd");
    assert.deepEqual(umdConfig.output[0].globals, {
      react: "React",
      clsx: "clsx",
    });
  });

  test("keeps umd globals empty when isReact is false", () => {
    const configs = withExistsSync(["src/main.ts"], () => createDefaultConfigs(baseArgs));
    const umdConfig = configs.find((c) => c.output[0].format === "umd");
    assert.deepEqual(umdConfig.output[0].globals, {});
  });
});

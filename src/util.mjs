import { upperCamel } from "@skax/camel";
import fs from "fs";

const SUPPORTED_FORMATS = ["umd", "cjs", "esm"];

/**
 * Format a date value to YYYY-MM-DD.
 * @param {Date | string | number} [date=new Date()] Date instance or parsable date input.
 * @returns {string}
 * @example
 * formatDate(new Date("2026-04-30T00:00:00Z"));
 * // => "2026-04-30"
 */
export function formatDate(date = new Date()) {
  const parsedDate = date instanceof Date ? date : new Date(date);
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Convert package name to UMD export name.
 * @param {string} pkgName Package name, supports scoped names.
 * @returns {string}
 * @example
 * getDefaultExportName("@scope/button-group");
 * // => "ButtonGroup"
 */
export function getDefaultExportName(pkgName) {
  const segments = String(pkgName || "").split("/");
  const name = segments.length > 1 ? segments[segments.length - 1] : segments[0];
  return upperCamel(name, "-");
}

/**
 * Normalize build formats and keep only supported values.
 * @param {Array<string>=} formats Build format list.
 * @returns {Array<"umd"|"cjs"|"esm">}
 * @example
 * normalizeFormats(["esm", "iife", "cjs"]);
 * // => ["esm", "cjs"]
 */
export function normalizeFormats(formats) {
  if (!Array.isArray(formats) || formats.length === 0) {
    return SUPPORTED_FORMATS;
  }
  return formats.filter((format) => SUPPORTED_FORMATS.includes(format));
}

/**
 * Resolve output files with defaults.
 * @param {object=} output Custom output file map.
 * @returns {{ umd: string, cjs: string, esm: string, style: string, types: string }}
 * @example
 * getOutputFiles({ cjs: "build/index.cjs" });
 * // => { umd: "dist/index.umd.js", cjs: "build/index.cjs", esm: "dist/index.mjs", style: "dist/style/css.js", types: "dist/types/index.d.ts" }
 */
export function getOutputFiles(output) {
  return {
    umd: output?.umd || "dist/index.umd.js",
    cjs: output?.cjs || "dist/index.cjs",
    esm: output?.esm || "dist/index.mjs",
    style: output?.style || "dist/style/css.js",
    types: output?.types || "dist/types/index.d.ts",
  };
}

/**
 * Build default rollup entries by formats and feature flags.
 * @param {object} args Build context.
 * @param {string} args.input Script entry.
 * @param {string} args.styleInput Style entry.
 * @param {{ umd: string, cjs: string, esm: string, style: string }} args.outputFiles Output file map.
 * @param {Array<"umd"|"cjs"|"esm">} args.formats Target formats.
 * @param {boolean} args.isReact React mode flag.
 * @param {string} args.banner Banner text.
 * @param {string} args.exportName UMD global export name.
 * @returns {Array<object>}
 * @example
 * createDefaultConfigs({
 *   input: "src/index.ts",
 *   styleInput: "src/style.ts",
 *   outputFiles: { umd: "dist/index.umd.js", cjs: "dist/index.cjs", esm: "dist/index.mjs", style: "dist/style/css.js" },
 *   formats: ["cjs", "esm"],
 *   isReact: false,
 *   banner: "/* demo *\/",
 *   exportName: "Demo",
 * });
 */
export function createDefaultConfigs({ input, styleInput, outputFiles, formats, isReact, banner, exportName }) {
  const configs = [];
  const isProduction = process.env.NODE_ENV === "production";

  if (formats.includes("umd") && fs.existsSync("src/main.ts")) {
    configs.push({
      input,
      output: [
        {
          file: outputFiles.umd,
          format: "umd",
          name: exportName,
          sourcemap: !isProduction,
          banner,
          globals: isReact
            ? {
                react: "React",
                clsx: "clsx",
              }
            : {},
        },
      ],
    });
  }

  if (formats.includes("cjs")) {
    configs.push({
      input,
      output: [
        {
          file: outputFiles.cjs,
          format: "cjs",
          exports: "named",
          sourcemap: !isProduction,
          banner,
        },
      ],
    });
  }

  if (formats.includes("esm")) {
    configs.push({
      input,
      output: [
        {
          exports: "named",
          file: outputFiles.esm,
          format: "esm",
          sourcemap: !isProduction,
          banner,
        },
      ],
    });
  }

  if (fs.existsSync(styleInput)) {
    configs.push({
      input: styleInput,
      output: [
        {
          file: outputFiles.style,
          format: "cjs",
          sourcemap: !isProduction,
          banner,
        },
      ],
    });
  }

  return configs;
}

import { upperCamel } from "@skax/camel";
import fs from "fs";
import path from "path";

/**
 * Format a date value to YYYY-MM-DD in UTC.
 * @param {Date | string | number} [date=new Date()] Date instance or parsable date input.
 * @returns {string}
 * @example
 * formatDate(new Date("2026-04-30T00:00:00Z"));
 * // => "2026-04-30"
 */
export function formatDate(date = new Date()) {
  const parsedDate = date instanceof Date ? date : new Date(date);

  // Handle invalid date
  if (Number.isNaN(parsedDate.getTime())) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const year = parsedDate.getUTCFullYear();
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getUTCDate()).padStart(2, "0");

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
 * Resolve output files with defaults.
 * @param {object=} output Custom output file map.
 * @returns {{ umd: string, cjs: string, esm: string, style: string, types: string }}
 * @example
 * getOutputFiles({ main: "build/index.cjs" });
 * // => { umd: "dist/index.umd.js", cjs: "build/index.cjs", esm: "dist/index.mjs", style: "dist/style/css.js", types: "dist/types/index.d.ts" }
 */
export function getOutputFiles(output) {
  return {
    umd: output?.umdOut || "dist/index.umd.js",
    cjs: output?.main || "dist/index.cjs",
    esm: output?.module || "dist/index.mjs",
    style: output?.styleOut || "dist/style/css.js",
    types: output?.types || "dist/types/index.d.ts",
  };
}

/**
 * Build default rollup entries by formats and feature flags.
 * @param {object} args Build context.
 * @param {string} args.input Script entry.
 * @param {string} args.umdInput UMD entry.
 * @param {string} args.styleInput Style entry.
 * @param {{ umd: string, cjs: string, esm: string, style: string }} args.outputFiles Output file map.
 * @param {boolean} args.isReact React mode flag.
 * @param {boolean} args.isProduction Production mode flag.
 * @param {string} args.banner Banner text.
 * @param {string} args.exportName UMD global export name.
 * @returns {Array<object>}
 * @example
 * createDefaultConfigs({
 *   input: "src/index.ts",
 *   umdInput: "src/main.ts",
 *   styleInput: "src/style.ts",
 *   outputFiles: { umd: "dist/index.umd.js", cjs: "dist/index.cjs", esm: "dist/index.mjs", style: "dist/style/css.js" },
 *   isReact: false,
 *   banner: "/* demo *\/",
 *   exportName: "Demo",
 * });
 */
export function createDefaultConfigs({ input, umdInput, styleInput, outputFiles, isReact, isProduction, banner, exportName }) {
  const configs = [];

  if (fs.existsSync(umdInput)) {
    configs.push({
      input: umdInput,
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

/**
 * 从给定目录向上查找 pnpm workspace 根目录（含 pnpm-workspace.yaml 的目录）。
 * @param {string} dir 起始目录
 * @returns {string | null} workspace 根目录路径，未找到返回 null
 */
function findPnpmWorkspaceRoot(dir) {
  let current = dir;
  while (true) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function hasEslintConfig() {
  const cwd = process.cwd();
  let dirToCheck = cwd;

  const workspaceRoot = findPnpmWorkspaceRoot(cwd);
  if (workspaceRoot && workspaceRoot !== cwd) {
    dirToCheck = workspaceRoot;
  }

  const foundESLint = fs.existsSync(path.resolve(dirToCheck, "eslint.config.mjs"));

  if (!foundESLint) {
    console.warn(`ESLint configuration file(eslint.config.mjs) not found, skip rollup esLint plugin.`);
    return false;
  }

  return true;
}

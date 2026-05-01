import { dts } from "rollup-plugin-dts";
import alias from "@rollup/plugin-alias";
import { resolve as pathResolve } from "path";
import { createTerserPlugin } from "./plugins/createTerserPlugin.mjs";
import { createSharedPlugins } from "./plugins/createSharedPlugins.mjs";
import { createDefaultConfigs, formatDate, getDefaultExportName, getOutputFiles } from "./util.mjs";

/** @type {readonly string[]} UMD 构建中不作 external 的运行时依赖 */
const UMD_EXTERNAL = Object.freeze(["react/jsx-runtime", "react", "clsx"]);

/**
 * @description rollup config function
 * @param {object} pkg package.json merged with build options
 * @param {string} pkg.name name field in package.json, used for banner and default export name
 * @param {string=} pkg.main main entry (cjs output)
 * @param {version=} pkg.version string version
 * @param {string=} pkg.author author name for banner
 * @param {object=} pkg.dependencies dependencies object
 * @param {("tsc" | "swc")=} pkg.compiler compiler choice, default to swc
 * @param {port=} pkg.port port for development server; setting it enables the serve plugin
 * @param {string=} pkg.input entry input, default to src/index.ts
 * @param {string=} pkg.umdInput umd input, default to src/main.ts
 * @param {string=} pkg.styleInput style input, default to src/style.ts
 * @param {string=} pkg.main cjs output file (package.json main)
 * @param {string=} pkg.module esm output file (package.json module)
 * @param {string=} pkg.types dts output file (package.json types)
 * @param {string=} pkg.umdOut umd output file, default to dist/index.umd.js
 * @param {string=} pkg.styleOut style output file, default to dist/css.js, e.g. dist/style/css.js, must not be index.js to avoid overwriting the main entry
 * @param {string=} pkg.exportName umd export name when format is umd, default to PascalCase of package name
 * @param {Array=} configs config[]
 * @example
 * generateConfig(
 *   {
 *     name: "@scope/button",
 *     version: "1.0.0",
 *     author: "your-name",
 *     dependencies: { clsx: "^2.1.1" },
 *     main: "dist/index.cjs",
 *     module: "dist/index.mjs",
 *     types: "dist/types/index.d.ts",
 *     input: "src/index.ts",
 *     umdInput: "src/main.ts",
 *     styleInput: "src/style.ts",
 *     umdOut: "dist/index.umd.js",
 *     styleOut: "dist/style/css.js",
 *   },
 *   [],
 * );
 * @returns
 */
function generateConfig(pkg, configs = []) {
  const isProduction = process.env.NODE_ENV === "production";
  const isReact = process.env.REACT_ENV === "react";

  // Sanitize banner content to prevent `*/` breaking the comment
  const safeName = String(pkg.name || "").replace(/\*\//g, "*\\/");
  const safeAuthor = String(pkg.author || "").replace(/\*\//g, "*\\/");

  // prettier-ignore
  const banner = `/*
* ${safeName} v${pkg.version}
* Copyright (c) ${formatDate()} ${safeAuthor}
* Released under the ${pkg.license || "MIT"} License.
*/`;

  const input = pkg.input || "src/index.ts";
  const umdInput = pkg.umdInput || "src/main.ts";
  const styleInput = pkg.styleInput || "src/style.ts";
  const { umdOut, main, module, types, styleOut } = pkg;
  const outputFiles = getOutputFiles({ umdOut, main, module, types, styleOut });
  const externals = Object.keys(pkg?.dependencies || {});
  const exportName = pkg.exportName || getDefaultExportName(pkg?.name);

  const defaultConfigs = createDefaultConfigs({
    input,
    umdInput,
    styleInput,
    outputFiles,
    isReact,
    isProduction,
    banner,
    exportName,
  });

  return [
    ...defaultConfigs.map((entry) => ({
      ...entry,
      external: entry.output[0].format === "umd" ? [...UMD_EXTERNAL] : [...UMD_EXTERNAL, ...externals],
      plugins: createSharedPlugins({
        entry,
        pkg,
        styleInput,
        isProduction,
        isReact,
        terserPlugin: isProduction ? createTerserPlugin() : undefined,
      }),
    })),
    types && {
      input,
      output: [{ file: outputFiles.types, format: "es" }],
      plugins: [
        alias({
          entries: [
            {
              find: /^@\/(.*)/,
              replacement: pathResolve(process.cwd(), "src/$1"),
            },
          ],
        }),
        dts(),
      ],
      external: [/\.(css|less|scss|sass)$/],
    },
    ...(configs || []),
  ].filter(Boolean);
}

export default generateConfig;

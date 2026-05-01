import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import swc from "@rollup/plugin-swc";
import serve from "rollup-plugin-serve";
import { dts } from "rollup-plugin-dts";
import eslint from "@rollup/plugin-eslint";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import alias from "@rollup/plugin-alias";
import copy from "rollup-plugin-copy";
import terser from "@rollup/plugin-terser";
import postcss from "rollup-plugin-postcss";
import cssnano from "cssnano";
import autoprefixer from "autoprefixer";
import { resolve as pathResolve } from "path";
import { injectCssRequire } from "./injectCssRequire.mjs";
import { createDefaultConfigs, formatDate, getDefaultExportName, getOutputFiles, normalizeFormats } from "./util.mjs";

/**
 * 创建 terser 插件实例
 * @returns {import("rollup").Plugin}
 */
function createTerserPlugin() {
  return terser({
    compress: {
      defaults: true,
      drop_console: true, // 去除 console.log
      drop_debugger: true, // 去除 debugger
    }, // 禁用所有压缩功能
    mangle: false, // 不混淆任何变量名（包括函数名） 混淆后可能会导致变量同名而被覆盖
    format: {
      beautify: false, // 保持代码格式
      // comments: true, // 保留注释
      comments: function (node, comment) {
        if (comment.type === "comment2") {
          // multiline comment
          return comment.value.includes("Copyright (c) "); // 不可以使用变量
        }
      },
    },
  });
}

function createSharedPlugins({ entry, pkg, styleInput, isProduction, isReact, terserPlugin }) {
  return [
    eslint({
      throwOnError: true, // lint 结果有错误将会抛出异常
      // throwOnWarning: true,
      include: ["src/**/*.ts", "src/**/*.js", "src/**/*.cjs", "src/**/*.mjs", "src/**/*.jsx", "src/**/*.tsx"],
      exclude: ["node_modules/**", "**/__tests__/**"],
    }),
    // 需要和 tsconfig.json 配置 paths 一致
    alias({
      entries: [
        {
          find: /^@\/(.*)/,
          replacement: pathResolve(process.cwd(), "src/$1"),
        },
      ],
    }),
    pkg.compiler === "tsc"
      ? typescript({
          declaration: false,
        })
      : swc({
          // https://swc.rs/docs/configuration/swcrc
          swc: {
            jsc: {
              target: isReact ? "es2018" : "es5",
            },
          },
          include: ["./src/**/*.{ts,js,cjs,mjs,tsx,jsx}"],
        }),
    resolve({
      // extensions: ['.js', '.cjs', '.jsx', '.mjs', '.ts', '.tsx', '.json'],
    }),
    commonjs({
      extensions: [".js", ".cjs", ".jsx", ".mjs", ".ts", ".tsx", ".json"],
    }),
    replace({
      __VERSION__: `${pkg.version}`,
      preventAssignment: true,
    }),
    postcss({
      plugins: [autoprefixer(), cssnano({ preset: "default" })],
      sourceMap: !isProduction,
      /**
       * https://www.npmjs.com/package/rollup-plugin-postcss#extract
       * extract: true 将 CSS 提取到单独的文件中，默认为 false，即将 CSS 内联到 JavaScript 中。
       * extract: 'styles.css' 将 CSS 提取到指定的文件中。
       */
      extract: true,
      minimize: true,
      use: [
        [
          "sass",
          {
            silenceDeprecations: ["legacy-js-api"],
          },
        ],
      ],
      include: ["/**/*.scss", "/**/*.sass", "/**/*.css"],
      includePaths: ["src/", "node_modules/"],
      // 处理从 node_modules 导入
      importer(path) {
        return { file: path[0] === "~" ? path.substr(1) : path };
      },
    }),
    !isProduction && entry.output[0].format === "umd" && pkg.port
      ? serve({
          port: pkg.port,
          contentBase: ["public", "dist"],
        })
      : null,
    // style.ts. => style.js 注入内容（require("./style.css");）
    ...(entry.input === styleInput
      ? [
          copy({
            copyOnce: true,
            flatten: false,
            targets: [
              { src: "src/**/*.scss", dest: "dist/style" },
              { src: "src/**/*.sass", dest: "dist/style" },
              { src: "src/**/*.css", dest: "dist/style" },
              {
                src: "src/style.ts", // 复制 style.ts 到 dist/style/index.js，供 umd 引用
                dest: "dist/style",
                rename: "index.js",
              },
            ],
          }),
          injectCssRequire(),
        ]
      : []),
    isProduction ? terserPlugin : null,
    ...[entry?.plugins || []],
  ].filter(Boolean);
}

/**
 * @description rollup config function
 * @param {object} pkg package.json
 * @param {string} pkg.name name
 * @param {string=} pkg.main main
 * @param {version=} pkg.version string
 * @param {string=} pkg.author author
 * @param {object=} pkg.dependencies dependencies
 * @param {("tsc" | "swc")=} pkg.compiler compiler
 * @param {port=} pkg.port port
 * @param {Array} configs config[]
 * @param {object=} options build options
 * @param {string=} options.input entry input
 * @param {string=} options.styleInput style input
 * @param {object=} options.output output files
 * @param {string=} options.output.umd umd output file
 * @param {string=} options.output.cjs cjs output file
 * @param {string=} options.output.esm esm output file
 * @param {string=} options.output.style style output file
 * @param {string=} options.output.types dts output file
 * @param {string=} options.exportName umd export name
 * @param {Array<"umd"|"cjs"|"esm">=} options.formats build formats
 * @returns
 */
function generateConfig(pkg, configs, options = {}) {
  const isProduction = process.env.NODE_ENV === "production";
  const isReact = process.env.REACT_ENV === "react";

  // prettier-ignore
  const banner = `/*
* ${pkg.name} v${pkg.version}
* Copyright (c) ${formatDate()} ${pkg.author}
* Released under the MIT License.
*/`;

  const input = options.input || "src/index.ts";
  const styleInput = options.styleInput || "src/style.ts";
  const outputFiles = getOutputFiles(options.output);
  const formats = normalizeFormats(options.formats);

  const externals = Object.keys(pkg?.dependencies || {});
  const exportName = options.exportName || getDefaultExportName(pkg?.name);

  const defaultConfigs = createDefaultConfigs({
    input,
    styleInput,
    outputFiles,
    formats,
    isReact,
    banner,
    exportName,
  });

  const terserPlugin = createTerserPlugin();

  return [
    ...defaultConfigs.map((entry) => ({
      ...entry,
      external: entry.output[0].format === "umd" ? ["react/jsx-runtime", "react", "clsx"] : ["react/jsx-runtime", "react", "clsx", ...externals],
      plugins: createSharedPlugins({ entry, pkg, styleInput, isProduction, isReact, terserPlugin }),
    })),
    {
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

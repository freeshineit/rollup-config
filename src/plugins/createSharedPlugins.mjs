import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import swc from "@rollup/plugin-swc";
import serve from "rollup-plugin-serve";
import eslint from "@rollup/plugin-eslint";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import alias from "@rollup/plugin-alias";
import copy from "rollup-plugin-copy";
import postcss from "rollup-plugin-postcss";
import cssnano from "cssnano";
import autoprefixer from "autoprefixer";
import { resolve as pathResolve } from "path";
import { injectCssRequire } from "./injectCssRequire.mjs";

/**
 * 创建默认共享插件链。
 *
 * 该方法会按构建上下文自动注入编译、样式、开发服务和压缩插件，
 * 并将调用方传入的额外插件附加到末尾。
 *
 * @param {object} options 参数对象
 * @param {import("rollup").RollupOptions} options.entry 单个构建配置项
 * @param {object} options.pkg package.json 与构建配置合并后的对象
 * @param {string} options.styleInput 样式入口路径
 * @param {boolean} options.isProduction 是否生产环境
 * @param {boolean} options.isReact 是否 React 构建场景
 * @param {import("rollup").Plugin} options.terserPlugin 预创建的 terser 插件实例
 * @returns {import("rollup").Plugin[]} 插件数组
 * @example
 * const plugins = createSharedPlugins({
 *   entry,
 *   pkg,
 *   styleInput: "src/style.ts",
 *   isProduction: false,
 *   isReact: true,
 *   terserPlugin,
 * });
 */
export function createSharedPlugins({ entry, pkg, styleInput, isProduction, isReact, terserPlugin }) {
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
    // style.ts => style.js 注入内容（require("./style.css");）
    ...(entry.input === styleInput
      ? [
          // 复制样式文件到 dist/style 目录，保持原有目录结构
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

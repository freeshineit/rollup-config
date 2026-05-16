import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import swc from "@rollup/plugin-swc";
import serve from "rollup-plugin-serve";
import eslint from "@rollup/plugin-eslint";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import alias from "@rollup/plugin-alias";
import strip from "@rollup/plugin-strip";
import copy from "rollup-plugin-copy";
import postcss from "rollup-plugin-postcss";
import cssnano from "cssnano";
import autoprefixer from "autoprefixer";
import { resolve as pathResolve } from "path";
import { injectCssRequire } from "./injectCssRequire.mjs";
import { hasEslintConfig } from "../util.mjs";

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
    // 生产构建跳过 ESLint 以提升构建速度，且仅在存在 eslint 配置文件时启用
    ...(!isProduction && hasEslintConfig()
      ? [
          eslint({
            throwOnError: true,
            include: ["src/**/*.ts", "src/**/*.js", "src/**/*.cjs", "src/**/*.mjs", "src/**/*.jsx", "src/**/*.tsx"],
            exclude: [
              "node_modules/**",
              "**/__tests__/**",
              "**/e2e/**",
              "**/*.test.{ts,js,cjs,mjs,tsx,jsx}",
              "**/*.spec.{ts,js,cjs,mjs,tsx,jsx}",
              "**/*.min.js",
              "**/*.umd.js",
              "**/dist/**",
              "**/build/**",
              "**/coverage/**",
              "**/docs/**",
              "**/examples/**",
            ],
          }),
        ]
      : []),
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
      "process.env.NODE_ENV": !isProduction ? '"development"' : '"production"',
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
            includePaths: ["node_modules", "src"],
            importer(path) {
              // 处理以 ~ 开头的路径，表示从 node_modules 中导入
              return { file: path[0] === "~" ? path.substr(1) : path };
            },
          },
        ],
      ],
      extensions: [".scss", ".css", ".sass"],
    }),
    !isProduction && entry.output[0].format === "umd" && pkg.port
      ? serve({
          port: pkg.port,
          open: true,
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
                src: styleInput, // 复制 style.ts 到 dist/style/index.js，供 umd 引用
                dest: "dist/style",
                rename: "index.js",
              },
            ],
          }),
          injectCssRequire({ styleOut: entry?.output?.[0]?.file }),
        ]
      : []),
    isProduction ? terserPlugin : null,
    isProduction
      ? strip({
          include: ["src/**/*.{ts,js,cjs,mjs,tsx,jsx}"],
          debugger: true,
          exclude: ["**/node_modules/@skax/logger/**"], // 保留 logger 模块中的 console 方法
        })
      : null,
    ...[entry?.plugins || []],
  ].filter(Boolean);
}

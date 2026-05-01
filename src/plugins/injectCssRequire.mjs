import { basename, extname } from "path";

const PLUGIN_NAME = "inject-css-require";

/**
 * 在样式构建产物尾部注入 `require("./<name>.css")`，
 * 确保运行时能同步加载对应的 CSS 文件。
 *
 * @param {object=} options
 * @param {string=} options.styleOut 样式输出文件路径，例如 dist/style/css.js
 * @returns {import("rollup").Plugin}
 * @example
 * injectCssRequire({ styleOut: "dist/style/css.js" });
 * // => 在产物末尾追加 require("./css.css");
 */
export function injectCssRequire({ styleOut } = {}) {
  const styleJsFile = basename(String(styleOut || "css.js"));
  const jsExt = extname(styleJsFile);
  const styleName = jsExt ? styleJsFile.slice(0, -jsExt.length) : styleJsFile;
  const cssRequirePath = `./${styleName}.css`;

  return {
    name: PLUGIN_NAME,
    generateBundle(_options, bundle) {
      Object.values(bundle).forEach((chunk) => {
        if (chunk.type === "chunk") {
          chunk.code = `${chunk.code}require("${cssRequirePath}");\n`;
        }
      });
    },
  };
}

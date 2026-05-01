import { basename, extname } from "path";

/**
 * 插入css文件
 * @param {object=} options
 * @param {string=} options.styleOut 样式输出文件路径，例如 dist/style/css.js
 * @returns
 */
export function injectCssRequire({ styleOut } = {}) {
  const styleJsFile = basename(styleOut || "css.js");
  const jsExt = extname(styleJsFile);
  const styleName = jsExt ? styleJsFile.slice(0, -jsExt.length) : styleJsFile;
  const cssRequirePath = `./${styleName}.css`;

  return {
    name: "inject-css-require",
    generateBundle(options, bundle) {
      Object.values(bundle).forEach((chunk) => {
        if (chunk.type === "chunk") {
          // 在文件头部插入
          // chunk.code = 'require("./css.css");\n' + chunk.code;
          // 在文件尾部插入
          chunk.code = chunk.code + `require("${cssRequirePath}");\n`;
        }
      });
    },
  };
}

import terser from "@rollup/plugin-terser";

/**
 * 创建 terser 插件实例。
 *
 * 默认策略：移除 console/debugger，保留标识符名称，
 * 仅保留包含 Copyright (c) 的多行注释。
 *
 * @param {Object} [options] - 配置选项
 * @param {boolean|string[]} [options.dropConsole=true] - 是否移除 console，也可以传入数组指定移除的 console 方法，例如 ['log', 'info']
 * @returns {import("rollup").Plugin} terser 插件实例
 * @example
 * const terserPlugin = createTerserPlugin({ dropConsole: false });
 *
 * export default {
 *   input: "src/index.ts",
 *   output: [{ file: "dist/index.mjs", format: "esm" }],
 *   plugins: [terserPlugin],
 * };
 */
export function createTerserPlugin(options = {}) {
  const { dropConsole = true, exclude } = options;
  return terser({
    exclude: exclude || ["**/@skax/logger/dist/*"], // 默认排除 node_modules 目录
    compress: {
      defaults: true,
      drop_console: dropConsole, // 去除 console.log 等
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

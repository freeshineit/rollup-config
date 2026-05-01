## @skax/rollup-config

![build](https://github.com/freeshineit/rollup-config/workflows/build/badge.svg) ![Download](https://img.shields.io/npm/dm/@skax/rollup-config.svg) ![Version](https://img.shields.io/npm/v/@skax/rollup-config.svg) ![License](https://img.shields.io/npm/l/@skax/rollup-config.svg)

一个面向业务组件库和前端包的 Rollup 配置生成器。它把常见的 JavaScript/TypeScript、样式、类型声明、别名、压缩和复制流程收敛成一套约定式配置，适合快速统一多个包的构建行为。

## 安装

```bash
# npm
npm install rollup @skax/rollup-config -D

# yarn
yarn add rollup @skax/rollup-config -D

# pnpm
pnpm add rollup @skax/rollup-config -D
```

如果你的项目使用了本配置内置的样式链路，通常还需要安装以下依赖：

```bash
pnpm add -D sass
```

如果你希望使用 `compiler: "tsc"`，请确保项目内已经安装 TypeScript。

## 快速使用

在项目根目录创建 `rollup.config.mjs`:

```js
import generateConfig from "@skax/rollup-config";
import fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

export default generateConfig({
  ...pkg,
  // 业务入口（默认 src/index.ts）
  input: "src/index.ts",
  // UMD 入口（文件存在时才会构建 UMD）
  umdInput: "src/main.ts",
  // UMD 输出文件
  umdOut: "dist/index.umd.js",
  // 样式入口（文件存在时才会构建样式产物）
  styleInput: "src/style.ts",
  // 样式输出文件
  styleOut: "dist/style/css.js",
});
```

如果希望生成 UMD 和样式产物，请确保 `umdInput`、`styleInput` 指向的文件实际存在。

`generateConfig` 直接读取 `package.json` 对象，无需额外的 `options` 参数。输出路径由 `pkg.main`、`pkg.module`、`pkg.types`、`pkg.umdOut`、`pkg.styleOut` 驱动，与 `package.json` 标准字段保持一致。

然后在 `package.json` 中添加构建脚本：

```json
{
  "scripts": {
    "build": "rollup -c",
    "build:prod": "NODE_ENV=production rollup -c"
  }
}
```

## 目录约定

该配置默认按以下文件结构工作：

```text
src/
  index.ts
  main.ts      // 可选，作为默认 UMD 入口
  style.ts     // 可选，作为默认样式入口
```

其中：

- `src/index.ts` 是默认业务入口。
- `src/main.ts` 是默认 UMD 入口，文件存在时生成 UMD。
- `src/style.ts` 是默认样式入口，文件存在时生成 `dist/style/css.js`，并复制相关样式文件到 `dist/style`。

## 会生成什么

默认会根据入口文件情况生成以下产物：

| 条件                   | 产物                    |
| ---------------------- | ----------------------- |
| 始终生成               | `dist/index.cjs`        |
| 始终生成               | `dist/index.mjs`        |
| 始终生成               | `dist/types/index.d.ts` |
| 存在 `umdInput` 文件   | `umdOut`                |
| 存在 `styleInput` 文件 | `styleOut`              |

## 默认能力

该配置默认内置了这些能力：

- 支持 `swc` 和 `typescript` 两种编译方式，默认使用 `swc`。
- 自动生成 CJS、ESM、DTS，按条件生成 UMD 和样式入口构建。
- 自动将 `dependencies` 中的包标记为 external，避免打进 CJS 和 ESM 包中。
- 默认内置 ESLint、Node Resolve、CommonJS、Replace、PostCSS、Autoprefixer、CSSNano、Copy 等插件。
- 支持 `@/` 指向项目内 `src/` 目录。
- 检测 `REACT_ENV=react` 时：
  - SWC 编译目标切换到 `es2018`
  - UMD globals 中注入 `react` 和 `clsx`
- 检测 `NODE_ENV=production` 时关闭 sourcemap。

## `package.json` 支持字段

调用 `generateConfig(pkg)` 时，会读取以下字段：

| 字段           | 类型             | 说明                                       |
| -------------- | ---------------- | ------------------------------------------ |
| `name`         | `string`         | 用于 banner 和 UMD 导出名                  |
| `version`      | `string`         | 用于 banner 和版本替换                     |
| `author`       | `string`         | 用于 banner                                |
| `main`         | `string`         | CJS 输出路径，默认 `dist/index.cjs`        |
| `module`       | `string`         | ESM 输出路径，默认 `dist/index.mjs`        |
| `types`        | `string`         | DTS 输出路径，默认 `dist/types/index.d.ts` |
| `dependencies` | `object`         | 自动转为 external                          |
| `compiler`     | `"tsc" \| "swc"` | 指定编译器，默认 `swc`                     |
| `port`         | `number`         | 开发态 UMD 场景下用于本地 serve            |
| `input`        | `string`         | 脚本入口，默认 `src/index.ts`              |
| `umdInput`     | `string`         | UMD 入口，默认 `src/main.ts`               |
| `styleInput`   | `string`         | 样式入口，默认 `src/style.ts`              |
| `umdOut`       | `string`         | UMD 输出路径，默认 `dist/index.umd.js`     |
| `styleOut`     | `string`         | 样式产物路径，默认 `dist/style/css.js`     |
| `exportName`   | `string`         | UMD 全局导出名，默认由 `name` 推导         |

示例 `package.json`：

```json
{
  "name": "@scope/button",
  "version": "1.0.0",
  "author": "your-name",
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/types/index.d.ts",
  "compiler": "swc",
  "port": 3000
}
```

## 追加自定义配置

`generateConfig` 的第二个参数支持追加额外的 Rollup 配置：

```js
import generateConfig from "@skax/rollup-config";
import fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

export default generateConfig(pkg, [
  {
    input: "scripts/dev.ts",
    output: [{ file: "dist/dev.mjs", format: "esm" }],
  },
]);
```

这类追加配置会直接拼接到默认配置数组末尾，不会自动继承默认插件链。

## 自定义构建入口与产物

将自定义字段直接写入传入的 `pkg` 对象即可：

```js
import generateConfig from "@skax/rollup-config";
import fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

export default generateConfig(
  {
    ...pkg,
    input: "src/custom-entry.ts",
    umdInput: "src/custom-umd.ts",
    styleInput: "src/custom-style.ts",
    umdOut: "build/custom.umd.js",
    styleOut: "build/style.cjs",
    exportName: "CustomGlobal",
    // main/module/types 优先从 package.json 读取，也可在此覆盖
    main: "build/index.cjs",
    module: "build/index.mjs",
    types: "build/index.d.ts",
  },
  [],
);
```

## 环境变量

### `NODE_ENV`

- `production`: 关闭 sourcemap。
- 其他值或未设置: 默认开启 sourcemap。

### `REACT_ENV`

- `react`: 按 React 场景处理 UMD globals，并将 SWC target 设为 `es2018`。
- 其他值或未设置: 按普通库处理。

## 输出示例

```bash
NODE_ENV=production REACT_ENV=react rollup -c
```

如果项目中存在默认 `src/main.ts` 与 `src/style.ts`，通常会得到：

```text
dist/
	index.cjs
	index.mjs
	index.umd.js
	types/index.d.ts
	style/
		css.js
		index.js
		*.scss
```

## 局限与注意事项

这套配置是“强约定优先”，它的优势是省配置，代价是灵活性有限。

### 1. UMD 生成有前置条件

虽然 `input`、`umdInput`、`styleInput` 和输出路径已支持自定义，但 UMD 是否生成仍然取决于 `umdInput` 指向的文件是否存在。

如果你希望生成 UMD，请确保 `umdInput` 对应文件存在。

### 2. 默认规则依然是约定优先

即便支持自定义，开箱默认仍使用以下路径：

- `input: src/index.ts`
- `umdInput: src/main.ts`
- `styleInput: src/style.ts`
- `main（cjs）: dist/index.cjs`
- `module（esm）: dist/index.mjs`
- `types（dts）: dist/types/index.d.ts`
- `umdOut（仅 umdInput 文件存在时）: dist/index.umd.js`
- `styleOut: dist/style/css.js`

如果项目需要完全不同的构建策略，依然建议在外层组合或扩展配置。

### 3. 只自动 external `dependencies`

当前实现只会读取 `package.json` 里的 `dependencies` 作为 external。

这意味着：

- `peerDependencies` 不会自动 external
- `optionalDependencies` 不会自动 external
- 额外的运行时外部依赖需要你自己补充配置

### 4. 样式能力以 Sass/CSS 为主

- 默认处理 `.scss`、`.sass`、`.css`
- 内置 `autoprefixer` 和 `cssnano`
- 样式入口构建依赖 `styleInput` 指向文件（默认 `src/style.ts`）

如果你需要 CSS Modules、Less、Tailwind 专用链路或更复杂的 PostCSS 组合，当前配置并没有直接暴露完整的细粒度开关。

### 5. 构建格式范围固定

内置默认只产出：`umd`、`cjs`、`esm` 这三种格式。

如果需要 iife 或 system 等额外格式，需要通过第二个参数追加自定义构建配置。

### 6. 开发服务不是通用 dev server

只有在以下条件同时满足时才会启用 `rollup-plugin-serve`：

- `NODE_ENV !== "production"`
- 当前构建项是 UMD
- `pkg.port` 已设置

它更像是辅助调试能力，不适合作为完整的本地开发平台。

### 7. 别名规则也是固定的

目前只内置：

- `@/xxx -> <project-root>/src/xxx`

如果你有多组路径别名，需要在外层自行扩展。

## 适用场景

推荐用于：

- 中小型组件库
- 有统一目录规范的业务包
- 想快速输出 CJS、ESM、DTS 的工具包
- 样式入口简单、约定明确的前端包

不太适合：

- 多入口、多平台、复杂产物矩阵的构建系统
- 需要高度可配置 Rollup 插件编排的项目
- 需要复杂 CSS Modules / Tailwind / Less 构建策略的项目

## FAQ

### 1. 为什么没有生成 `dist/index.umd.js`？

因为当前实现只有在项目内存在 `src/main.ts` 时才会生成 UMD 包。请先确认该文件是否存在。

### 2. 为什么没有生成样式产物？

因为只有在存在 `src/style.ts` 时才会生成 `dist/style/css.js`。同时请确认样式入口确实被正确引用。

### 3. 为什么 React 项目的 UMD globals 没有按预期生效？

需要确保构建时设置了：

```bash
REACT_ENV=react
```

否则配置会按非 React 场景处理。

### 4. 为什么 sourcemap 在生产环境下消失了？

这是当前默认行为。只要 `NODE_ENV=production`，sourcemap 就会被关闭。

### 5. 为什么依赖没有被打包进产物？

因为 `dependencies` 默认会被标记为 external，这是为了减少库产物体积并避免重复打包运行时依赖。

### 6. `peerDependencies` 会自动 external 吗？

不会。当前只会自动 external `dependencies`。

### 7. 能直接改默认插件配置吗？

当前 API 没有暴露逐项覆写默认插件参数的能力。你可以通过第二个参数追加新配置，但它不会替换默认配置内部的插件实现。

### 8. `compiler` 不写时用什么？

默认走 `swc`。只有明确传入 `compiler: "tsc"` 时才会改用 `@rollup/plugin-typescript`。

### 9. 为什么 `@/` 能工作？

因为内置了别名规则，默认会把 `@/` 映射到项目根目录下的 `src/`。

### 10. 这套配置能完全替代自定义 Rollup 配置吗？

不能。它适合统一常见场景，但不是通用构建框架。如果你的项目构建差异很大，建议把它作为基础层，再根据实际情况做二次封装。

## @skax/rollup-config

![build](https://github.com/freeshineit/rollup-config/workflows/build/badge.svg) ![Download](https://img.shields.io/npm/dm/@skax/rollup-config.svg) ![Version](https://img.shields.io/npm/v/@skax/rollup-config.svg) ![License](https://img.shields.io/npm/l/@skax/rollup-config.svg)

一个面向业务组件库和前端包的 Rollup 配置生成器。它把常见的 JavaScript/TypeScript、样式、类型声明、别名、压缩和复制流程收敛成一套约定式配置，适合快速统一多个包的构建行为。

## 安装

```bash
# npm
npm install rollup @skax/rollup-config -D

# yarn
yarn add -D rollup @skax/rollup-config

# pnpm
pnpm add -D rollup @skax/rollup-config
```

如果你的项目使用了本配置内置的样式链路，通常还需要安装以下依赖：

```bash
pnpm add -D sass
```

如果你希望使用 `compiler: "tsc"`，请确保项目内已经安装 TypeScript。

## 快速使用

在项目根目录创建 `rollup.config.mjs`:

```js
import pkg from "./package.json" with { type: "json" };
import generateConfig from "@skax/rollup-config";

export default generateConfig(pkg);
```

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
	main.ts      // 可选，存在时才会生成 UMD
	style.ts     // 可选，存在时才会生成样式入口产物
```

其中：

- `src/index.ts` 是固定的业务入口。
- `src/main.ts` 存在时，生成 `dist/index.umd.js`。
- `src/style.ts` 存在时，生成 `dist/style/css.js`，并复制相关样式文件到 `dist/style`。

## 会生成什么

默认会根据入口文件情况生成以下产物：

| 条件                | 产物                    |
| ------------------- | ----------------------- |
| 始终生成            | `dist/index.cjs`        |
| 始终生成            | `dist/index.mjs`        |
| 始终生成            | `dist/types/index.d.ts` |
| 存在 `src/main.ts`  | `dist/index.umd.js`     |
| 存在 `src/style.ts` | `dist/style/css.js`     |

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

| 字段           | 类型             | 说明                            |
| -------------- | ---------------- | ------------------------------- |
| `name`         | `string`         | 用于 banner 和 UMD 导出名       |
| `version`      | `string`         | 用于 banner 和版本替换          |
| `author`       | `string`         | 用于 banner                     |
| `dependencies` | `object`         | 自动转为 external               |
| `compiler`     | `"tsc" \| "swc"` | 指定编译器                      |
| `port`         | `number`         | 开发态 UMD 场景下用于本地 serve |

示例：

```json
{
  "name": "@scope/button",
  "version": "1.0.0",
  "author": "your-name",
  "compiler": "swc",
  "port": 3000
}
```

## 追加自定义配置

`generateConfig` 的第二个参数支持追加额外的 Rollup 配置：

```js
import pkg from "./package.json" with { type: "json" };
import generateConfig from "@skax/rollup-config";

export default generateConfig(pkg, [
  {
    input: "scripts/dev.ts",
    output: [{ file: "dist/dev.mjs", format: "esm" }],
  },
]);
```

这类追加配置会直接拼接到默认配置数组末尾，不会自动继承默认插件链。

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

如果项目中存在 `src/main.ts` 与 `src/style.ts`，通常会得到：

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

### 1. 入口路径是固定的

- 业务入口固定为 `src/index.ts`。
- UMD 入口固定检测 `src/main.ts`。
- 样式入口固定检测 `src/style.ts`。

如果你的项目采用其他目录结构，需要自行包装或 fork 当前配置。

### 2. 输出文件名基本固定

默认输出路径和文件名已经写死为：

- `dist/index.cjs`
- `dist/index.mjs`
- `dist/index.umd.js`
- `dist/style/css.js`
- `dist/types/index.d.ts`

不适合需要大量定制产物命名规则的项目。

### 3. 只自动 external `dependencies`

当前实现只会读取 `package.json` 里的 `dependencies` 作为 external。

这意味着：

- `peerDependencies` 不会自动 external
- `optionalDependencies` 不会自动 external
- 额外的运行时外部依赖需要你自己补充配置

### 4. 样式能力以 Sass/CSS 为主

- 默认处理 `.scss`、`.sass`、`.css`
- 内置 `autoprefixer` 和 `cssnano`
- 样式入口构建依赖 `src/style.ts`

如果你需要 CSS Modules、Less、Tailwind 专用链路或更复杂的 PostCSS 组合，当前配置并没有直接暴露完整的细粒度开关。

### 5. UMD 生成有前置条件

只有 `src/main.ts` 存在时才会生成 UMD 包。这更适合需要浏览器直出的场景；如果你的库只面向现代打包器，完全可以不提供这个文件。

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

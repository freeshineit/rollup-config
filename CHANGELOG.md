## v1.0.1(2026-05-02)

### Fixed

- Fixed style include path seting

## v1.0.0(2026-05-01)

### Feat

- support custom `umdInput` / `styleInput` and `umdOut` / `styleOut`
- generate dts build only when `pkg.types` is provided
- align `getOutputFiles` input keys with package fields: `umdOut`, `main`, `module`, `types`, `styleOut`

### Refactor

- extract `createSharedPlugins` to `src/plugins/createSharedPlugins.mjs`
- extract `createTerserPlugin` to `src/plugins/createTerserPlugin.mjs`
- simplify `generateConfig` output mapping by using object shorthand

### Docs

- update README quick-start demo to include UMD/style input and output fields
- add inline comments for quick-start demo fields
- clarify `pkg.port` JSDoc description in English

### Test

- update tests for conditional dts generation behavior

## v0.1.0(2026-04-25)

### Feat

- rollup config
- support output commonjs
- support output esm
- support output umd
- support output sass

# Coding style

- **TypeScript**: `strict`, `noUnusedLocals`, `noUnusedParameters` (enforced in app + packages).
- **Formatting**: Prettier, 100 columns, single quotes, trailing commas (see `.prettierrc`).
- **Linting**: ESLint 9 flat config with `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-simple-import-sort`, and `no-console` in committed code.
- **Imports**: Sorted via `simple-import-sort`; prefer `import type` for type-only imports.
- **Logging**: Do not commit `console.log` / `console.warn`; route through `Analytics` / `Crashlytics` abstractions in `packages/core`.
- **Scope**: Keep changes minimal and aligned with existing patterns; avoid drive-by refactors.

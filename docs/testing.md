# Testing

## Layout

- `packages/core`: Jest (Node) tests colocated under `src/__tests__` with HTML fixtures in `src/fixtures/`.
- `apps/mobile`: `jest-expo/node` smoke tests under `__tests__/` (avoids loading the full React Native Jest preset in CI). `@testing-library/react-native` is available for future component tests using the iOS/Android Jest presets locally or in EAS.

## Commands

From the repository root (or per package):

- `yarn test` — all workspace tests
- `yarn test:watch` — watch mode (`packages/core`; run mobile tests in another terminal if needed)
- `yarn coverage` — coverage (where configured)

## Fixtures

HTML fixtures mimic the live page shape without pinning a single DOM structure. When upstream HTML changes, update fixtures and parser expectations together (see `docs/parser-notes.md`).

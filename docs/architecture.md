# Architecture

## Monorepo layout

The repo uses **Yarn** (v1 workspaces) with `workspaces: ["apps/*", "packages/*"]`. With **expo-dev-client**, `yarn ios` / `yarn android` run `expo run:ios` / `expo run:android`, which compile native code and install the dev build on the simulator/emulator (required the first time and after native changes). For a quick Metro-only session when a dev build is already installed, use `yarn ios:start` / `yarn android:start` (`expo start --ios` / `--android`).

- `apps/mobile`: Expo (React Native) client using Expo Router. Owns permissions, networking, persistence, and UI composition.
- `packages/core`: Pure TypeScript domain layer — models, HTML parsing, normalization, refresh orchestration, perspective helpers, logging interfaces, widget data contracts, and unit tests.
- `packages/ui`: Thin Tamagui re-exports for shared primitives (optional; keeps UI tokens consistent).

## Data flow

1. Mobile fetches the public ATIS HTML page directly (`fetch`).
2. `packages/core` parses the HTML string into a `BridgeSnapshot` (never pass raw HTML to UI).
3. The snapshot is JSON-serialized to on-device storage (`expo-file-system`) for offline display and future widgets.
4. Optional `WidgetDataAdapter` reads the same JSON via a small interface (native extensions plug in later).

## Boundaries

- **No backend** in this MVP: no Supabase, auth servers, or remote databases.
- **Logging**: `Analytics` + `Crashlytics` interfaces ship with no-op implementations; swap for vendor SDKs without changing call sites.
- **Widgets**: Business logic stays in `core`; native widget hosts only deserialize cached JSON and render.

## Key types

See `packages/core/src/models.ts` for `BridgeSnapshot`, `LaneDirectionSummary`, `RefreshMetadata`, and related enums.

# Widget strategy

**Home-screen widgets are not shipped in the MVP.** iOS only lists apps in the widget gallery if they include a **Widget Extension** target (WidgetKit / SwiftUI). This repo defines a **JavaScript adapter** and cache format so a future native extension can read the same JSON without changing `packages/core`.

## Goal

Expose **normalized** `BridgeSnapshot` JSON to home-screen widgets without coupling domain logic to experimental Expo widget APIs.

## Adapter

`packages/core` defines `WidgetDataAdapter`:

- `readSnapshot()` returns the latest cached snapshot (same schema the app uses).
- Optional `notifyDataChanged()` can later trigger native reload hooks.

## Mobile implementation (MVP)

The app persists snapshots under `expo-file-system` document (or cache) storage. A thin `createFilesystemWidgetAdapter()` reuses the same cache reader.

## Native follow-ups

- **iOS**: App Group + `UserDefaults` / file in shared container; Widget Extension reads JSON only.
- **Android**: `Glance` / `RemoteViews` backed by `SharedPreferences` or a small file in app-private storage exposed via a `ContentProvider` (implementation-specific).
- **Expo**: If `expo-widgets` (or similar) matures, keep the adapter boundary — swap only the storage/notification wiring.

## Fallback

If Expo widget support is insufficient, ship the app with the filesystem adapter documented above and add native widget targets in a dev-client/EAS workflow without rewriting parsers.

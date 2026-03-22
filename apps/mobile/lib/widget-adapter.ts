import type { WidgetDataAdapter } from '@lions-gate/core';

import { createFileSystemSnapshotCache } from './cache';

/** Reads the same normalized JSON the app caches for future native widget hosts. */
export function createFilesystemWidgetAdapter(): WidgetDataAdapter {
  const cache = createFileSystemSnapshotCache();
  return {
    readSnapshot: () => cache.load(),
  };
}

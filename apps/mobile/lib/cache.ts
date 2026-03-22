import type { BridgeSnapshot, BridgeSnapshotCache } from '@lions-gate/core';
import * as FileSystem from 'expo-file-system';

function basePath(): string {
  return FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
}

const fileName = 'bridge-snapshot.json';

export function createFileSystemSnapshotCache(): BridgeSnapshotCache {
  const path = `${basePath()}${fileName}`;
  return {
    async load() {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) {
          return null;
        }
        const raw = await FileSystem.readAsStringAsync(path);
        return JSON.parse(raw) as BridgeSnapshot;
      } catch {
        return null;
      }
    },
    async save(snapshot: BridgeSnapshot) {
      await FileSystem.writeAsStringAsync(path, JSON.stringify(snapshot));
    },
  };
}

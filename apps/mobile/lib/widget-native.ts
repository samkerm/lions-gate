import type { BridgePerspective, BridgeSnapshot } from '@lions-gate/core';
import { buildThreeLanePayload } from '@lions-gate/core';
import { NativeModules, Platform } from 'react-native';

type WidgetSnapshotBridgeType = { writeSnapshot: (json: string) => void };

export function pushWidgetPayload(snapshot: BridgeSnapshot, perspective: BridgePerspective): void {
  if (Platform.OS !== 'ios') {
    return;
  }
  const payload = buildThreeLanePayload(snapshot, perspective);
  const json = JSON.stringify(payload);
  const bridge = NativeModules.WidgetSnapshotBridge as WidgetSnapshotBridgeType | undefined;
  bridge?.writeSnapshot?.(json);
}

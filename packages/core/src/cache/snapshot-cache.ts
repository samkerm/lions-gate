import type { BridgeSnapshot } from '../models';

export interface BridgeSnapshotCache {
  load(): Promise<BridgeSnapshot | null>;
  save(snapshot: BridgeSnapshot): Promise<void>;
}

import type { BridgeSnapshot } from '../models';

/**
 * Boundary for home-screen widgets / App Extensions.
 * Native iOS/Android implementations read serialized JSON via shared app group / storage.
 */
export interface WidgetDataAdapter {
  /** Latest normalized snapshot for widget renderers (same shape as app cache). */
  readSnapshot(): Promise<BridgeSnapshot | null>;
  /** Optional: notify host that data changed (native reload). */
  notifyDataChanged?(): Promise<void>;
}

export const noopWidgetDataAdapter: WidgetDataAdapter = {
  async readSnapshot() {
    return null;
  },
};

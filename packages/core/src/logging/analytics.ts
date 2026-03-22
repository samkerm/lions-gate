export type AnalyticsEvent =
  | { name: 'bridge_refresh_started'; properties?: Record<string, string | number | boolean> }
  | { name: 'bridge_refresh_succeeded'; properties?: Record<string, string | number | boolean> }
  | { name: 'bridge_refresh_failed'; properties?: Record<string, string | number | boolean> }
  | { name: 'parse_warning'; properties?: Record<string, string | number | boolean> }
  | { name: 'location_permission'; properties?: Record<string, string | number | boolean> }
  | { name: 'perspective_manual_toggle'; properties?: Record<string, string | number | boolean> };

export interface Analytics {
  track(event: AnalyticsEvent): void;
}

export const noopAnalytics: Analytics = {
  track() {
    /* vendor placeholder */
  },
};

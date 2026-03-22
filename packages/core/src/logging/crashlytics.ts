export interface Crashlytics {
  recordError(error: Error, context?: Record<string, string>): void;
}

export const noopCrashlytics: Crashlytics = {
  recordError() {
    /* vendor placeholder */
  },
};

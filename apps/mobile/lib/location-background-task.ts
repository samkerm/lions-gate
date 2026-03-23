import { perspectiveFromCoordinates } from '@lions-gate/core';
import * as Location from 'expo-location';
// Namespace type for the optional require() below (static `import` loads native and crashes if pods are not linked).
import type * as ExpoTaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { createFileSystemSnapshotCache } from './cache';
import { pushWidgetPayload } from './widget-native';

export const BRIDGE_LOCATION_TASK_NAME = 'bridge-perspective-location';

const cache = createFileSystemSnapshotCache();

type TaskManagerModule = typeof ExpoTaskManager;

function loadTaskManager(): TaskManagerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module; static import crashes if pods not linked
    return require('expo-task-manager') as TaskManagerModule;
  } catch {
    return null;
  }
}

const taskManager = loadTaskManager();

let warnedMissingNative = false;

function warnMissingNativeModule(): void {
  if (warnedMissingNative || !__DEV__) {
    return;
  }
  warnedMissingNative = true;
  // eslint-disable-next-line no-console -- one-time dev hint when JS has expo-task-manager but the binary was built before pods linked EXTaskManager
  console.warn(
    '[Lions Gate] Native module ExpoTaskManager is missing. Rebuild the iOS/Android app after `pod install` / `expo run:ios` so expo-task-manager is linked. Background widget updates are disabled until then.',
  );
}

if (taskManager) {
  taskManager.defineTask(BRIDGE_LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      return;
    }
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    if (!locations?.length) {
      return;
    }
    const last = locations[locations.length - 1];
    const perspective = perspectiveFromCoordinates(last.coords.latitude, last.coords.longitude);
    const snapshot = await cache.load();
    if (!snapshot) {
      return;
    }
    pushWidgetPayload(snapshot, perspective);
  });
} else {
  warnMissingNativeModule();
}

export async function startBridgeBackgroundLocation(): Promise<void> {
  if (!taskManager) {
    warnMissingNativeModule();
    return;
  }
  const started = await Location.hasStartedLocationUpdatesAsync(BRIDGE_LOCATION_TASK_NAME);
  if (started) {
    return;
  }
  const opts: Location.LocationTaskOptions = {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 200,
    timeInterval: 120_000,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    activityType: Location.LocationActivityType.AutomotiveNavigation,
  };
  if (Platform.OS === 'android') {
    opts.foregroundService = {
      notificationTitle: 'Lions Gate Bridge',
      notificationBody: 'Updating your bridge perspective for the home screen widget',
    };
  }
  await Location.startLocationUpdatesAsync(BRIDGE_LOCATION_TASK_NAME, opts);
}

export async function stopBridgeBackgroundLocation(): Promise<void> {
  if (!taskManager) {
    return;
  }
  const started = await Location.hasStartedLocationUpdatesAsync(BRIDGE_LOCATION_TASK_NAME);
  if (!started) {
    return;
  }
  await Location.stopLocationUpdatesAsync(BRIDGE_LOCATION_TASK_NAME);
}

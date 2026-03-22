import {
  type BridgePerspective,
  type BridgeSnapshot,
  buildBridgePresentation,
  defaultFeatureFlags,
  noopAnalytics,
  noopCrashlytics,
  perspectiveFromCoordinates,
  refreshBridgeSnapshot,
} from '@lions-gate/core';
import { Button, Spinner, Text, XStack, YStack } from '@lions-gate/ui';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { createFileSystemSnapshotCache } from '../lib/cache';
import { createFilesystemWidgetAdapter } from '../lib/widget-adapter';

const SOURCE_URL = 'https://www.th.gov.bc.ca/ATIS/lgcws/private_status.htm#dms1';

const cache = createFileSystemSnapshotCache();
const widgetAdapter = createFilesystemWidgetAdapter();

async function fetchHtml(): Promise<string> {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

function laneColor(kind: 'favorable' | 'opposing' | 'neutral'): string {
  if (kind === 'favorable') {
    return '#1b7f3a';
  }
  if (kind === 'opposing') {
    return '#b42318';
  }
  return '#6b7280';
}

export default function BridgeScreen() {
  const [snapshot, setSnapshot] = useState<BridgeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(
    null,
  );
  const [manualPerspective, setManualPerspective] = useState<BridgePerspective | null>(null);
  const [geoPerspective, setGeoPerspective] = useState<BridgePerspective>('unknown');

  const runRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await refreshBridgeSnapshot({
        fetchHtml,
        cache,
        now: new Date(),
        sourceUrl: SOURCE_URL,
        flags: defaultFeatureFlags,
        analytics: noopAnalytics,
        crashlytics: noopCrashlytics,
      });
      setSnapshot(next);
      await widgetAdapter.readSnapshot();
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const fg = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(fg.status);
        if (fg.status === Location.PermissionStatus.GRANTED) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setGeoPerspective(
            perspectiveFromCoordinates(pos.coords.latitude, pos.coords.longitude),
          );
        } else {
          setGeoPerspective('unknown');
        }
        await runRefresh();
      })();
    }, [runRefresh]),
  );

  const effectivePerspective: BridgePerspective = useMemo(() => {
    if (locationPermission === Location.PermissionStatus.DENIED && manualPerspective) {
      return manualPerspective;
    }
    if (geoPerspective !== 'unknown') {
      return geoPerspective;
    }
    if (manualPerspective) {
      return manualPerspective;
    }
    return 'unknown';
  }, [geoPerspective, locationPermission, manualPerspective]);

  const presentation = snapshot
    ? buildBridgePresentation(snapshot, effectivePerspective)
    : null;

  return (
    <YStack padding="$4" gap="$3" flex={1} backgroundColor="$background">
      <Text fontSize="$8" fontWeight="700">
        Lions Gate Bridge
      </Text>
      <Text opacity={0.8}>ATIS status (client-side parse)</Text>

      <YStack gap="$2">
        <Text fontWeight="600">Perspective</Text>
        <Text>
          Location:{' '}
          {locationPermission === null
            ? 'checking…'
            : locationPermission === Location.PermissionStatus.GRANTED
              ? 'granted'
              : 'denied / blocked'}
        </Text>
        {locationPermission === Location.PermissionStatus.DENIED ? (
          <XStack gap="$2" flexWrap="wrap">
            <Button size="$3" onPress={() => setManualPerspective('downtown_vancouver')}>
              Downtown view
            </Button>
            <Button size="$3" onPress={() => setManualPerspective('north_west_vancouver')}>
              North / West view
            </Button>
          </XStack>
        ) : null}
        <Text>
          Active perspective:{' '}
          {effectivePerspective === 'unknown' ? 'not set' : presentation?.perspectiveLabel}
        </Text>
      </YStack>

      <YStack gap="$2">
        <Text fontWeight="600">Delay</Text>
        <Text>
          {snapshot?.delay?.delayMinutes != null
            ? `${snapshot.delay.delayMinutes} min`
            : 'No numeric delay detected'}
        </Text>
        {snapshot?.delay?.messageRaw ? (
          <Text opacity={0.85} numberOfLines={4}>
            {snapshot.delay.messageRaw}
          </Text>
        ) : null}
      </YStack>

      <YStack gap="$2">
        <Text fontWeight="600">Lanes (your side vs other)</Text>
        {presentation ? (
          <YStack gap="$2">
            <Text fontWeight="600">Your direction</Text>
            <XStack gap="$2" flexWrap="wrap">
              {presentation.yourDirection.map((l) => (
                <YStack
                  key={l.label}
                  padding="$2"
                  borderRadius="$3"
                  backgroundColor={laneColor(l.kind)}
                  minWidth={72}
                >
                  <Text color="white" fontWeight="700">
                    {l.label}
                  </Text>
                </YStack>
              ))}
            </XStack>
            <Text fontWeight="600">Other direction</Text>
            <XStack gap="$2" flexWrap="wrap">
              {presentation.otherDirection.map((l) => (
                <YStack
                  key={l.label}
                  padding="$2"
                  borderRadius="$3"
                  backgroundColor={laneColor(l.kind)}
                  minWidth={72}
                >
                  <Text color="white" fontWeight="700">
                    {l.label}
                  </Text>
                </YStack>
              ))}
            </XStack>
          </YStack>
        ) : (
          <Text>No snapshot yet.</Text>
        )}
      </YStack>

      <YStack gap="$2">
        <Text fontWeight="600">Data freshness</Text>
        <Text>Last update (source): {snapshot?.refresh.lastUpdated ?? '—'}</Text>
        <Text>Fetched at: {snapshot?.refresh.fetchedAt ?? '—'}</Text>
        <Text color={snapshot?.refresh.isStale ? '#b42318' : '#1b7f3a'}>
          {snapshot?.refresh.isStale ? `Stale: ${snapshot.refresh.staleReason ?? 'yes'}` : 'Fresh'}
        </Text>
        <Text>Bridge mode: {snapshot?.bridgeMode ?? '—'}</Text>
      </YStack>

      <XStack gap="$2" alignItems="center">
        {loading ? <Spinner /> : null}
        <Button
          disabled={loading}
          onPress={() => {
            void runRefresh();
          }}
        >
          Refresh
        </Button>
      </XStack>
    </YStack>
  );
}

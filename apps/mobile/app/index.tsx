import {
  approachQueueHint as computeApproachQueueHint,
  type BridgePerspective,
  type BridgeSnapshot,
  buildBridgePresentation,
  buildThreeLanePresentation,
  defaultFeatureFlags,
  delayBannerStyle,
  formatAtisLastUpdateForDisplay,
  formatLaneOccupancy,
  formatLaneSpeed,
  formatVancouverFromIso,
  noopAnalytics,
  noopCrashlytics,
  perspectiveFromCoordinates,
  refreshBridgeSnapshot,
  sanitizeAtisPlainText,
  travelSummaryForPerspective,
} from '@lions-gate/core';
import { Button, Spinner, Text, XStack, YStack } from '@lions-gate/ui';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createFileSystemSnapshotCache } from '../lib/cache';
import {
  startBridgeBackgroundLocation,
  stopBridgeBackgroundLocation,
} from '../lib/location-background-task';
import { pushWidgetPayload } from '../lib/widget-native';

const SOURCE_URL = 'https://www.th.gov.bc.ca/ATIS/lgcws/private_status.htm#dms1';

/** While this screen is focused, refetch ATIS on this interval. MOT text says ~5 min updates; 1 min balances freshness vs load. Use 120_000 for 2 min. */
const ATIS_POLL_INTERVAL_MS = 60 * 1000;

const cache = createFileSystemSnapshotCache();

function locationPermissionAlertBody(): string {
  if (Platform.OS === 'ios') {
    return [
      'This app uses your location to guess which side of the bridge you’re on (north vs downtown) and to keep that perspective up to date.',
      '',
      'For the best experience, choose “Always” so we can keep receiving your location while you drive and while the app is in the background (including the home screen widget).',
      '',
      'Open Settings → Lions Gate Bridge → Location, then enable location and pick “Always”. “While Using the App” only updates while the app is open; “Allow Once” lasts for a single session.',
    ].join('\n');
  }
  return [
    'This app uses your location to guess which side of the bridge you’re on and to keep that perspective up to date.',
    '',
    'For continuous location (in the app and for the widget in the background), choose “Allow all the time”.',
    '',
    'Open Settings → Apps → Lions Gate Bridge → Permissions → Location, then select “Allow all the time”. “Allow only while using the app” limits updates to when the app is open.',
  ].join('\n');
}

async function fetchHtml(): Promise<string> {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

const DEFAULT_GREEN = '#22c55e';

/** Same rules as `effectivePerspective` useMemo — used with refs so widget push runs before the next render. */
function resolveEffectivePerspective(
  locationPermission: Location.PermissionStatus | null,
  manualPerspective: BridgePerspective | null,
  geoPerspective: BridgePerspective,
): BridgePerspective {
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
}

function LaneColumn({ circleBg, glyph }: { circleBg: string; glyph: 'x' | 'up' }) {
  return (
    <YStack
      width={56}
      height={56}
      borderRadius={999}
      backgroundColor={circleBg}
      alignItems="center"
      justifyContent="center"
    >
      <Text color="white" fontSize={glyph === 'x' ? 20 : 22} fontWeight="800">
        {glyph === 'x' ? '✕' : '↑'}
      </Text>
    </YStack>
  );
}

function ThreeLaneStrip({
  middle,
  rightGreenHex,
  lane1UnderIcon,
  lane2UnderIcon,
}: {
  middle: { color: 'red' | 'green' | 'neutral'; greenHex?: string | null };
  rightGreenHex?: string | null;
  /** Middle icon = L1 (reversible lane): speed line, then occupancy %. */
  lane1UnderIcon?: { speedLine: string; percentLine: string } | null;
  /** Right icon = L2 (default lane). */
  lane2UnderIcon?: { speedLine: string; percentLine: string } | null;
}) {
  const leftBg = '#b42318';
  const rightBg = rightGreenHex ?? DEFAULT_GREEN;
  const midBg =
    middle.color === 'green'
      ? (middle.greenHex ?? DEFAULT_GREEN)
      : middle.color === 'red'
        ? '#b42318'
        : '#6b7280';
  const middleGlyph = middle.color === 'red' ? 'x' : 'up';

  const colWidth = 88;

  return (
    <XStack gap="$2" justifyContent="center" alignItems="flex-start" paddingVertical="$2">
      <YStack width={colWidth} alignItems="center" gap="$1">
        <LaneColumn circleBg={leftBg} glyph="x" />
      </YStack>
      <YStack width={colWidth} alignItems="center" gap="$1">
        <LaneColumn circleBg={midBg} glyph={middleGlyph} />
        {lane1UnderIcon ? (
          <>
            <Text fontSize="$2" color="#a1a1aa" textAlign="center">
              {lane1UnderIcon.speedLine}
            </Text>
            <Text fontSize="$2" color="#a1a1aa" textAlign="center">
              {lane1UnderIcon.percentLine}
            </Text>
          </>
        ) : null}
      </YStack>
      <YStack width={colWidth} alignItems="center" gap="$1">
        <LaneColumn circleBg={rightBg} glyph="up" />
        {lane2UnderIcon ? (
          <>
            <Text fontSize="$2" color="#a1a1aa" textAlign="center">
              {lane2UnderIcon.speedLine}
            </Text>
            <Text fontSize="$2" color="#a1a1aa" textAlign="center">
              {lane2UnderIcon.percentLine}
            </Text>
          </>
        ) : null}
      </YStack>
    </XStack>
  );
}

export default function BridgeScreen() {
  const [snapshot, setSnapshot] = useState<BridgeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(
    null,
  );
  const [backgroundLocationPermission, setBackgroundLocationPermission] =
    useState<Location.PermissionStatus | null>(null);
  const [manualPerspective, setManualPerspective] = useState<BridgePerspective | null>(null);
  const [geoPerspective, setGeoPerspective] = useState<BridgePerspective>('unknown');

  const geoRef = useRef(geoPerspective);
  const manualRef = useRef(manualPerspective);
  const permissionRef = useRef<Location.PermissionStatus | null>(null);
  const snapshotRef = useRef<BridgeSnapshot | null>(null);
  const prevLocationPermissionRef = useRef<Location.PermissionStatus | null>(null);

  const runRefresh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }
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
      if (Platform.OS === 'ios') {
        const p = resolveEffectivePerspective(
          permissionRef.current,
          manualRef.current,
          geoRef.current,
        );
        pushWidgetPayload(next, p);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * `requestIfNeeded`: use `requestForegroundPermissionsAsync` on first focus (can prompt).
   * Use `getForegroundPermissionsAsync` when returning from Settings / foreground — updates
   * status without relying on `useFocusEffect` (same screen may stay “focused”).
   */
  const pullLocationPermissionAndGeo = useCallback(async (requestIfNeeded: boolean) => {
    const fg = requestIfNeeded
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    permissionRef.current = fg.status;
    setLocationPermission(fg.status);
    const bg = await Location.getBackgroundPermissionsAsync();
    setBackgroundLocationPermission(bg.status);
    let geo: BridgePerspective = 'unknown';
    if (fg.status === Location.PermissionStatus.GRANTED) {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        geo = perspectiveFromCoordinates(pos.coords.latitude, pos.coords.longitude);
      } catch {
        geo = 'unknown';
      }
      setGeoPerspective(geo);
    } else {
      setGeoPerspective('unknown');
    }
    geoRef.current = geo;
  }, []);

  const requestBackgroundLocation = useCallback(async () => {
    const run = async () => {
      const r = await Location.requestBackgroundPermissionsAsync();
      setBackgroundLocationPermission(r.status);
    };
    if (Platform.OS === 'android') {
      Alert.alert(
        'Background location',
        'Next, Android opens Location settings. Choose “Allow all the time” so this app can keep receiving your location when it’s not on screen (recommended for lane perspective and the home screen widget).',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => void run() },
        ],
      );
      return;
    }
    await run();
  }, []);

  useEffect(() => {
    if (locationPermission !== Location.PermissionStatus.GRANTED) {
      void stopBridgeBackgroundLocation();
      return;
    }
    if (backgroundLocationPermission === null) {
      return;
    }
    if (backgroundLocationPermission !== Location.PermissionStatus.GRANTED) {
      void stopBridgeBackgroundLocation();
      return;
    }
    void (async () => {
      try {
        await startBridgeBackgroundLocation();
      } catch {
        // Misconfiguration, Expo Go, or OS denied background updates.
      }
    })();
  }, [locationPermission, backgroundLocationPermission]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await pullLocationPermissionAndGeo(true);
        await runRefresh();
      })();
    }, [pullLocationPermissionAndGeo, runRefresh]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }
      void (async () => {
        await pullLocationPermissionAndGeo(false);
      })();
    });
    return () => sub.remove();
  }, [pullLocationPermissionAndGeo]);

  /** When permission flips to denied, prompt Settings (focus alone may not re-run). */
  useEffect(() => {
    if (locationPermission === null) {
      return;
    }
    const prev = prevLocationPermissionRef.current;
    prevLocationPermissionRef.current = locationPermission;
    if (locationPermission !== Location.PermissionStatus.DENIED) {
      return;
    }
    if (prev === Location.PermissionStatus.DENIED) {
      return;
    }
    Alert.alert('Location is off', locationPermissionAlertBody(), [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ]);
  }, [locationPermission]);

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => {
        void runRefresh({ silent: true });
      }, ATIS_POLL_INTERVAL_MS);
      return () => clearInterval(id);
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

  const presentation = snapshot ? buildBridgePresentation(snapshot, effectivePerspective) : null;

  const threeLane = snapshot ? buildThreeLanePresentation(snapshot, effectivePerspective) : null;
  const middleSlotColor = threeLane?.middle.color;

  const yourDirectionLanes = useMemo(() => {
    if (!snapshot || effectivePerspective === 'unknown') {
      return null;
    }
    return travelSummaryForPerspective(snapshot, effectivePerspective);
  }, [snapshot, effectivePerspective]);

  useEffect(() => {
    geoRef.current = geoPerspective;
    manualRef.current = manualPerspective;
    permissionRef.current = locationPermission;
  }, [geoPerspective, manualPerspective, locationPermission]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background' && next !== 'inactive') {
        return;
      }
      const s = snapshotRef.current;
      if (!s || Platform.OS !== 'ios') {
        return;
      }
      const p = resolveEffectivePerspective(
        permissionRef.current,
        manualRef.current,
        geoRef.current,
      );
      pushWidgetPayload(s, p);
    });
    return () => sub.remove();
  }, []);

  /** Manual side buttons: permission not granted, or granted but we could not infer NB vs downtown (GPS off, dead band, error). */
  const showManualPerspectiveButtons =
    locationPermission !== null &&
    (locationPermission !== Location.PermissionStatus.GRANTED || geoPerspective === 'unknown');

  const laneStatsUnderIcons = useMemo(() => {
    if (!yourDirectionLanes) {
      return {
        lane1: null as { speedLine: string; percentLine: string } | null,
        lane2: null as { speedLine: string; percentLine: string } | null,
      };
    }
    const l1 = yourDirectionLanes.lanes.find((l) => l.laneNumber === 1);
    const l2 = yourDirectionLanes.lanes.find((l) => l.laneNumber === 2);
    const hideMiddleLaneStats = middleSlotColor === 'red';
    return {
      lane1:
        l1 && !hideMiddleLaneStats
          ? { speedLine: formatLaneSpeed(l1), percentLine: formatLaneOccupancy(l1) }
          : null,
      lane2: l2 ? { speedLine: formatLaneSpeed(l2), percentLine: formatLaneOccupancy(l2) } : null,
    };
  }, [yourDirectionLanes, middleSlotColor]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    pushWidgetPayload(snapshot, effectivePerspective);
  }, [snapshot, effectivePerspective]);

  const delayDisplay = snapshot?.delay?.messageRaw
    ? sanitizeAtisPlainText(snapshot.delay.messageRaw)
    : null;

  const delayBanner =
    snapshot?.delay?.delayMinutes != null && snapshot.delay.delayMinutes > 0
      ? delayBannerStyle(snapshot.delay.delayMinutes)
      : 'none';
  const delayTrend = snapshot?.delay?.delayTrend;

  const approachHint = useMemo(() => {
    if (!snapshot || effectivePerspective === 'unknown') {
      return { kind: 'none' as const };
    }
    return computeApproachQueueHint(snapshot, effectivePerspective);
  }, [snapshot, effectivePerspective]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <YStack padding="$4" gap="$3" backgroundColor="#0a0a0a">
          <Text fontSize="$8" fontWeight="700" color="#fafafa">
            Lions Gate Bridge
          </Text>
          <Text opacity={0.75} color="#d4d4d8">
            ATIS status (client-side parse)
          </Text>

          {snapshot?.delay?.delayMinutes != null && snapshot.delay.delayMinutes > 0 ? (
            <YStack
              padding="$3"
              borderRadius="$4"
              backgroundColor="#000000"
              borderWidth={2}
              borderColor={delayBanner === 'red' ? '#dc2626' : '#eab308'}
              gap="$1"
            >
              <Text fontSize="$1" color="#a1a1aa" textTransform="uppercase">
                Bridge delay (DMS · all directions)
              </Text>
              <Text
                fontSize="$10"
                fontWeight="900"
                color={delayBanner === 'red' ? '#f87171' : '#facc15'}
              >
                {snapshot.delay.delayMinutes} MIN
              </Text>
              {delayTrend === 'down' && snapshot.delay.previousDelayMinutes != null ? (
                <Text fontSize="$2" color="#86efac">
                  ↓ from {snapshot.delay.previousDelayMinutes} min (improving)
                </Text>
              ) : null}
              {delayTrend === 'up' ? (
                <Text fontSize="$2" color="#d4d4d8">
                  {snapshot.delay.previousDelayMinutes != null
                    ? `Possible delay building up · ↑ from ${snapshot.delay.previousDelayMinutes} min`
                    : 'Possible delay building up'}
                </Text>
              ) : null}
            </YStack>
          ) : null}

          {approachHint.kind === 'possible_queue' ? (
            <YStack
              padding="$3"
              borderRadius="$4"
              backgroundColor="#1c1917"
              borderWidth={1}
              borderColor="#57534e"
              gap="$1"
            >
              <Text fontSize="$1" color="#a8a29e" textTransform="uppercase">
                Possible queue ahead
              </Text>
              <Text color="#fafaf9">{approachHint.message}</Text>
              <Text fontSize="$2" color="#a8a29e">
                Merge (south of Marine) ≈ {Math.round(approachHint.approachMeanKmh)} km/h · Bridge
                deck ≈ {Math.round(approachHint.bridgeMeanKmh)} km/h
              </Text>
            </YStack>
          ) : null}

          <YStack gap="$2">
            <Text fontWeight="600" color="#fafafa">
              Your lanes
            </Text>
            {threeLane ? (
              <ThreeLaneStrip
                middle={{
                  color: threeLane.middle.color,
                  greenHex: threeLane.middleGreenHex,
                }}
                rightGreenHex={threeLane.rightGreenHex}
                lane1UnderIcon={laneStatsUnderIcons.lane1}
                lane2UnderIcon={laneStatsUnderIcons.lane2}
              />
            ) : (
              <Text color="#a1a1aa">
                Open the app with location (or pick a side below) to see lanes.
              </Text>
            )}
            {threeLane ? (
              <Text fontSize="$2" opacity={0.85} color="#d4d4d8">
                Middle = lane 1 (reversible), right = lane 2 (default); numbers are for your
                direction of travel. Icon color still uses the worse of L1 vs L2 (
                {threeLane.middleLaneLabel}).
              </Text>
            ) : null}
          </YStack>

          <YStack gap="$2">
            <Text fontWeight="600" color="#fafafa">
              Perspective
            </Text>
            <Text color="#d4d4d8">
              Location:{' '}
              {locationPermission === null
                ? 'checking…'
                : locationPermission === Location.PermissionStatus.GRANTED
                  ? 'granted'
                  : locationPermission === Location.PermissionStatus.DENIED
                    ? 'denied'
                    : 'not granted'}
            </Text>
            {locationPermission === Location.PermissionStatus.GRANTED ? (
              <YStack gap="$1">
                <Text color="#d4d4d8">
                  Background (widget while away from app):{' '}
                  {backgroundLocationPermission === null
                    ? 'checking…'
                    : backgroundLocationPermission === Location.PermissionStatus.GRANTED
                      ? 'on'
                      : backgroundLocationPermission === Location.PermissionStatus.DENIED
                        ? 'denied'
                        : 'off'}
                </Text>
                {backgroundLocationPermission != null &&
                backgroundLocationPermission !== Location.PermissionStatus.GRANTED ? (
                  <Text color="#a1a1aa" fontSize="$2">
                    Choose “Always” (iOS) or “Allow all the time” (Android) so we keep getting your
                    location in the background—not only for the widget, but so your side of the
                    bridge stays current when you’re not in the app.
                  </Text>
                ) : null}
                {backgroundLocationPermission != null &&
                backgroundLocationPermission !== Location.PermissionStatus.GRANTED ? (
                  <XStack gap="$2" flexWrap="wrap">
                    <Button size="$3" onPress={() => void requestBackgroundLocation()}>
                      Enable background location
                    </Button>
                    <Button
                      size="$3"
                      onPress={() => {
                        void Linking.openSettings();
                      }}
                    >
                      Open Settings
                    </Button>
                  </XStack>
                ) : null}
              </YStack>
            ) : null}
            {showManualPerspectiveButtons ? (
              <YStack gap="$2">
                <XStack gap="$2" flexWrap="wrap">
                  <Button size="$3" onPress={() => setManualPerspective('downtown_vancouver')}>
                    Downtown view
                  </Button>
                  <Button size="$3" onPress={() => setManualPerspective('north_west_vancouver')}>
                    North / West view
                  </Button>
                </XStack>
                {locationPermission === Location.PermissionStatus.DENIED ? (
                  <XStack gap="$2" flexWrap="wrap">
                    <Button
                      size="$3"
                      onPress={() => {
                        void pullLocationPermissionAndGeo(true);
                      }}
                    >
                      Ask for location again
                    </Button>
                    <Button
                      size="$3"
                      onPress={() => {
                        void Linking.openSettings();
                      }}
                    >
                      Open Settings
                    </Button>
                  </XStack>
                ) : null}
                {locationPermission === Location.PermissionStatus.UNDETERMINED ? (
                  <XStack gap="$2" flexWrap="wrap">
                    <Button
                      size="$3"
                      onPress={() => {
                        void pullLocationPermissionAndGeo(true);
                      }}
                    >
                      Try permission prompt again
                    </Button>
                    <Button
                      size="$3"
                      onPress={() => {
                        void Linking.openSettings();
                      }}
                    >
                      Open Settings
                    </Button>
                  </XStack>
                ) : null}
              </YStack>
            ) : null}
            <Text color="#d4d4d8">
              Active perspective:{' '}
              {effectivePerspective === 'unknown' ? 'not set' : presentation?.perspectiveLabel}
            </Text>
          </YStack>

          <YStack gap="$2">
            <Text fontWeight="600" color="#fafafa">
              Delay
            </Text>
            <Text color="#d4d4d8">
              {snapshot?.delay?.delayMinutes != null
                ? `${snapshot.delay.delayMinutes} min`
                : 'No numeric delay detected'}
            </Text>
            {delayDisplay ? (
              <Text opacity={0.9} color="#e4e4e7" numberOfLines={6}>
                {delayDisplay}
              </Text>
            ) : null}
          </YStack>

          <YStack gap="$2">
            <Text fontWeight="600" color="#fafafa">
              Data freshness
            </Text>
            <Text color="#d4d4d8">
              Last update (source):{' '}
              {formatAtisLastUpdateForDisplay(snapshot?.refresh.lastUpdated ?? null)}
            </Text>
            <Text color="#a1a1aa" fontSize="$2">
              Fetched at:{' '}
              {snapshot?.refresh.fetchedAt
                ? formatVancouverFromIso(snapshot.refresh.fetchedAt)
                : '—'}
            </Text>
            <Text color="#a1a1aa" fontSize="$2">
              While this screen is open, data refetches about every{' '}
              {Math.round(ATIS_POLL_INTERVAL_MS / 60000)} min (same fetch updates the home screen
              widget when the app runs).
            </Text>
            <Text color={snapshot?.refresh.isStale ? '#f87171' : '#4ade80'}>
              {snapshot?.refresh.isStale
                ? `Stale: ${snapshot.refresh.staleReason ?? 'yes'}`
                : 'Fresh'}
            </Text>
            <Text color="#a1a1aa">Bridge mode: {snapshot?.bridgeMode ?? '—'}</Text>
            {snapshot ? (
              <Text color="#a1a1aa" fontSize="$2">
                Lane health uses VDS {snapshot.towardDowntown.vdsId} (SB) and{' '}
                {snapshot.towardNorthShore.vdsId} (NB) at the north end of the causeway (ATIS-02).
                L1 = reversible middle, L2 = default. Other VDS blocks use their own lane numbering.
              </Text>
            ) : null}
          </YStack>

          <XStack gap="$2" alignItems="center">
            {loading ? <Spinner /> : null}
            <Button
              disabled={loading}
              onPress={() => {
                void runRefresh({ silent: false });
              }}
            >
              Refresh
            </Button>
          </XStack>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type HealthSummary = {
  steps: number;
  activeCaloriesKcal: number;
  heartRateBpm: number | null;
  sleepMinutes: number;
};

export type HealthConnectState = {
  status: 'unsupported' | 'checking' | 'needs-install' | 'needs-update' | 'needs-permission' | 'ready' | 'error';
  error: string | null;
  summary: HealthSummary | null;
  requestAccess: () => Promise<void>;
  refresh: () => Promise<void>;
};

const PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
] as const;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function readRecordsOrEmpty<T extends 'Steps' | 'ActiveCaloriesBurned' | 'HeartRate' | 'SleepSession'>(
  recordType: T,
  timeRangeFilter: { operator: 'between'; startTime: string; endTime: string }
) {
  try {
    return await readRecords(recordType, { timeRangeFilter });
  } catch (e) {
    console.error(`[HealthConnect] readRecords(${recordType}) failed, missing permission?`, e);
    return { records: [] } as Awaited<ReturnType<typeof readRecords<T>>>;
  }
}

async function fetchSummary(): Promise<HealthSummary> {
  const timeRangeFilter = {
    operator: 'between',
    startTime: startOfToday().toISOString(),
    endTime: new Date().toISOString(),
  } as const;

  const [stepsRes, caloriesRes, heartRateRes, sleepRes] = await Promise.all([
    readRecordsOrEmpty('Steps', timeRangeFilter),
    readRecordsOrEmpty('ActiveCaloriesBurned', timeRangeFilter),
    readRecordsOrEmpty('HeartRate', timeRangeFilter),
    readRecordsOrEmpty('SleepSession', timeRangeFilter),
  ]);

  const steps = stepsRes.records.reduce((sum, r) => sum + r.count, 0);

  const activeCaloriesKcal = caloriesRes.records.reduce(
    (sum, r) => sum + r.energy.inKilocalories,
    0
  );

  const heartRateSamples = heartRateRes.records.flatMap((r) => r.samples);
  const heartRateBpm = heartRateSamples.length
    ? Math.round(
        heartRateSamples.reduce((sum, s) => sum + s.beatsPerMinute, 0) / heartRateSamples.length
      )
    : null;

  const sleepMinutes = sleepRes.records.reduce((sum, r) => {
    const start = new Date(r.startTime).getTime();
    const end = new Date(r.endTime).getTime();
    return sum + (end - start) / 60000;
  }, 0);

  return { steps, activeCaloriesKcal, heartRateBpm, sleepMinutes: Math.round(sleepMinutes) };
}

export function useHealthConnect(): HealthConnectState {
  const [status, setStatus] = useState<HealthConnectState['status']>(
    Platform.OS === 'android' ? 'checking' : 'unsupported'
  );
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HealthSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSummary();
      setSummary(data);
      setStatus('ready');
    } catch (e) {
      console.error('[HealthConnect] refresh failed', e);
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, []);

  const requestAccess = useCallback(async () => {
    try {
      const granted = await requestPermission([...PERMISSIONS]);
      console.log('[HealthConnect] granted permissions', granted);
      if (granted.length === 0) {
        setStatus('needs-permission');
        return;
      }
      await refresh();
    } catch (e) {
      console.error('[HealthConnect] requestAccess failed', e);
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [refresh]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    (async () => {
      try {
        const sdkStatus = await getSdkStatus();

        if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
          setStatus('unsupported');
          return;
        }
        if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
          setStatus('needs-install');
          return;
        }

        await initialize();
        setStatus('needs-permission');
      } catch (e) {
        console.error('[HealthConnect] init failed', e);
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
  }, []);

  return { status, error, summary, requestAccess, refresh };
}

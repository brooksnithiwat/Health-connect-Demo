import { useCallback, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openHealthConnectSettings } from 'react-native-health-connect';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useHealthConnect } from '@/hooks/use-health-connect';
import { useTheme } from '@/hooks/use-theme';

function MetricCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        {unit}
      </ThemedText>
    </ThemedView>
  );
}

export default function HealthScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const { status, error, summary, requestAccess, refresh } = useHealthConnect();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
      refreshControl={
        status === 'ready' ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">Health</ThemedText>
          <ThemedText style={styles.centerText} themeColor="textSecondary">
            ข้อมูลสุขภาพที่ซิงค์เข้า Health Connect จากแอปสมาร์ทวอทช์ของคุณ{'\n'}
            (Samsung Health, Fitbit, Garmin, Wear OS และอื่นๆ)
          </ThemedText>
        </ThemedView>

        {status === 'unsupported' && (
          <ThemedView style={styles.sectionsWrapper}>
            <ThemedText style={styles.centerText}>
              {Platform.OS === 'android'
                ? 'อุปกรณ์นี้ไม่รองรับ Health Connect'
                : 'Health Connect ใช้ได้เฉพาะ Android เท่านั้น'}
            </ThemedText>
          </ThemedView>
        )}

        {status === 'checking' && (
          <ThemedView style={styles.sectionsWrapper}>
            <ThemedText style={styles.centerText}>กำลังตรวจสอบ Health Connect…</ThemedText>
          </ThemedView>
        )}

        {status === 'needs-install' && (
          <ThemedView style={styles.sectionsWrapper}>
            <ThemedText style={styles.centerText}>
              ต้องติดตั้งหรืออัปเดตแอป Health Connect ก่อน
            </ThemedText>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={() => openHealthConnectSettings()}>
              <ThemedText style={styles.buttonText}>เปิด Health Connect</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {status === 'needs-permission' && (
          <ThemedView style={styles.sectionsWrapper}>
            <ThemedText style={styles.centerText}>
              ขออนุญาตอ่านข้อมูลก้าวเดิน, อัตราการเต้นหัวใจ, การนอน และแคลอรี่
            </ThemedText>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={requestAccess}>
              <ThemedText style={styles.buttonText}>เชื่อมต่อ Health Connect</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {status === 'error' && (
          <ThemedView style={styles.sectionsWrapper}>
            <ThemedText style={styles.centerText} themeColor="textSecondary">
              เกิดข้อผิดพลาด: {error}
            </ThemedText>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={requestAccess}>
              <ThemedText style={styles.buttonText}>ลองอีกครั้ง</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {status === 'ready' && summary && (
          <ThemedView style={styles.grid}>
            <MetricCard label="ก้าวเดินวันนี้" value={summary.steps.toLocaleString()} unit="ก้าว" />
            <MetricCard
              label="แคลอรี่ที่เผาผลาญ"
              value={summary.activeCaloriesKcal.toFixed(0)}
              unit="kcal"
            />
            <MetricCard
              label="อัตราการเต้นหัวใจเฉลี่ย"
              value={summary.heartRateBpm?.toString() ?? '—'}
              unit="bpm"
            />
            <MetricCard
              label="การนอน (คืนล่าสุด)"
              value={Math.round(summary.sleepMinutes / 60).toString()}
              unit="ชั่วโมง"
            />
          </ThemedView>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  },
  titleContainer: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  primaryButton: {
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
  },
  sectionsWrapper: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  card: {
    width: 150,
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});

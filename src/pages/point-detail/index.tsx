import React, { useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import DeviceItem from '@/components/DeviceItem';
import { calcCompletionRate, showToast } from '@/utils';
import styles from './index.module.scss';

const PointDetailPage: React.FC = () => {
  const router = useRouter();
  const { routes, setCurrentRoute } = useInspectionStore();
  const pointId = router.params.pointId;
  const routeId = router.params.routeId;

  useDidShow(() => {
    console.log('[PointDetail] 页面显示', pointId, routeId);
  });

  const point = useMemo(() => {
    const route = routes.find(r => r.id === routeId);
    return route?.points.find(p => p.id === pointId);
  }, [routes, pointId, routeId]);

  const completionRate = point ? calcCompletionRate(point.checkedDevices, point.totalDevices) : 0;

  const handleStartInspect = () => {
    if (routeId) {
      setCurrentRoute(routeId);
    }
    Taro.switchTab({ url: '/pages/scan/index' });
  };

  const handleReportFault = () => {
    Taro.switchTab({ url: '/pages/fault/index' });
  };

  if (!point) {
    return (
      <View className={styles.page}>
        <View style={{ padding: 100, textAlign: 'center' }}>
          <Text>点位不存在</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.pointName}>{point.name}</Text>
        <Text className={styles.pointLocation}>{point.building} · {point.floor} · {point.type}</Text>
        <View className={styles.statsRow}>
          <StatCard label="设备总数" value={point.totalDevices} unit="台" />
          <StatCard label="已巡检" value={point.checkedDevices} unit="台" />
          <StatCard label="完成率" value={completionRate} unit="%" highlight />
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>点位信息</Text>
        <View className={styles.infoCard}>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>点位名称</Text>
            <Text className={styles.infoValue}>{point.name}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>点位类型</Text>
            <Text className={styles.infoValue}>{point.type}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>所在楼栋</Text>
            <Text className={styles.infoValue}>{point.building}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>所在楼层</Text>
            <Text className={styles.infoValue}>{point.floor}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>巡检顺序</Text>
            <Text className={styles.infoValue}>第 {point.order} 个点位</Text>
          </View>
        </View>

        <Text className={styles.sectionTitle}>设备清单</Text>
        {point.devices.map(device => (
          <DeviceItem
            key={device.id}
            device={device}
            pointId={point.id}
            onScan={() => {
              if (routeId) setCurrentRoute(routeId);
              Taro.switchTab({ url: '/pages/scan/index' });
            }}
          />
        ))}
      </View>

      <View className={styles.bottomBar}>
        <View className={styles.secondaryBtn} onClick={handleReportFault}>
          故障上报
        </View>
        <View className={styles.primaryBtn} onClick={handleStartInspect}>
          开始巡检
        </View>
      </View>
    </ScrollView>
  );
};

export default PointDetailPage;

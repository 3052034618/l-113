import React, { useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useInspectionStore } from '@/store/inspection';
import StatusTag from '@/components/StatusTag';
import { formatTime, showToast } from '@/utils';
import styles from './index.module.scss';

const DeviceDetailPage: React.FC = () => {
  const router = useRouter();
  const { routes, scanRecords, currentRouteId, setCurrentRoute } = useInspectionStore();
  const deviceId = router.params.deviceId;
  const pointId = router.params.pointId;

  useDidShow(() => {
    console.log('[DeviceDetail] 页面显示', deviceId, pointId);
  });

  const device = useMemo(() => {
    for (const route of routes) {
      for (const point of route.points) {
        const found = point.devices.find(d => d.id === deviceId);
        if (found) return found;
      }
    }
    return null;
  }, [routes, deviceId]);

  const deviceRecords = useMemo(() => {
    return scanRecords.filter(r => r.deviceId === deviceId).slice(0, 10);
  }, [scanRecords, deviceId]);

  const handleScan = () => {
    if (currentRouteId) {
      Taro.switchTab({ url: '/pages/scan/index' });
    } else {
      showToast('请先领取巡检路线');
    }
  };

  const handleReportFault = () => {
    Taro.switchTab({ url: '/pages/fault/index' });
  };

  if (!device) {
    return (
      <View className={styles.page}>
        <View style={{ padding: 100, textAlign: 'center' }}>
          <Text>设备不存在</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <View className={styles.deviceIcon}>
          <Text className={styles.deviceIconText}>{device.category.charAt(0)}</Text>
        </View>
        <View className={styles.deviceInfo}>
          <Text className={styles.deviceName}>{device.name}</Text>
          <Text className={styles.deviceCode}>资产编号：{device.assetCode}</Text>
        </View>
        <StatusTag type="inspection" status={device.status} />
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>设备信息</Text>
        <View className={styles.infoCard}>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>设备名称</Text>
            <Text className={styles.infoValue}>{device.name}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>资产编号</Text>
            <Text className={styles.infoValue}>{device.assetCode}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>设备类别</Text>
            <Text className={styles.infoValue}>{device.category}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>设备型号</Text>
            <Text className={styles.infoValue}>{device.model}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>安装位置</Text>
            <Text className={styles.infoValue}>{device.location}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>当前状态</Text>
            <View className={styles.infoValue}>
              <StatusTag type="inspection" status={device.status} />
            </View>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>上次巡检</Text>
            <Text className={styles.infoValue}>
              {device.lastCheckTime ? formatTime(device.lastCheckTime) : '未巡检'}
            </Text>
          </View>
        </View>

        <Text className={styles.sectionTitle}>巡检记录</Text>
        {deviceRecords.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📋</Text>
            <Text className={styles.emptyText}>暂无巡检记录</Text>
          </View>
        ) : (
          deviceRecords.map(record => (
            <View key={record.id} className={styles.recordItem}>
              <View className={styles.recordHeader}>
                <StatusTag type="inspection" status={record.status} />
                <Text className={styles.recordTime}>{formatTime(record.scanTime)}</Text>
              </View>
              {record.remark && (
                <Text className={styles.recordRemark}>备注：{record.remark}</Text>
              )}
              <Text style={{ fontSize: 22, color: '#86909c', marginTop: 4 }}>
                巡检员：{record.inspectorName}
              </Text>
            </View>
          ))
        )}
      </View>

      <View className={styles.bottomBar}>
        <View className={styles.secondaryBtn} onClick={handleReportFault}>
          故障上报
        </View>
        <View className={styles.primaryBtn} onClick={handleScan}>
          扫码巡检
        </View>
      </View>
    </ScrollView>
  );
};

export default DeviceDetailPage;

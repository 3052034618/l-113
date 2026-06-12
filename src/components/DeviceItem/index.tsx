import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { AssetDevice } from '@/types/inspection';
import StatusTag from '@/components/StatusTag';
import { formatTime } from '@/utils';
import styles from './index.module.scss';

interface DeviceItemProps {
  device: AssetDevice;
  pointId: string;
  showScanButton?: boolean;
  onScan?: () => void;
}

const DeviceItem: React.FC<DeviceItemProps> = ({ device, pointId, showScanButton = true, onScan }) => {
  const handleClick = () => {
    Taro.navigateTo({
      url: `/pages/device-detail/index?deviceId=${device.id}&pointId=${pointId}`
    });
  };

  const handleScan = (e: any) => {
    e.stopPropagation();
    if (onScan) {
      onScan();
    } else {
      Taro.switchTab({ url: '/pages/scan/index' });
    }
  };

  return (
    <View className={styles.item} onClick={handleClick}>
      <View className={styles.icon}>
        <Text className={styles.iconText}>{device.category.charAt(0)}</Text>
      </View>

      <View className={styles.content}>
        <View className={styles.topRow}>
          <Text className={styles.name}>{device.name}</Text>
          <StatusTag type="inspection" status={device.status} />
        </View>
        <Text className={styles.code}>资产编号：{device.assetCode}</Text>
        <Text className={styles.model}>型号：{device.model}</Text>
        {device.lastCheckTime && (
          <Text className={styles.lastCheck}>上次巡检：{formatTime(device.lastCheckTime)}</Text>
        )}
      </View>

      {showScanButton && (
        <View className={styles.scanBtn} onClick={handleScan}>
          <Text className={styles.scanText}>扫码</Text>
        </View>
      )}
    </View>
  );
};

export default DeviceItem;

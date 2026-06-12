import React from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { FaultReport } from '@/types/inspection';
import StatusTag from '@/components/StatusTag';
import ProgressBar from '@/components/ProgressBar';
import { formatTime } from '@/utils';
import styles from './index.module.scss';

interface FaultCardProps {
  fault: FaultReport;
  onClick?: () => void;
}

const FaultCard: React.FC<FaultCardProps> = ({ fault, onClick }) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      Taro.navigateTo({
        url: `/pages/fault-detail/index?id=${fault.id}`
      });
    }
  };

  return (
    <View className={styles.card} onClick={handleClick}>
      <View className={styles.header}>
        <View className={styles.titleRow}>
          <Text className={styles.deviceName}>{fault.deviceName}</Text>
          <StatusTag type="urgency" status={fault.urgency} />
        </View>
        <Text className={styles.assetCode}>{fault.assetCode}</Text>
      </View>

      <View className={styles.description}>
        <Text className={styles.descText}>{fault.description}</Text>
      </View>

      {fault.photos.length > 0 && (
        <View className={styles.photos}>
          {fault.photos.slice(0, 3).map((photo, idx) => (
            <Image
              key={idx}
              src={photo}
              mode="aspectFill"
              className={styles.photo}
            />
          ))}
        </View>
      )}

      <View className={styles.metaRow}>
        <Text className={styles.location}>{fault.pointName}</Text>
        <Text className={styles.time}>{formatTime(fault.reportTime)}</Text>
      </View>

      <View className={styles.footer}>
        <View className={styles.footerLeft}>
          <StatusTag type="rectify" status={fault.rectifyStatus} />
          {fault.assigneeName && (
            <Text className={styles.assignee}>负责人：{fault.assigneeName}</Text>
          )}
        </View>
        <View className={styles.progressWrap}>
          <ProgressBar progress={fault.rectifyProgress} height={6} showLabel={false} />
        </View>
      </View>
    </View>
  );
};

export default FaultCard;

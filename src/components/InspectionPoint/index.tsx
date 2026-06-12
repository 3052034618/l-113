import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import type { InspectionPoint as InspectionPointType } from '@/types/inspection';
import { calcCompletionRate } from '@/utils';
import ProgressBar from '@/components/ProgressBar';
import styles from './index.module.scss';

interface InspectionPointProps {
  point: InspectionPointType;
  routeId: string;
  onClick?: () => void;
}

const InspectionPointCard: React.FC<InspectionPointProps> = ({ point, routeId, onClick }) => {
  const completionRate = calcCompletionRate(point.checkedDevices, point.totalDevices);
  const isCompleted = completionRate === 100;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      Taro.navigateTo({
        url: `/pages/point-detail/index?pointId=${point.id}&routeId=${routeId}`
      });
    }
  };

  return (
    <View className={styles.card} onClick={handleClick}>
      <View className={styles.header}>
        <View className={styles.orderBadge}>
          <Text className={styles.orderText}>{point.order}</Text>
        </View>
        <View className={styles.info}>
          <Text className={styles.name}>{point.name}</Text>
          <Text className={styles.location}>{point.building} · {point.floor}</Text>
        </View>
        <View className={classnames(styles.statusBadge, isCompleted && styles.completed)}>
          <Text className={styles.statusText}>{isCompleted ? '已完成' : '巡检中'}</Text>
        </View>
      </View>

      <View className={styles.typeTag}>
        <Text className={styles.typeText}>{point.type}</Text>
      </View>

      <View className={styles.progressSection}>
        <View className={styles.progressLabel}>
          <Text className={styles.progressText}>
            设备 {point.checkedDevices}/{point.totalDevices}
          </Text>
        </View>
        <ProgressBar progress={completionRate} height={6} />
      </View>
    </View>
  );
};

export default InspectionPointCard;

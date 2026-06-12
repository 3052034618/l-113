import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';

interface ProgressBarProps {
  progress: number;
  showLabel?: boolean;
  height?: number;
  color?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showLabel = true,
  height = 8,
  color
}) => {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const barColor = color || (safeProgress >= 100 ? '#00b42a' : safeProgress >= 60 ? '#165dff' : '#ff7d00');

  return (
    <View className={styles.container}>
      <View className={styles.track} style={{ height: `${height}rpx` }}>
        <View
          className={styles.fill}
          style={{
            width: `${safeProgress}%`,
            height: `${height}rpx`,
            backgroundColor: barColor
          }}
        />
      </View>
      {showLabel && (
        <Text className={styles.label}>{safeProgress}%</Text>
      )}
    </View>
  );
};

export default ProgressBar;

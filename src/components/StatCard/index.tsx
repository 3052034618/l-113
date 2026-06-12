import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';

interface StatCardProps {
  label: string;
  value: number | string;
  unit?: string;
  color?: string;
  highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, color, highlight }) => {
  return (
    <View className={highlight ? styles.cardHighlight : styles.card}>
      <Text className={styles.value} style={{ color: color || '#1d2129' }}>
        {value}
        {unit && <Text className={styles.unit}>{unit}</Text>}
      </Text>
      <Text className={styles.label}>{label}</Text>
    </View>
  );
};

export default StatCard;

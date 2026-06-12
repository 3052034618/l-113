import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import type { InspectionStatus, UrgencyLevel, RectifyStatus } from '@/types/inspection';
import { getStatusText, getUrgencyText, getRectifyStatusText } from '@/utils';
import styles from './index.module.scss';

interface StatusTagProps {
  type: 'inspection' | 'urgency' | 'rectify';
  status: InspectionStatus | UrgencyLevel | RectifyStatus;
}

const StatusTag: React.FC<StatusTagProps> = ({ type, status }) => {
  let text = '';
  let className = '';

  if (type === 'inspection') {
    text = getStatusText(status as InspectionStatus);
    className = classnames(styles.tag, {
      [styles.statusNormal]: status === 'normal',
      [styles.statusAbnormal]: status === 'abnormal',
      [styles.statusMissing]: status === 'missing',
      [styles.statusDisabled]: status === 'disabled'
    });
  } else if (type === 'urgency') {
    text = getUrgencyText(status as UrgencyLevel);
    className = classnames(styles.tag, {
      [styles.urgencyHigh]: status === 'high',
      [styles.urgencyMedium]: status === 'medium',
      [styles.urgencyLow]: status === 'low'
    });
  } else if (type === 'rectify') {
    text = getRectifyStatusText(status as RectifyStatus);
    className = classnames(styles.tag, {
      [styles.rectifyPending]: status === 'pending',
      [styles.rectifyProcessing]: status === 'processing',
      [styles.rectifyCompleted]: status === 'completed',
      [styles.rectifyRecheck]: status === 'recheck'
    });
  }

  return (
    <View className={className}>
      <Text className={styles.text}>{text}</Text>
    </View>
  );
};

export default StatusTag;

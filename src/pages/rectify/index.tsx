import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import StatusTag from '@/components/StatusTag';
import ProgressBar from '@/components/ProgressBar';
import { formatTime, showToast } from '@/utils';
import type { FaultReport } from '@/types/inspection';
import styles from './index.module.scss';

const RectifyPage: React.FC = () => {
  const { faultReports, recheckFault, updateFaultProgress, assignFault, maintainers, getTodayStats } = useInspectionStore();
  const todayStats = getTodayStats();

  useDidShow(() => {
    console.log('[Rectify] 页面显示');
  });

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  });

  const recheckList = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'recheck'), [faultReports]);
  const processingList = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'processing'), [faultReports]);
  const pendingList = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'pending'), [faultReports]);

  const handleRecheck = async (fault: FaultReport) => {
    const res = await Taro.showActionSheet({
      itemList: ['复检通过', '需重新整改']
    });
    if (res.tapIndex === 0) {
      recheckFault(fault.id, 'pass');
    } else if (res.tapIndex === 1) {
      recheckFault(fault.id, 'fail');
    }
  };

  const handleUpdateProgress = async (fault: FaultReport) => {
    const res = await Taro.showActionSheet({
      itemList: ['25% - 已开始', '50% - 进行中', '75% - 即将完成', '100% - 整改完成']
    });
    const progressValues = [25, 50, 75, 100];
    const progress = progressValues[res.tapIndex];
    const status = progress === 100 ? 'recheck' : 'processing';
    const remark = progress === 100 ? '整改完成，待复检' : `整改进度 ${progress}%`;
    updateFaultProgress(fault.id, progress, status, remark);
    showToast('进度已更新', 'success');
  };

  const handleAssign = async (fault: FaultReport) => {
    const names = maintainers.map(m => m.name);
    const res = await Taro.showActionSheet({ itemList: names });
    const selected = maintainers[res.tapIndex];
    assignFault(fault.id, selected.id, selected.name);
  };

  const renderFaultItem = (fault: FaultReport) => (
    <View key={fault.id} className={styles.faultItem}>
      <View className={styles.faultHeader}>
        <Text className={styles.faultTitle}>{fault.deviceName}</Text>
        <StatusTag type="rectify" status={fault.rectifyStatus} />
      </View>
      <Text className={styles.faultMeta}>
        {fault.pointName} · {formatTime(fault.reportTime)}
      </Text>
      <Text className={styles.faultDesc}>{fault.description}</Text>

      <View className={styles.progressSection}>
        <View className={styles.progressLabel}>
          <Text className={styles.progressText}>整改进度</Text>
          <Text className={styles.progressPercent}>{fault.rectifyProgress}%</Text>
        </View>
        <ProgressBar progress={fault.rectifyProgress} height={8} showLabel={false} />
      </View>

      {fault.rectifyRemark && (
        <Text className={styles.faultDesc} style={{ color: '#165dff' }}>
          📝 {fault.rectifyRemark}
        </Text>
      )}

      <View className={styles.faultFooter}>
        <View className={styles.assigneeInfo}>
          {fault.assigneeName ? (
            <>
              <View className={styles.assigneeAvatar}>
                <Text className={styles.assigneeAvatarText}>{fault.assigneeName.charAt(0)}</Text>
              </View>
              <Text className={styles.assigneeName}>{fault.assigneeName}</Text>
            </>
          ) : (
            <Text className={styles.assigneeName} style={{ color: '#86909c' }}>未指派</Text>
          )}
        </View>
        <View style={{ display: 'flex' }}>
          {!fault.assigneeName && (
            <View className={styles.actionBtnSecondary} onClick={() => handleAssign(fault)}>
              指派
            </View>
          )}
          {fault.rectifyStatus === 'recheck' ? (
            <View className={styles.actionBtn} onClick={() => handleRecheck(fault)}>
              复检
            </View>
          ) : fault.rectifyStatus !== 'completed' && (
            <View className={styles.actionBtn} onClick={() => handleUpdateProgress(fault)}>
              更新
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>整改跟踪</Text>
        <Text className={styles.headerSubtitle}>实时追踪故障处理进度与复检状态</Text>
        <View className={styles.statsRow}>
          <StatCard label="待复检" value={recheckList.length} unit="项" />
          <StatCard label="处理中" value={processingList.length} unit="项" />
          <StatCard label="已完成" value={todayStats?.completedFaultCount || 0} unit="项" highlight />
        </View>
      </View>

      {recheckList.length > 0 && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>🔔 待复检提醒</Text>
          {recheckList.map(fault => (
            <View key={fault.id} className={styles.noticeCard}>
              <View className={styles.noticeHeader}>
                <Text className={styles.noticeIcon}>⚠️</Text>
                <Text className={styles.noticeTitle}>{fault.deviceName} 整改完成待复检</Text>
              </View>
              <Text className={styles.noticeContent}>
                整改说明：{fault.rectifyRemark || '暂无说明'}
              </Text>
              <Text className={styles.noticeAction} onClick={() => handleRecheck(fault)}>
                点击进行复检 →
              </Text>
            </View>
          ))}
        </View>
      )}

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>进行中的整改</Text>
        {processingList.length === 0 && pendingList.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>✅</Text>
            <Text className={styles.emptyText}>暂无进行中的整改</Text>
          </View>
        ) : (
          <>
            {processingList.map(renderFaultItem)}
            {pendingList.map(renderFaultItem)}
          </>
        )}
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>整改时间线示例</Text>
        <View className={styles.timelineSection}>
          <View className={styles.timelineItem}>
            <View className={styles.timelineDot} />
            <View className={styles.timelineContent}>
              <Text className={styles.timelineTitle}>故障上报</Text>
              <Text className={styles.timelineDesc}>巡检员发现空调运行异响</Text>
              <Text className={styles.timelineTime}>2026-06-12 08:55</Text>
            </View>
          </View>
          <View className={styles.timelineItem}>
            <View className={styles.timelineDot} />
            <View className={styles.timelineContent}>
              <Text className={styles.timelineTitle}>指派维修</Text>
              <Text className={styles.timelineDesc}>已指派李师傅负责维修</Text>
              <Text className={styles.timelineTime}>2026-06-12 09:10</Text>
            </View>
          </View>
          <View className={styles.timelineItem}>
            <View className={styles.timelineDot} />
            <View className={styles.timelineContent}>
              <Text className={styles.timelineTitle}>维修中</Text>
              <Text className={styles.timelineDesc}>已联系厂家，配件预计下午到货</Text>
              <Text className={styles.timelineTime}>2026-06-12 10:30</Text>
            </View>
          </View>
          <View className={styles.timelineItem}>
            <View className={styles.timelineDot} style={{ backgroundColor: '#ff7d00' }} />
            <View className={styles.timelineContent}>
              <Text className={styles.timelineTitle}>待复检</Text>
              <Text className={styles.timelineDesc}>整改完成，等待巡检员复检</Text>
              <Text className={styles.timelineTime}>进行中</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default RectifyPage;

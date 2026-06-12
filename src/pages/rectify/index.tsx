import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import StatusTag from '@/components/StatusTag';
import ProgressBar from '@/components/ProgressBar';
import { formatTime, showToast, isFaultTimeout, getUrgencyText } from '@/utils';
import type { FaultReport, UrgencyLevel } from '@/types/inspection';
import styles from './index.module.scss';

const RectifyPage: React.FC = () => {
  const { faultReports, recheckFault, updateFaultProgress, assignFault, maintainers, getTodayStats } = useInspectionStore();
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'processing' | 'recheck'>('all');
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
  const timeoutList = useMemo(() => faultReports.filter(f => isFaultTimeout(f)), [faultReports]);

  const displayList = useMemo(() => {
    switch (activeTab) {
      case 'pending': return pendingList;
      case 'processing': return processingList;
      case 'recheck': return recheckList;
      default: return [...pendingList, ...processingList, ...recheckList];
    }
  }, [activeTab, pendingList, processingList, recheckList]);

  const handleRecheck = async (fault: FaultReport) => {
    const res = await Taro.showActionSheet({
      itemList: ['复检通过', '需重新整改']
    });
    if (res.tapIndex === 0) {
      recheckFault(fault.id, 'pass');
      showToast('复检通过', 'success');
    } else if (res.tapIndex === 1) {
      recheckFault(fault.id, 'fail');
      showToast('已退回重新整改', 'none');
    }
  };

  const handleUpdateProgress = async (fault: FaultReport) => {
    const res = await Taro.showActionSheet({
      itemList: ['25% - 已开始', '50% - 进行中', '75% - 即将完成', '100% - 整改完成']
    });
    const progressValues = [25, 50, 75, 100];
    const progress = progressValues[res.tapIndex];
    let status = 'processing' as const;
    let remark = `整改进度 ${progress}%`;

    if (progress === 100) {
      if (fault.recheckRequired) {
        status = 'recheck';
        remark = '整改完成，待复检';
      } else {
        status = 'completed';
        remark = '整改完成';
      }
    }

    updateFaultProgress(fault.id, progress, status, remark);
    showToast('进度已更新', 'success');
  };

  const handleAssign = async (fault: FaultReport) => {
    const names = maintainers.map(m => m.name);
    const res = await Taro.showActionSheet({ itemList: names });
    const selected = maintainers[res.tapIndex];
    assignFault(fault.id, selected.id, selected.name);
  };

  const getUrgencyColor = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'high': return '#f53f3f';
      case 'medium': return '#ff7d00';
      case 'low': return '#165dff';
    }
  };

  const renderFaultItem = (fault: FaultReport) => {
    const isTimeout = isFaultTimeout(fault);
    return (
      <View key={fault.id} className={classnames(styles.faultItem, isTimeout && styles.faultItemTimeout)}>
        <View className={styles.faultHeader}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text className={styles.faultTitle}>{fault.deviceName}</Text>
            <View className={styles.faultUrgencyRow}>
              <View
                className={styles.urgencyDot}
                style={{ backgroundColor: getUrgencyColor(fault.urgency) }}
              />
              <Text className={styles.urgencyText} style={{ color: getUrgencyColor(fault.urgency) }}>
                {getUrgencyText(fault.urgency)}
              </Text>
              {isTimeout && (
                <Text className={styles.timeoutBadge}>超时</Text>
              )}
            </View>
          </View>
          <StatusTag type="rectify" status={fault.rectifyStatus} />
        </View>
        <Text className={styles.faultMeta}>
          {fault.pointName} · {formatTime(fault.reportTime)}
        </Text>
        <Text className={styles.faultDesc}>{fault.description}</Text>

        {fault.rectifyStatus !== 'pending' && (
          <View className={styles.progressSection}>
            <View className={styles.progressLabel}>
              <Text className={styles.progressText}>整改进度</Text>
              <Text className={styles.progressPercent}>{fault.rectifyProgress}%</Text>
            </View>
            <ProgressBar progress={fault.rectifyProgress} height={8} showLabel={false} />
          </View>
        )}

        {fault.rectifyRemark && (
          <Text className={styles.faultRemark}>
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
            {!fault.assigneeName && fault.rectifyStatus === 'pending' && (
              <View className={styles.actionBtnSecondary} onClick={() => handleAssign(fault)}>
                指派
              </View>
            )}
            {fault.rectifyStatus === 'recheck' ? (
              <View className={styles.actionBtn} onClick={() => handleRecheck(fault)}>
                复检
              </View>
            ) : fault.rectifyStatus !== 'completed' && fault.assigneeName && (
              <View className={styles.actionBtn} onClick={() => handleUpdateProgress(fault)}>
                更新
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const tabOptions = [
    { key: 'all' as const, label: '全部', count: pendingList.length + processingList.length + recheckList.length },
    { key: 'pending' as const, label: '待处理', count: pendingList.length },
    { key: 'processing' as const, label: '处理中', count: processingList.length },
    { key: 'recheck' as const, label: '待复检', count: recheckList.length }
  ];

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>整改跟踪</Text>
        <Text className={styles.headerSubtitle}>实时追踪故障处理进度与复检状态</Text>
        <View className={styles.statsRow}>
          <StatCard label="待处理" value={pendingList.length} unit="项" />
          <StatCard label="处理中" value={processingList.length} unit="项" />
          <StatCard label="超时" value={timeoutList.length} unit="项" highlight />
        </View>
      </View>

      {recheckList.length > 0 && (
        <View className={styles.section}>
          <View className={styles.noticeSection}>
            <Text className={styles.noticeSectionTitle}>🔔 待复检提醒</Text>
            {recheckList.map(fault => (
              <View key={fault.id} className={styles.noticeCard} onClick={() => handleRecheck(fault)}>
                <View className={styles.noticeHeader}>
                  <Text className={styles.noticeIcon}>⚠️</Text>
                  <Text className={styles.noticeTitle}>{fault.deviceName} 整改完成待复检</Text>
                </View>
                <Text className={styles.noticeContent}>
                  整改说明：{fault.rectifyRemark || '暂无说明'}
                </Text>
                <Text className={styles.noticeAction}>
                  点击进行复检 →
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className={styles.section}>
        <View className={styles.tabBar}>
          {tabOptions.map(opt => (
            <View
              key={opt.key}
              className={classnames(styles.tabItem, activeTab === opt.key && styles.tabItemActive)}
              onClick={() => setActiveTab(opt.key)}
            >
              <Text className={styles.tabText}>{opt.label}</Text>
              {opt.count > 0 && (
                <View className={classnames(styles.tabBadge, activeTab === opt.key && styles.tabBadgeActive)}>
                  {opt.count}
                </View>
              )}
            </View>
          ))}
        </View>

        {displayList.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>✅</Text>
            <Text className={styles.emptyText}>暂无相关整改任务</Text>
          </View>
        ) : (
          <>
            {activeTab === 'all' ? (
              <>
                {pendingList.length > 0 && (
                  <View className={styles.groupSection}>
                    <View className={styles.groupHeader}>
                      <Text className={styles.groupIcon}>⏳</Text>
                      <Text className={styles.groupTitle}>待处理</Text>
                      <Text className={styles.groupCount}>{pendingList.length}项</Text>
                    </View>
                    {pendingList.map(renderFaultItem)}
                  </View>
                )}
                {processingList.length > 0 && (
                  <View className={styles.groupSection}>
                    <View className={styles.groupHeader}>
                      <Text className={styles.groupIcon}>🔧</Text>
                      <Text className={styles.groupTitle}>处理中</Text>
                      <Text className={styles.groupCount}>{processingList.length}项</Text>
                    </View>
                    {processingList.map(renderFaultItem)}
                  </View>
                )}
                {recheckList.length > 0 && (
                  <View className={styles.groupSection}>
                    <View className={styles.groupHeader}>
                      <Text className={styles.groupIcon}>🔍</Text>
                      <Text className={styles.groupTitle}>待复检</Text>
                      <Text className={styles.groupCount}>{recheckList.length}项</Text>
                    </View>
                    {recheckList.map(renderFaultItem)}
                  </View>
                )}
              </>
            ) : (
              displayList.map(renderFaultItem)
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default RectifyPage;

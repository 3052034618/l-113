import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import ProgressBar from '@/components/ProgressBar';
import { formatDate, getDateList, isFaultTimeout, formatTime } from '@/utils';
import styles from './index.module.scss';

const StatsPage: React.FC = () => {
  const { user, getStatsByDate, faultReports, routes, scanRecords } = useInspectionStore();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  useDidShow(() => {
    console.log('[Stats] 页面显示');
  });

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  });

  const dateList = useMemo(() => getDateList(7), []);

  const currentStats = useMemo(() => {
    return getStatsByDate(selectedDate);
  }, [selectedDate, getStatsByDate]);

  const timeoutFaults = useMemo(() => {
    return faultReports.filter(f => {
      if (f.rectifyStatus === 'completed') return false;
      const reportDate = f.reportTime.slice(0, 10);
      return reportDate <= selectedDate && isFaultTimeout(f);
    }).sort((a, b) => new Date(a.reportTime).getTime() - new Date(b.reportTime).getTime());
  }, [faultReports, selectedDate]);

  const historyStats = useMemo(() => {
    return dateList.map(date => getStatsByDate(date));
  }, [dateList, getStatsByDate]);

  const handleGenerateSummary = () => {
    Taro.navigateTo({ url: '/pages/summary/index' });
  };

  const deviceRate = currentStats.totalDevices > 0
    ? Math.round((currentStats.checkedDevices / currentStats.totalDevices) * 100)
    : 0;

  const faultRate = currentStats.faultCount > 0
    ? Math.round((currentStats.completedFaultCount / currentStats.faultCount) * 100)
    : 100;

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <View className={styles.userRow}>
          <View className={styles.avatar}>
            <Text className={styles.avatarText}>{user.name.charAt(0)}</Text>
          </View>
          <View className={styles.userInfo}>
            <Text className={styles.userName}>{user.name}</Text>
            <Text className={styles.userDept}>{user.department} · 巡检员</Text>
          </View>
        </View>
        <View className={styles.statsRow}>
          <StatCard label="今日点位" value={currentStats.totalPoints} unit="个" />
          <StatCard label="巡检设备" value={currentStats.checkedDevices} unit="台" />
          <StatCard label="完成率" value={currentStats.completionRate} unit="%" highlight />
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.summaryCard}>
          <View className={styles.summaryHeader}>
            <Text className={styles.summaryTitle}>巡检统计详情</Text>
            <Text className={styles.summaryAction} onClick={handleGenerateSummary}>
              生成交接班摘要 →
            </Text>
          </View>

          <View className={styles.dateTabs}>
            {dateList.map(date => (
              <View
                key={date}
                className={classnames(styles.dateTab, selectedDate === date && styles.dateTabActive)}
                onClick={() => setSelectedDate(date)}
              >
                {date.slice(5)}
              </View>
            ))}
          </View>

          <View className={styles.statsGrid}>
            <View className={styles.gridItem}>
              <Text className={classnames(styles.gridValue, styles.gridValueSuccess)}>
                {currentStats.normalCount}
              </Text>
              <Text className={styles.gridLabel}>正常</Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={classnames(styles.gridValue, styles.gridValueWarning)}>
                {currentStats.abnormalCount}
              </Text>
              <Text className={styles.gridLabel}>异常</Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={classnames(styles.gridValue, styles.gridValueError)}>
                {currentStats.missingCount}
              </Text>
              <Text className={styles.gridLabel}>缺失</Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={classnames(styles.gridValue, styles.gridValueInfo)}>
                {currentStats.disabledCount}
              </Text>
              <Text className={styles.gridLabel}>停用</Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={styles.gridValue}>{currentStats.faultCount}</Text>
              <Text className={styles.gridLabel}>故障数</Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={classnames(styles.gridValue, styles.gridValueError)}>
                {currentStats.timeoutCount}
              </Text>
              <Text className={styles.gridLabel}>超时项</Text>
            </View>
          </View>

          <View className={styles.rateSection}>
            <View className={styles.rateHeader}>
              <Text className={styles.rateLabel}>点位完成率</Text>
              <Text className={styles.rateValue}>{currentStats.completionRate}%</Text>
            </View>
            <ProgressBar progress={currentStats.completionRate} height={12} showLabel={false} />
          </View>

          <View className={styles.rateSection}>
            <View className={styles.rateHeader}>
              <Text className={styles.rateLabel}>设备巡检率</Text>
              <Text className={styles.rateValue}>{deviceRate}%</Text>
            </View>
            <ProgressBar progress={deviceRate} height={12} showLabel={false} />
          </View>

          <View className={styles.rateSection}>
            <View className={styles.rateHeader}>
              <Text className={styles.rateLabel}>故障处理率</Text>
              <Text className={styles.rateValue}>{faultRate}%</Text>
            </View>
            <ProgressBar progress={faultRate} height={12} showLabel={false} />
          </View>
        </View>

        <Text className={styles.sectionTitle}>⚠️ 超时待处理</Text>
        {timeoutFaults.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>✅</Text>
            <Text className={styles.emptyText}>暂无超时项</Text>
          </View>
        ) : (
          timeoutFaults.map(fault => (
            <View key={fault.id} className={styles.timeoutCard}>
              <Text className={styles.timeoutTitle}>{fault.deviceName}</Text>
              <Text className={styles.timeoutMeta}>
                {fault.pointName} · 上报于 {formatTime(fault.reportTime)}
              </Text>
              <Text className={styles.timeoutDesc}>{fault.description}</Text>
            </View>
          ))
        )}

        <Text className={styles.sectionTitle}>📅 历史数据</Text>
        {historyStats.map(stat => (
          <View key={stat.date} className={styles.historyItem}>
            <View>
              <Text className={styles.historyDate}>{stat.date}</Text>
              <Text className={styles.historyMeta}>
                点位 {stat.checkedPoints}/{stat.totalPoints} · 设备 {stat.checkedDevices}/{stat.totalDevices}
              </Text>
            </View>
            <View className={styles.historyRate}>
              <Text className={styles.historyRateValue}>{stat.completionRate}%</Text>
              <Text className={styles.historyRateLabel}>完成率</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

export default StatsPage;

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import InspectionPointCard from '@/components/InspectionPoint';
import ProgressBar from '@/components/ProgressBar';
import { calcCompletionRate, formatDate, formatTime } from '@/utils';
import styles from './index.module.scss';

const RoutesPage: React.FC = () => {
  const { user, routes, currentRouteId, claimRoute, setCurrentRoute, getTodayStats, completeRoute } = useInspectionStore();
  const [activeTab, setActiveTab] = useState<'today' | 'all'>('today');
  const todayStats = getTodayStats();

  useDidShow(() => {
    console.log('[Routes] 页面显示');
  });

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  });

  const filteredRoutes = useMemo(() => {
    const today = formatDate(new Date());
    if (activeTab === 'today') {
      return routes.filter(r => r.date === today);
    }
    return routes;
  }, [routes, activeTab]);

  const currentRoute = useMemo(() => {
    return routes.find(r => r.id === currentRouteId) || null;
  }, [routes, currentRouteId]);

  const getRouteStatusClass = (status: string) => {
    switch (status) {
      case 'pending': return styles.statusPending;
      case 'in_progress': return styles.statusProgress;
      case 'completed': return styles.statusCompleted;
      default: return styles.statusPending;
    }
  };

  const getRouteStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待领取';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      default: return '待领取';
    }
  };

  const handleClaimRoute = (routeId: string) => {
    claimRoute(routeId);
  };

  const handleContinueInspect = (routeId: string) => {
    setCurrentRoute(routeId);
    Taro.switchTab({ url: '/pages/scan/index' });
  };

  const handleViewPoint = (pointId: string, routeId: string) => {
    Taro.navigateTo({
      url: `/pages/point-detail/index?pointId=${pointId}&routeId=${routeId}`
    });
  };

  const handleCompleteRoute = (routeId: string) => {
    Taro.showModal({
      title: '确认完成',
      content: '确认所有点位都已巡检完成？',
      success: (res) => {
        if (res.confirm) {
          completeRoute(routeId);
        }
      }
    });
  };

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <View className={styles.userRow}>
          <View className={styles.avatar}>
            <Text className={styles.avatarText}>{user.name.charAt(0)}</Text>
          </View>
          <View className={styles.userInfo}>
            <Text className={styles.userName}>{user.name}</Text>
            <Text className={styles.userDept}>{user.department}</Text>
          </View>
        </View>

        <View className={styles.statsRow}>
          <StatCard
            label="今日点位"
            value={todayStats?.totalPoints || 0}
            unit="个"
          />
          <StatCard
            label="已完成"
            value={todayStats?.checkedPoints || 0}
            unit="个"
          />
          <StatCard
            label="完成率"
            value={todayStats?.completionRate || 0}
            unit="%"
            highlight
          />
        </View>
      </View>

      {currentRoute && currentRoute.status === 'in_progress' && (
        <View className={styles.currentRouteCard}>
          <View className={styles.currentRouteHeader}>
            <View className={styles.currentRouteBadge}>当前路线</View>
            <Text className={styles.currentRouteName}>{currentRoute.name}</Text>
          </View>
          <View className={styles.currentRouteProgress}>
            <ProgressBar progress={calcCompletionRate(currentRoute.checkedPoints, currentRoute.totalPoints)} height={8} />
            <Text className={styles.currentRouteProgressText}>
              {currentRoute.checkedPoints}/{currentRoute.totalPoints} 点位
            </Text>
          </View>
          <View className={styles.currentRouteActions}>
            <View
              className={styles.currentRouteBtnPrimary}
              onClick={() => handleContinueInspect(currentRoute.id)}
            >
              继续巡检
            </View>
            {currentRoute.checkedPoints === currentRoute.totalPoints && (
              <View
                className={styles.currentRouteBtnSecondary}
                onClick={() => handleCompleteRoute(currentRoute.id)}
              >
                结束路线
              </View>
            )}
          </View>
        </View>
      )}

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>
            {activeTab === 'today' ? '今日巡检路线' : '全部巡检路线'}
          </Text>
          <View className={styles.tabSwitch}>
            <View
              className={classnames(styles.tabItem, activeTab === 'today' && styles.tabActive)}
              onClick={() => setActiveTab('today')}
            >
              今日
            </View>
            <View
              className={classnames(styles.tabItem, activeTab === 'all' && styles.tabActive)}
              onClick={() => setActiveTab('all')}
            >
              全部
            </View>
          </View>
        </View>

        {filteredRoutes.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyText}>暂无巡检路线</Text>
          </View>
        ) : (
          filteredRoutes.map(route => {
            const routeCompletion = calcCompletionRate(route.checkedPoints, route.totalPoints);
            const isCurrent = route.id === currentRouteId;
            const isCurrentActive = isCurrent && route.status === 'in_progress';

            return (
              <View
                key={route.id}
                className={classnames(styles.routeCard, isCurrentActive && styles.routeCardActive)}
              >
                <View className={styles.routeHeader}>
                  <Text className={styles.routeName}>{route.name}</Text>
                  <View className={classnames(styles.routeStatus, getRouteStatusClass(route.status))}>
                    {isCurrent && '当前 · '}
                    {getRouteStatusText(route.status)}
                  </View>
                </View>

                <View className={styles.routeMeta}>
                  <Text className={styles.metaItem}>共 {route.totalPoints} 个点位</Text>
                  <Text className={styles.metaItem}>{route.date}</Text>
                </View>

                {route.startTime && (
                  <View className={styles.routeTimeRow}>
                    <Text className={styles.timeLabel}>开始时间：</Text>
                    <Text className={styles.timeValue}>{formatTime(route.startTime, 'MM-DD HH:mm')}</Text>
                  </View>
                )}
                {route.endTime && (
                  <View className={styles.routeTimeRow}>
                    <Text className={styles.timeLabel}>结束时间：</Text>
                    <Text className={styles.timeValue}>{formatTime(route.endTime, 'MM-DD HH:mm')}</Text>
                  </View>
                )}

                <View className={styles.routeProgress}>
                  <ProgressBar progress={routeCompletion} height={8} />
                  <Text className={styles.routeProgressText}>
                    点位 {route.checkedPoints}/{route.totalPoints}
                  </Text>
                </View>

                {route.status === 'pending' ? (
                  <View
                    className={styles.actionBtn}
                    onClick={() => handleClaimRoute(route.id)}
                  >
                    领取路线
                  </View>
                ) : route.status === 'in_progress' ? (
                  <View className={styles.actionRow}>
                    <View
                      className={styles.actionBtnSecondary}
                      style={{ flex: 1 }}
                      onClick={() => handleContinueInspect(route.id)}
                    >
                      {isCurrent ? '继续巡检' : '切换到此路线'}
                    </View>
                    {route.checkedPoints === route.totalPoints && (
                      <View
                        className={styles.actionBtn}
                        style={{ flex: 1, marginLeft: 16 }}
                        onClick={() => handleCompleteRoute(route.id)}
                      >
                        结束巡检
                      </View>
                    )}
                  </View>
                ) : (
                  <View className={styles.actionBtnCompleted}>
                    巡检已完成
                  </View>
                )}

                {(route.status === 'in_progress' || route.status === 'completed') && (
                  <View style={{ marginTop: 24 }}>
                    <Text className={styles.pointsLabel}>点位列表</Text>
                    {route.points.map(point => (
                      <InspectionPointCard
                        key={point.id}
                        point={point}
                        routeId={route.id}
                        onClick={() => handleViewPoint(point.id, route.id)}
                      />
                    ))}
                  </View>
                )}

                {route.status === 'completed' && (
                  <View className={styles.resultCard}>
                    <Text className={styles.resultTitle}>本次巡检结果</Text>
                    <View className={styles.resultGrid}>
                      <View className={styles.resultItem}>
                        <Text className={styles.resultValue}>{route.totalPoints}</Text>
                        <Text className={styles.resultLabel}>巡检点位</Text>
                      </View>
                      <View className={styles.resultItem}>
                        <Text className={styles.resultValueSuccess}>{route.checkedPoints}</Text>
                        <Text className={styles.resultLabel}>完成点位</Text>
                      </View>
                      <View className={styles.resultItem}>
                        <Text className={styles.resultValue}>
                          {route.points.reduce((sum, p) => sum + p.totalDevices, 0)}
                        </Text>
                        <Text className={styles.resultLabel}>巡检设备</Text>
                      </View>
                      <View className={styles.resultItem}>
                        <Text className={styles.resultValueSuccess}>
                          {route.points.reduce((sum, p) => sum + p.checkedDevices, 0)}
                        </Text>
                        <Text className={styles.resultLabel}>已检设备</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

export default RoutesPage;

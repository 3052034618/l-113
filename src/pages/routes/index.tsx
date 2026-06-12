import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import InspectionPointCard from '@/components/InspectionPoint';
import ProgressBar from '@/components/ProgressBar';
import { calcCompletionRate, formatDate } from '@/utils';
import styles from './index.module.scss';

const RoutesPage: React.FC = () => {
  const { user, routes, currentRouteId, claimRoute, setCurrentRoute, getTodayStats } = useInspectionStore();
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

  const handleStartRoute = (routeId: string) => {
    setCurrentRoute(routeId);
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
            label="故障率"
            value={todayStats?.completionRate || 0}
            unit="%"
            highlight
          />
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>
          {activeTab === 'today' ? '今日巡检路线' : '全部巡检路线'}
        </Text>

        {filteredRoutes.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyText}>暂无巡检路线</Text>
          </View>
        ) : (
          filteredRoutes.map(route => {
            const routeCompletion = calcCompletionRate(route.checkedPoints, route.totalPoints);
            const isCurrent = route.id === currentRouteId;

            return (
              <View key={route.id} className={styles.routeCard}>
                <View className={styles.routeHeader}>
                  <Text className={styles.routeName}>{route.name}</Text>
                  <View className={classnames(styles.routeStatus, getRouteStatusClass(route.status))}>
                    {getRouteStatusText(route.status)}
                    {isCurrent && ' · 当前'}
                  </View>
                </View>

                <View className={styles.routeMeta}>
                  <Text className={styles.metaItem}>共 {route.totalPoints} 个点位</Text>
                  <Text className={styles.metaItem}>{route.date}</Text>
                </View>

                <View className={styles.routeProgress}>
                  <ProgressBar progress={routeCompletion} height={8} />
                </View>

                {route.status === 'pending' ? (
                  <View
                    className={styles.actionBtn}
                    onClick={() => handleClaimRoute(route.id)}
                  >
                    领取路线
                  </View>
                ) : route.status === 'in_progress' ? (
                  <View
                    className={isCurrent ? styles.actionBtnSecondary : styles.actionBtn}
                    onClick={() => handleStartRoute(route.id)}
                  >
                    {isCurrent ? '继续巡检' : '切换到此路线'}
                  </View>
                ) : (
                  <View className={styles.actionBtnSecondary}>
                    查看详情
                  </View>
                )}

                {(route.status === 'in_progress' || route.status === 'completed') && (
                  <View style={{ marginTop: 24 }}>
                    {route.points.map(point => (
                      <InspectionPointCard
                        key={point.id}
                        point={point}
                        routeId={route.id}
                      />
                    ))}
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

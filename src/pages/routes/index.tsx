import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import InspectionPointCard from '@/components/InspectionPoint';
import ProgressBar from '@/components/ProgressBar';
import StatusTag from '@/components/StatusTag';
import { calcCompletionRate, formatDate, formatTime, isSameDay } from '@/utils';
import type { InspectionPoint, InspectionRoute, RouteMemberResult, UserProfile } from '@/types/inspection';
import styles from './index.module.scss';

type ViewMode = 'personal' | 'team';

const RoutesPage: React.FC = () => {
  const {
    user,
    team,
    routes,
    currentRouteId,
    claimRoute,
    setCurrentRoute,
    getTodayStats,
    completeRoute,
    transferPoint,
    requestAssist,
    getRouteMemberResults,
    maintainers
  } = useInspectionStore();

  const [activeTab, setActiveTab] = useState<'today' | 'all'>('today');
  const [viewMode, setViewMode] = useState<ViewMode>('personal');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAssistModal, setShowAssistModal] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{ point: InspectionPoint; route: InspectionRoute } | null>(null);

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
      return routes.filter(r => isSameDay(r.date, today));
    }
    return routes;
  }, [routes, activeTab]);

  const currentRoute = useMemo(() => {
    return routes.find(r => r.id === currentRouteId) || null;
  }, [routes, currentRouteId]);

  const teamMembers = useMemo(() => {
    const members: UserProfile[] = [
      { id: user.id, name: user.name, department: user.department, role: 'inspector', phone: user.phone, teamId: team.id },
      { id: 'U005', name: '刘工', department: '物业运维部', role: 'inspector', phone: '13800138005', teamId: team.id },
      { id: 'U006', name: '陈工', department: '物业运维部', role: 'inspector', phone: '13800138006', teamId: team.id }
    ];
    return members;
  }, [user, team]);

  const getAssigneeForPoint = (point: InspectionPoint, route: InspectionRoute): { id: string; name: string } | null => {
    const assignment = route.memberAssignments?.find(a => a.pointId === point.id) || point.assignment;
    if (assignment) {
      return { id: assignment.assigneeId, name: assignment.assigneeName };
    }
    return null;
  };

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

  const handleTransferClick = (point: InspectionPoint, route: InspectionRoute) => {
    setSelectedPoint({ point, route });
    setShowTransferModal(true);
  };

  const handleAssistClick = (point: InspectionPoint, route: InspectionRoute) => {
    setSelectedPoint({ point, route });
    setShowAssistModal(true);
  };

  const handleConfirmTransfer = (targetUser: UserProfile) => {
    if (!selectedPoint) return;
    transferPoint(
      selectedPoint.route.id,
      selectedPoint.point.id,
      targetUser.id,
      targetUser.name,
      '点位转派'
    );
    setShowTransferModal(false);
    setSelectedPoint(null);
  };

  const handleConfirmAssist = (assistant: UserProfile) => {
    if (!selectedPoint) return;
    requestAssist(
      selectedPoint.route.id,
      selectedPoint.point.id,
      assistant.id,
      assistant.name
    );
    setShowAssistModal(false);
    setSelectedPoint(null);
  };

  const renderMemberResult = (result: RouteMemberResult) => (
    <View key={result.userId} className={styles.memberResultItem}>
      <View className={styles.memberResultHeader}>
        <View className={styles.memberResultAvatar}>
          <Text className={styles.memberResultAvatarText}>{result.userName.charAt(0)}</Text>
        </View>
        <Text className={styles.memberResultName}>{result.userName}</Text>
      </View>
      <View className={styles.memberResultStats}>
        <View className={styles.memberResultStat}>
          <Text className={styles.memberResultStatValue}>{result.checkedDevices}</Text>
          <Text className={styles.memberResultStatLabel}>完成设备</Text>
        </View>
        <View className={styles.memberResultStat}>
          <Text className={styles.memberResultStatValueError}>{result.abnormalDevices}</Text>
          <Text className={styles.memberResultStatLabel}>异常设备</Text>
        </View>
        <View className={styles.memberResultStat}>
          <Text className={styles.memberResultStatValue}>{result.durationMinutes}</Text>
          <Text className={styles.memberResultStatLabel}>耗时(分钟)</Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <View className={styles.userRow}>
          <View className={styles.avatar}>
            <Text className={styles.avatarText}>{user.name.charAt(0)}</Text>
          </View>
          <View className={styles.userInfo}>
            <Text className={styles.userName}>{user.name}</Text>
            <Text className={styles.userDept}>{user.department} · {team.name}</Text>
          </View>
        </View>

        <View className={styles.viewModeSwitch}>
          <View
            className={classnames(styles.viewModeBtn, viewMode === 'personal' && styles.viewModeBtnActive)}
            onClick={() => setViewMode('personal')}
          >
            个人视角
          </View>
          <View
            className={classnames(styles.viewModeBtn, viewMode === 'team' && styles.viewModeBtnActive)}
            onClick={() => setViewMode('team')}
          >
            班组视角
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
            {currentRoute.teamName && (
              <Text className={styles.currentRouteTeam}>{currentRoute.teamName}</Text>
            )}
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
            const memberResults = route.status === 'completed' ? getRouteMemberResults(route.id) : null;

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
                  <Text className={styles.metaItem}>{route.date} · {route.shift}</Text>
                </View>

                {route.teamName && (
                  <View className={styles.routeMeta}>
                    <Text className={styles.metaItem}>班组：{route.teamName}</Text>
                  </View>
                )}

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
                    <Text className={styles.pointsLabel}>
                      点位列表
                      {viewMode === 'team' && '（班组协作）'}
                    </Text>
                    {route.points.map(point => {
                      const assignee = getAssigneeForPoint(point, route);
                      const isMyPoint = assignee?.id === user.id;
                      const isAssist = point.assignment?.assistMemberIds?.includes(user.id);

                      return (
                        <View key={point.id}>
                          <InspectionPointCard
                            point={point}
                            routeId={route.id}
                            onClick={() => handleViewPoint(point.id, route.id)}
                          />
                          {route.status === 'in_progress' && (isMyPoint || isAssist) && viewMode === 'team' && (
                            <View className={styles.pointActions}>
                              <View
                                className={styles.pointActionBtn}
                                onClick={() => handleTransferClick(point, route)}
                              >
                                转派
                              </View>
                              <View
                                className={styles.pointActionBtnSecondary}
                                onClick={() => handleAssistClick(point, route)}
                              >
                                请求协助
                              </View>
                            </View>
                          )}
                          {assignee && (
                            <View className={styles.pointAssignee}>
                              <View className={styles.pointAssigneeAvatar}>
                                <Text className={styles.pointAssigneeAvatarText}>{assignee.name.charAt(0)}</Text>
                              </View>
                              <Text className={styles.pointAssigneeName}>
                                负责人：{assignee.name}
                                {isMyPoint && '（我）'}
                                {isAssist && ' · 我协助'}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {memberResults && memberResults.length > 0 && (
                  <View className={styles.resultCard}>
                    <Text className={styles.resultTitle}>本次巡检结果 · 按人员拆分</Text>
                    <View className={styles.memberResultsList}>
                      {memberResults.map(renderMemberResult)}
                    </View>
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

      {showTransferModal && selectedPoint && (
        <View className={styles.modalMask} onClick={() => setShowTransferModal(false)}>
          <View className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>转派点位</Text>
            </View>
            <Text className={styles.modalSubtitle}>
              将「{selectedPoint.point.name}」转派给其他成员
            </Text>
            <View className={styles.memberList}>
              {teamMembers
                .filter(m => m.id !== user.id)
                .map(member => (
                  <View
                    key={member.id}
                    className={styles.memberItem}
                    onClick={() => handleConfirmTransfer(member)}
                  >
                    <View className={styles.memberAvatar}>
                      <Text className={styles.memberAvatarText}>{member.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text className={styles.memberName}>{member.name}</Text>
                      <Text className={styles.memberRole}>巡检员</Text>
                    </View>
                    <Text className={styles.memberAction}>转派</Text>
                  </View>
                ))}
            </View>
          </View>
        </View>
      )}

      {showAssistModal && selectedPoint && (
        <View className={styles.modalMask} onClick={() => setShowAssistModal(false)}>
          <View className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>请求协助</Text>
            </View>
            <Text className={styles.modalSubtitle}>
              请求其他成员协助「{selectedPoint.point.name}」
            </Text>
            <View className={styles.memberList}>
              {teamMembers
                .filter(m => {
                  const assignment = selectedPoint.point.assignment;
                  return m.id !== user.id && !assignment?.assistMemberIds?.includes(m.id);
                })
                .map(member => (
                  <View
                    key={member.id}
                    className={styles.memberItem}
                    onClick={() => handleConfirmAssist(member)}
                  >
                    <View className={styles.memberAvatar}>
                      <Text className={styles.memberAvatarText}>{member.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text className={styles.memberName}>{member.name}</Text>
                      <Text className={styles.memberRole}>巡检员</Text>
                    </View>
                    <Text className={styles.memberAction}>邀请</Text>
                  </View>
                ))}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default RoutesPage;

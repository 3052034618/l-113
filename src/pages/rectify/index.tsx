import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import StatusTag from '@/components/StatusTag';
import ProgressBar from '@/components/ProgressBar';
import { formatTime, showToast, isFaultTimeout, getUrgencyText, getTimelineActionText } from '@/utils';
import type { FaultReport, UrgencyLevel, RectifyStatus } from '@/types/inspection';
import styles from './index.module.scss';

const RectifyPage: React.FC = () => {
  const {
    faultReports,
    recheckFault,
    updateFaultProgress,
    assignFault,
    maintainers,
    getTodayStats,
    acceptFault,
    rejectFault,
    completeFault,
    currentUser
  } = useInspectionStore();
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'processing' | 'recheck'>('all');
  const [showDetail, setShowDetail] = useState<FaultReport | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [recheckResult, setRecheckResult] = useState<'pass' | 'fail'>('pass');
  const [recheckRemark, setRecheckRemark] = useState('');
  const [showRecheckModal, setShowRecheckModal] = useState(false);
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

  const handleAccept = (fault: FaultReport) => {
    acceptFault(fault.id);
    showToast('已接单', 'success');
  };

  const handleReject = (fault: FaultReport) => {
    setShowDetail(fault);
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (!showDetail) return;
    rejectFault(showDetail.id, rejectRemark || '无');
    setShowRejectModal(false);
    setRejectRemark('');
    setShowDetail(null);
    showToast('已退回', 'success');
  };

  const handleComplete = (fault: FaultReport) => {
    Taro.showModal({
      title: '确认整改完成？',
      content: fault.recheckRequired ? '提交后将进入待复检状态' : '无需复检，提交后将直接完成',
      success: (res) => {
        if (res.confirm) {
          completeFault(fault.id);
          showToast(fault.recheckRequired ? '已提交复检' : '整改已完成', 'success');
        }
      }
    });
  };

  const handleRecheck = async (fault: FaultReport) => {
    setShowDetail(fault);
    setShowRecheckModal(true);
  };

  const confirmRecheck = () => {
    if (!showDetail) return;
    recheckFault(showDetail.id, recheckResult, recheckRemark || '无');
    setShowRecheckModal(false);
    setRecheckRemark('');
    setShowDetail(null);
    showToast(recheckResult === 'pass' ? '复检通过' : '复检不通过', 'success');
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

  const getFaultActionColor = (status: RectifyStatus) => {
    switch (status) {
      case 'pending': return '#ff7d00';
      case 'processing': return '#1677ff';
      case 'recheck': return '#722ed1';
      case 'completed': return '#00b42a';
      default: return '#86909c';
    }
  };

  const canAccept = (fault: FaultReport) => fault.assigneeId === currentUser?.id && fault.rectifyStatus === 'pending';
  const canReject = (fault: FaultReport) => fault.assigneeId === currentUser?.id && fault.rectifyStatus === 'pending';
  const canComplete = (fault: FaultReport) => fault.assigneeId === currentUser?.id && fault.rectifyStatus === 'processing';
  const canRecheck = (fault: FaultReport) => fault.recheckRequired && fault.rectifyStatus === 'recheck';

  const renderFaultItem = (fault: FaultReport) => {
    const isTimeout = isFaultTimeout(fault);
    return (
      <View
        key={fault.id}
        className={classnames(styles.faultItem, isTimeout && styles.faultItemTimeout)}
        onClick={() => setShowDetail(fault)}
      >
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
          {fault.pointName} · {formatTime(fault.createdAt)}
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
          <View style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
            {!fault.assigneeName && fault.rectifyStatus === 'pending' && (
              <View className={styles.actionBtnSecondary} onClick={() => handleAssign(fault)}>
                指派
              </View>
            )}
            {canAccept(fault) && (
              <View className={styles.actionBtn} onClick={() => handleAccept(fault)}>
                接单
              </View>
            )}
            {canReject(fault) && (
              <View className={styles.actionBtnDanger} onClick={() => handleReject(fault)}>
                退回
              </View>
            )}
            {canComplete(fault) && (
              <View className={styles.actionBtn} onClick={() => handleComplete(fault)}>
                完成
              </View>
            )}
            {canRecheck(fault) && (
              <View className={styles.actionBtn} onClick={() => handleRecheck(fault)}>
                复检
              </View>
            )}
            {fault.rectifyStatus === 'processing' && !canComplete(fault) && fault.assigneeName && (
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

      {showDetail && (
        <View className={styles.modalMask} onClick={() => setShowDetail(null)}>
          <ScrollView scrollY className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>故障详情</Text>
              <View className={styles.modalClose} onClick={() => setShowDetail(null)}>
                ✕
              </View>
            </View>

            <View className={styles.detailHeader}>
              <View className={styles.detailStatus} style={{ backgroundColor: `${getFaultActionColor(showDetail.rectifyStatus)}15`, color: getFaultActionColor(showDetail.rectifyStatus) }}>
                {showDetail.rectifyStatus === 'pending' ? '待处理' : showDetail.rectifyStatus === 'processing' ? '处理中' : showDetail.rectifyStatus === 'recheck' ? '待复检' : '已完成'}
              </View>
              <View className={styles.detailUrgency} style={{ backgroundColor: showDetail.urgency === 'high' ? '#f53f3f15' : showDetail.urgency === 'medium' ? '#ff7d0015' : '#86909c15', color: showDetail.urgency === 'high' ? '#f53f3f' : showDetail.urgency === 'medium' ? '#ff7d00' : '#86909c' }}>
                {getUrgencyText(showDetail.urgency)}
              </View>
            </View>

            <View className={styles.detailSection}>
              <Text className={styles.detailSectionTitle}>基本信息</Text>
              <View className={styles.detailRow}>
                <Text className={styles.detailLabel}>设备名称</Text>
                <Text className={styles.detailValue}>{showDetail.deviceName}</Text>
              </View>
              <View className={styles.detailRow}>
                <Text className={styles.detailLabel}>资产编号</Text>
                <Text className={styles.detailValue}>{showDetail.assetCode}</Text>
              </View>
              <View className={styles.detailRow}>
                <Text className={styles.detailLabel}>所在点位</Text>
                <Text className={styles.detailValue}>{showDetail.pointName}</Text>
              </View>
              <View className={styles.detailRow}>
                <Text className={styles.detailLabel}>故障描述</Text>
                <Text className={styles.detailValue}>{showDetail.description}</Text>
              </View>
              <View className={styles.detailRow}>
                <Text className={styles.detailLabel}>指派给</Text>
                <Text className={styles.detailValue}>{showDetail.assigneeName || '未指派'}</Text>
              </View>
              <View className={styles.detailRow}>
                <Text className={styles.detailLabel}>复检要求</Text>
                <Text className={styles.detailValue}>{showDetail.recheckRequired ? '需要复检' : '无需复检'}</Text>
              </View>
              <View className={styles.detailRow}>
                <Text className={styles.detailLabel}>创建时间</Text>
                <Text className={styles.detailValue}>{formatTime(showDetail.createdAt, 'MM-DD HH:mm')}</Text>
              </View>
            </View>

            {showDetail.photos.length > 0 && (
              <View className={styles.detailSection}>
                <Text className={styles.detailSectionTitle}>现场照片</Text>
                <View className={styles.detailPhotos}>
                  {showDetail.photos.map((photo, idx) => (
                    <Image key={idx} src={photo} mode="aspectFill" className={styles.detailPhoto} />
                  ))}
                </View>
              </View>
            )}

            <View className={styles.detailSection}>
              <Text className={styles.detailSectionTitle}>处理时间线</Text>
              <View className={styles.timeline}>
                {showDetail.timeline.map((item, idx) => (
                  <View key={item.id} className={styles.timelineItem}>
                    <View className={styles.timelineDot} />
                    {idx < showDetail.timeline.length - 1 && <View className={styles.timelineLine} />}
                    <View className={styles.timelineContent}>
                      <View className={styles.timelineHeader}>
                        <Text className={styles.timelineAction} style={{ color: item.action === 'rejected' ? '#f53f3f' : item.action === 'recheck_pass' ? '#00b42a' : item.action === 'recheck_fail' ? '#f53f3f' : '#1677ff' }}>
                          {getTimelineActionText(item.action)}
                        </Text>
                        <Text className={styles.timelineTime}>{formatTime(item.time, 'MM-DD HH:mm')}</Text>
                      </View>
                      <Text className={styles.timelineOperator}>操作人：{item.operatorName}</Text>
                      {item.remark && (
                        <Text className={styles.timelineRemark}>{item.remark}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View className={styles.detailActions}>
              {canAccept(showDetail) && (
                <View className={classnames(styles.detailActionBtn, styles.detailActionBtnPrimary)} onClick={() => { handleAccept(showDetail); setShowDetail(null); }}>
                  接单
                </View>
              )}
              {canReject(showDetail) && (
                <View className={classnames(styles.detailActionBtn, styles.detailActionBtnDanger)} onClick={() => handleReject(showDetail)}>
                  退回
                </View>
              )}
              {canComplete(showDetail) && (
                <View className={classnames(styles.detailActionBtn, styles.detailActionBtnPrimary)} onClick={() => { handleComplete(showDetail); setShowDetail(null); }}>
                  整改完成
                </View>
              )}
              {canRecheck(showDetail) && (
                <View className={classnames(styles.detailActionBtn, styles.detailActionBtnPrimary)} onClick={() => handleRecheck(showDetail)}>
                  复检
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {showRejectModal && (
        <View className={styles.modalMask} onClick={() => setShowRejectModal(false)}>
          <View className={styles.modalContentSmall} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>退回原因</Text>
              <View className={styles.modalClose} onClick={() => setShowRejectModal(false)}>
                ✕
              </View>
            </View>
            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>请填写退回原因</Text>
              <Textarea
                className={styles.formTextarea}
                placeholder="请输入退回原因"
                value={rejectRemark}
                onInput={(e) => setRejectRemark(e.detail.value)}
              />
            </View>
            <View className={styles.modalActions}>
              <View className={classnames(styles.modalActionBtn, styles.modalActionBtnCancel)} onClick={() => setShowRejectModal(false)}>
                取消
              </View>
              <View className={classnames(styles.modalActionBtn, styles.modalActionBtnConfirm)} onClick={confirmReject}>
                确认退回
              </View>
            </View>
          </View>
        </View>
      )}

      {showRecheckModal && (
        <View className={styles.modalMask} onClick={() => setShowRecheckModal(false)}>
          <View className={styles.modalContentSmall} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>复检确认</Text>
              <View className={styles.modalClose} onClick={() => setShowRecheckModal(false)}>
                ✕
              </View>
            </View>
            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>复检结果</Text>
              <View className={styles.recheckResultRow}>
                <View
                  className={classnames(styles.recheckResultBtn, recheckResult === 'pass' && styles.recheckResultBtnPass)}
                  onClick={() => setRecheckResult('pass')}
                >
                  ✓ 通过
                </View>
                <View
                  className={classnames(styles.recheckResultBtn, recheckResult === 'fail' && styles.recheckResultBtnFail)}
                  onClick={() => setRecheckResult('fail')}
                >
                  ✗ 不通过
                </View>
              </View>
            </View>
            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>复检备注</Text>
              <Textarea
                className={styles.formTextarea}
                placeholder="请输入复检备注（选填）"
                value={recheckRemark}
                onInput={(e) => setRecheckRemark(e.detail.value)}
              />
            </View>
            <View className={styles.modalActions}>
              <View className={classnames(styles.modalActionBtn, styles.modalActionBtnCancel)} onClick={() => setShowRecheckModal(false)}>
                取消
              </View>
              <View className={classnames(styles.modalActionBtn, styles.modalActionBtnConfirm)} onClick={confirmRecheck}>
                确认提交
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default RectifyPage;

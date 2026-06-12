import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Image, Input, Textarea } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh, useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import FaultCard from '@/components/FaultCard';
import { showToast, isFaultTimeout, formatTime, getTimelineActionText, getUrgencyText } from '@/utils';
import type { UrgencyLevel, RectifyStatus, FaultReport } from '@/types/inspection';
import styles from './index.module.scss';

type FilterType = 'all' | RectifyStatus;

const FaultPage: React.FC = () => {
  const {
    faultReports,
    maintainers,
    addFaultReport,
    getTodayStats,
    getDeviceById,
    getPointById,
    acceptFault,
    rejectFault,
    completeFault,
    recheckFault,
    currentUser,
    linkScanRecordToFault,
    getFaultById
  } = useInspectionStore();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<FaultReport | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [recheckResult, setRecheckResult] = useState<'pass' | 'fail'>('pass');
  const [recheckRemark, setRecheckRemark] = useState('');
  const [showRecheckModal, setShowRecheckModal] = useState(false);

  const [deviceName, setDeviceName] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [pointName, setPointName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [pointId, setPointId] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('medium');
  const [photos, setPhotos] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [assigneeName, setAssigneeName] = useState('');
  const [recheckRequired, setRecheckRequired] = useState(true);
  const [scanRecordId, setScanRecordId] = useState<string>('');
  const [prefillProcessed, setPrefillProcessed] = useState(false);

  const todayStats = getTodayStats();

  useDidShow(() => {
    console.log('[Fault] 页面显示');
    const prefillDeviceId = router.params.deviceId as string;
    const prefillPointId = router.params.pointId as string;
    const prefillDescription = router.params.description as string;
    const prefillPhotos = router.params.photos as string;
    const prefillScanRecordId = router.params.scanRecordId as string;

    if ((prefillDeviceId || prefillPointId || prefillDescription) && !prefillProcessed) {
      setPrefillProcessed(true);
      if (prefillDeviceId) {
        const device = getDeviceById(prefillDeviceId);
        if (device) {
          setDeviceId(device.id);
          setDeviceName(device.name);
          setAssetCode(device.assetCode);
        } else {
          setDeviceId(prefillDeviceId);
          setDeviceName(router.params.deviceName as string || '');
          setAssetCode(router.params.assetCode as string || '');
        }
      }
      if (prefillPointId) {
        const result = getPointById(prefillPointId);
        if (result) {
          setPointId(result.point.id);
          setPointName(result.point.name);
        } else {
          setPointId(prefillPointId);
          setPointName(router.params.pointName as string || '');
        }
      }
      if (prefillDescription) {
        setDescription(decodeURIComponent(prefillDescription));
      }
      if (prefillPhotos) {
        setPhotos(prefillPhotos.split(',').filter(Boolean));
      }
      if (prefillScanRecordId) {
        setScanRecordId(prefillScanRecordId);
      }
      setShowModal(true);
    }
  });

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  });

  const pendingCount = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'pending' || f.rectifyStatus === 'assigned').length, [faultReports]);
  const processingCount = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'processing').length, [faultReports]);
  const recheckCount = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'recheck').length, [faultReports]);
  const timeoutCount = useMemo(() => faultReports.filter(f => isFaultTimeout(f)).length, [faultReports]);

  const filteredFaults = useMemo(() => {
    if (filter === 'all') return faultReports;
    if (filter === 'pending') return faultReports.filter(f => f.rectifyStatus === 'pending' || f.rectifyStatus === 'assigned');
    return faultReports.filter(f => f.rectifyStatus === filter);
  }, [faultReports, filter]);

  const groupedFaults = useMemo(() => {
    const groups: Record<string, typeof faultReports> = {
      pending: [],
      processing: [],
      recheck: [],
      completed: []
    };
    faultReports.forEach(f => {
      if (f.rectifyStatus === 'pending' || f.rectifyStatus === 'assigned') {
        groups.pending.push(f);
      } else if (groups[f.rectifyStatus]) {
        groups[f.rectifyStatus].push(f);
      }
    });
    return groups;
  }, [faultReports]);

  const handleAddPhoto = async () => {
    try {
      const res = await Taro.chooseImage({
        count: 3 - photos.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });
      if (res.tempFilePaths) {
        setPhotos([...photos, ...res.tempFilePaths]);
      }
    } catch (e) {
      console.log('[Fault] 用户取消选择图片');
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setDeviceName('');
    setAssetCode('');
    setPointName('');
    setDeviceId('');
    setPointId('');
    setDescription('');
    setUrgency('medium');
    setPhotos([]);
    setAssigneeId('');
    setAssigneeName('');
    setRecheckRequired(true);
    setScanRecordId('');
    setPrefillProcessed(false);
  };

  const handleSubmit = () => {
    if (!deviceName.trim()) {
      showToast('请输入设备名称', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('请输入故障描述', 'error');
      return;
    }

    const newFault = addFaultReport({
      deviceId: deviceId || `DEV-${Date.now()}`,
      assetCode: assetCode || '未记录',
      deviceName: deviceName.trim(),
      pointId: pointId || `P-${Date.now()}`,
      pointName: pointName.trim() || '未指定点位',
      description: description.trim(),
      urgency,
      photos,
      assigneeId: assigneeId || undefined,
      assigneeName: assigneeName || undefined,
      recheckRequired,
      scanRecordId: scanRecordId || undefined
    });

    if (newFault && scanRecordId) {
      showToast(`故障单 #${newFault.id.slice(-6)} 已生成`, 'success');
    } else {
      showToast('故障上报成功', 'success');
    }

    setShowModal(false);
    resetForm();
  };

  const handleAccept = () => {
    if (!showDetail) return;
    acceptFault(showDetail.id);
    const updatedFault = getFaultById(showDetail.id);
    if (updatedFault) {
      setShowDetail(updatedFault);
    }
    showToast('已接单', 'success');
  };

  const handleReject = () => {
    if (!showDetail) return;
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (!showDetail) return;
    rejectFault(showDetail.id, rejectRemark || '无');
    const updatedFault = getFaultById(showDetail.id);
    if (updatedFault) {
      setShowDetail(updatedFault);
    }
    setShowRejectModal(false);
    setRejectRemark('');
    showToast('已退回', 'success');
  };

  const handleComplete = () => {
    if (!showDetail) return;
    Taro.showModal({
      title: '确认整改完成？',
      content: showDetail.recheckRequired ? '提交后将进入待复检状态' : '无需复检，提交后将直接完成',
      success: (res) => {
        if (res.confirm && showDetail) {
          completeFault(showDetail.id);
          const updatedFault = getFaultById(showDetail.id);
          if (updatedFault) {
            setShowDetail(updatedFault);
          }
          showToast(showDetail.recheckRequired ? '已提交复检' : '整改已完成', 'success');
        }
      }
    });
  };

  const handleRecheck = () => {
    if (!showDetail) return;
    setShowRecheckModal(true);
  };

  const confirmRecheck = () => {
    if (!showDetail) return;
    recheckFault(showDetail.id, recheckResult, recheckRemark || '无');
    const updatedFault = getFaultById(showDetail.id);
    if (updatedFault) {
      setShowDetail(updatedFault);
    }
    setShowRecheckModal(false);
    setRecheckRemark('');
    showToast(recheckResult === 'pass' ? '复检通过' : '复检不通过', 'success');
  };

  const canAccept = showDetail?.assigneeId === currentUser?.id && showDetail?.rectifyStatus === 'assigned';
  const canReject = showDetail?.assigneeId === currentUser?.id && showDetail?.rectifyStatus === 'assigned';
  const canComplete = showDetail?.assigneeId === currentUser?.id && showDetail?.rectifyStatus === 'processing';
  const canRecheck = showDetail?.recheckRequired && showDetail?.rectifyStatus === 'recheck';

  const getFaultActionColor = (status: RectifyStatus) => {
    switch (status) {
      case 'pending':
      case 'assigned': return '#ff7d00';
      case 'processing': return '#1677ff';
      case 'recheck': return '#722ed1';
      case 'completed':
      case 'closed': return '#00b42a';
      default: return '#86909c';
    }
  };

  const handleSelectAssignee = (id: string, name: string) => {
    if (assigneeId === id) {
      setAssigneeId('');
      setAssigneeName('');
    } else {
      setAssigneeId(id);
      setAssigneeName(name);
    }
  };

  const filterOptions: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待处理', count: pendingCount },
    { key: 'processing', label: '处理中', count: processingCount },
    { key: 'recheck', label: '待复检', count: recheckCount },
    { key: 'completed', label: '已完成' }
  ];

  const groupLabels: Record<string, { label: string; icon: string }> = {
    pending: { label: '待处理', icon: '⏳' },
    processing: { label: '处理中', icon: '🔧' },
    recheck: { label: '待复检', icon: '🔍' },
    completed: { label: '已完成', icon: '✅' }
  };

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>故障上报</Text>
        <Text className={styles.headerSubtitle}>快速记录设备故障，指派维修人员</Text>
        <View className={styles.statsRow}>
          <StatCard label="待处理" value={pendingCount} unit="个" />
          <StatCard label="处理中" value={processingCount} unit="个" />
          <StatCard label="超时" value={timeoutCount} unit="项" highlight />
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>故障列表</Text>
          <View className={styles.filterTabs}>
            {filterOptions.map(opt => (
              <View
                key={opt.key}
                className={classnames(styles.filterTab, filter === opt.key && styles.filterTabActive)}
                onClick={() => setFilter(opt.key)}
              >
                {opt.label}
                {opt.count !== undefined && opt.count > 0 && (
                  <Text className={styles.filterTabCount}>{opt.count}</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {filteredFaults.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>🔧</Text>
            <Text className={styles.emptyText}>暂无故障记录</Text>
          </View>
        ) : filter === 'all' ? (
          <>
            {Object.entries(groupedFaults).map(([status, list]) => (
              list.length > 0 && (
                <View key={status} className={styles.groupSection}>
                  <View className={styles.groupHeader}>
                    <Text className={styles.groupIcon}>{groupLabels[status]?.icon}</Text>
                    <Text className={styles.groupTitle}>{groupLabels[status]?.label}</Text>
                    <Text className={styles.groupCount}>{list.length}项</Text>
                  </View>
                  {list.map(fault => (
                    <View key={fault.id} onClick={() => setShowDetail(fault)}>
                      <FaultCard fault={fault} />
                    </View>
                  ))}
                </View>
              )
            ))}
          </>
        ) : (
          filteredFaults.map(fault => (
            <View key={fault.id} onClick={() => setShowDetail(fault)}>
              <FaultCard fault={fault} />
            </View>
          ))
        )}
      </View>

      <View className={styles.fab} onClick={() => setShowModal(true)}>
        <Text className={styles.fabIcon}>+</Text>
      </View>

      {showModal && (
        <View className={styles.modalMask} onClick={() => setShowModal(false)}>
          <ScrollView scrollY className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>新增故障上报</Text>
              <View className={styles.modalClose} onClick={() => setShowModal(false)}>
                ✕
              </View>
            </View>

            {deviceId && (
              <View className={styles.prefillNotice}>
                <Text className={styles.prefillNoticeIcon}>📋</Text>
                <Text className={styles.prefillNoticeText}>已自动带出扫码设备信息</Text>
              </View>
            )}

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>设备名称 *</Text>
              <Input
                className={styles.formInput}
                placeholder="请输入设备名称"
                value={deviceName}
                onInput={(e) => setDeviceName(e.detail.value)}
              />
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>资产编号</Text>
              <Input
                className={styles.formInput}
                placeholder="请输入资产编号（选填）"
                value={assetCode}
                onInput={(e) => setAssetCode(e.detail.value)}
              />
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>所在点位</Text>
              <Input
                className={styles.formInput}
                placeholder="请输入所在点位（选填）"
                value={pointName}
                onInput={(e) => setPointName(e.detail.value)}
              />
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>故障描述 *</Text>
              <Textarea
                className={styles.formTextarea}
                placeholder="请详细描述故障情况"
                value={description}
                onInput={(e) => setDescription(e.detail.value)}
              />
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>紧急程度</Text>
              <View className={styles.urgencyRow}>
                <View
                  className={classnames(styles.urgencyBtn, urgency === 'high' && styles.urgencyBtnActiveHigh)}
                  onClick={() => setUrgency('high')}
                >
                  紧急
                  <Text className={styles.urgencyHint}>2小时</Text>
                </View>
                <View
                  className={classnames(styles.urgencyBtn, urgency === 'medium' && styles.urgencyBtnActiveMedium)}
                  onClick={() => setUrgency('medium')}
                >
                  一般
                  <Text className={styles.urgencyHint}>8小时</Text>
                </View>
                <View
                  className={classnames(styles.urgencyBtn, urgency === 'low' && styles.urgencyBtnActiveLow)}
                  onClick={() => setUrgency('low')}
                >
                  较低
                  <Text className={styles.urgencyHint}>24小时</Text>
                </View>
              </View>
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>现场照片（最多3张）</Text>
              <View className={styles.photoGrid}>
                {photos.map((photo, idx) => (
                  <View key={idx} className={styles.photoItem}>
                    <Image src={photo} mode="aspectFill" className={styles.photoImage} />
                    <View className={styles.photoRemove} onClick={() => handleRemovePhoto(idx)}>
                      ✕
                    </View>
                  </View>
                ))}
                {photos.length < 3 && (
                  <View className={styles.photoAdd} onClick={handleAddPhoto}>
                    <Text className={styles.photoAddIcon}>+</Text>
                    <Text className={styles.photoAddText}>添加照片</Text>
                  </View>
                )}
              </View>
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>指派维修负责人</Text>
              <View className={styles.assigneeRow}>
                {maintainers.map(m => (
                  <View
                    key={m.id}
                    className={classnames(styles.assigneeBtn, assigneeId === m.id && styles.assigneeBtnActive)}
                    onClick={() => handleSelectAssignee(m.id, m.name)}
                  >
                    <View className={styles.assigneeAvatar}>
                      <Text className={styles.assigneeAvatarText}>{m.name.charAt(0)}</Text>
                    </View>
                    <Text className={styles.assigneeBtnText}>{m.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>复检要求</Text>
              <View className={styles.recheckRow}>
                <View
                  className={classnames(styles.recheckBtn, recheckRequired && styles.recheckBtnActive)}
                  onClick={() => setRecheckRequired(true)}
                >
                  <Text className={styles.recheckIcon}>✓</Text>
                  <Text>需要复检</Text>
                </View>
                <View
                  className={classnames(styles.recheckBtn, !recheckRequired && styles.recheckBtnActive)}
                  onClick={() => setRecheckRequired(false)}
                >
                  <Text className={styles.recheckIcon}>✓</Text>
                  <Text>无需复检</Text>
                </View>
              </View>
              <Text className={styles.recheckHint}>
                {recheckRequired ? '整改完成后需要巡检员复检确认' : '整改完成后自动标记为已完成'}
              </Text>
            </View>

            <View className={styles.submitBtn} onClick={handleSubmit}>
              提交上报
            </View>
          </ScrollView>
        </View>
      )}

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
                {showDetail.rectifyStatus === 'pending' || showDetail.rectifyStatus === 'assigned' ? '待处理' : showDetail.rectifyStatus === 'processing' ? '处理中' : showDetail.rectifyStatus === 'recheck' ? '待复检' : showDetail.rectifyStatus === 'closed' ? '已关闭' : '已完成'}
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
                <Text className={styles.detailValue}>{formatTime(showDetail.reportTime, 'MM-DD HH:mm')}</Text>
              </View>
              {showDetail.acceptedAt && (
                <View className={styles.detailRow}>
                  <Text className={styles.detailLabel}>接单时间</Text>
                  <Text className={styles.detailValue}>{formatTime(showDetail.acceptedAt, 'MM-DD HH:mm')}</Text>
                </View>
              )}
              {showDetail.completedAt && (
                <View className={styles.detailRow}>
                  <Text className={styles.detailLabel}>完成时间</Text>
                  <Text className={styles.detailValue}>{formatTime(showDetail.completedAt, 'MM-DD HH:mm')}</Text>
                </View>
              )}
              {showDetail.closedAt && (
                <View className={styles.detailRow}>
                  <Text className={styles.detailLabel}>关闭时间</Text>
                  <Text className={styles.detailValue}>{formatTime(showDetail.closedAt, 'MM-DD HH:mm')}</Text>
                </View>
              )}
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
              {canAccept && (
                <View className={classnames(styles.detailActionBtn, styles.detailActionBtnPrimary)} onClick={handleAccept}>
                  接单
                </View>
              )}
              {canReject && (
                <View className={classnames(styles.detailActionBtn, styles.detailActionBtnDanger)} onClick={handleReject}>
                  退回
                </View>
              )}
              {canComplete && (
                <View className={classnames(styles.detailActionBtn, styles.detailActionBtnPrimary)} onClick={handleComplete}>
                  整改完成
                </View>
              )}
              {canRecheck && (
                <View className={classnames(styles.detailActionBtn, styles.detailActionBtnPrimary)} onClick={handleRecheck}>
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

export default FaultPage;

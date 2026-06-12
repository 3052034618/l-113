import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Image, Input, Textarea } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh, useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import FaultCard from '@/components/FaultCard';
import { showToast, isFaultTimeout } from '@/utils';
import type { UrgencyLevel, RectifyStatus } from '@/types/inspection';
import styles from './index.module.scss';

type FilterType = 'all' | RectifyStatus;

const FaultPage: React.FC = () => {
  const { faultReports, maintainers, addFaultReport, getTodayStats, getDeviceById, getPointById } = useInspectionStore();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [showModal, setShowModal] = useState(false);

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

  const todayStats = getTodayStats();

  useDidShow(() => {
    console.log('[Fault] 页面显示');
    const prefillDeviceId = router.params.deviceId as string;
    const prefillPointId = router.params.pointId as string;

    if (prefillDeviceId || prefillPointId) {
      if (prefillDeviceId) {
        const device = getDeviceById(prefillDeviceId);
        if (device) {
          setDeviceId(device.id);
          setDeviceName(device.name);
          setAssetCode(device.assetCode);
        }
      }
      if (prefillPointId) {
        const result = getPointById(prefillPointId);
        if (result) {
          setPointId(result.point.id);
          setPointName(result.point.name);
        }
      }
      setShowModal(true);
    }
  });

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  });

  const pendingCount = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'pending').length, [faultReports]);
  const processingCount = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'processing').length, [faultReports]);
  const recheckCount = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'recheck').length, [faultReports]);
  const timeoutCount = useMemo(() => faultReports.filter(f => isFaultTimeout(f)).length, [faultReports]);

  const filteredFaults = useMemo(() => {
    if (filter === 'all') return faultReports;
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
      if (groups[f.rectifyStatus]) {
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

    addFaultReport({
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
      recheckRequired
    });

    setShowModal(false);
    resetForm();
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
                    <FaultCard key={fault.id} fault={fault} />
                  ))}
                </View>
              )
            ))}
          </>
        ) : (
          filteredFaults.map(fault => (
            <FaultCard key={fault.id} fault={fault} />
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
    </ScrollView>
  );
};

export default FaultPage;

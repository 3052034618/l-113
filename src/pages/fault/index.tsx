import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Image, Input, Textarea } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatCard from '@/components/StatCard';
import FaultCard from '@/components/FaultCard';
import { showToast } from '@/utils';
import type { UrgencyLevel, RectifyStatus } from '@/types/inspection';
import styles from './index.module.scss';

type FilterType = 'all' | RectifyStatus;

const FaultPage: React.FC = () => {
  const { faultReports, maintainers, addFaultReport, getTodayStats } = useInspectionStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [showModal, setShowModal] = useState(false);

  const [deviceName, setDeviceName] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [pointName, setPointName] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('medium');
  const [photos, setPhotos] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [assigneeName, setAssigneeName] = useState('');

  const todayStats = getTodayStats();

  useDidShow(() => {
    console.log('[Fault] 页面显示');
  });

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  });

  const pendingCount = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'pending').length, [faultReports]);
  const processingCount = useMemo(() => faultReports.filter(f => f.rectifyStatus === 'processing' || f.rectifyStatus === 'recheck').length, [faultReports]);

  const filteredFaults = useMemo(() => {
    if (filter === 'all') return faultReports;
    return faultReports.filter(f => f.rectifyStatus === filter);
  }, [faultReports, filter]);

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
    setDescription('');
    setUrgency('medium');
    setPhotos([]);
    setAssigneeId('');
    setAssigneeName('');
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
      deviceId: `DEV-${Date.now()}`,
      assetCode: assetCode || '未记录',
      deviceName: deviceName.trim(),
      pointId: `P-${Date.now()}`,
      pointName: pointName.trim() || '未指定点位',
      description: description.trim(),
      urgency,
      photos,
      assigneeId: assigneeId || undefined,
      assigneeName: assigneeName || undefined
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

  const filterOptions: { key: FilterType; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待处理' },
    { key: 'processing', label: '处理中' },
    { key: 'recheck', label: '待复检' },
    { key: 'completed', label: '已完成' }
  ];

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>故障上报</Text>
        <Text className={styles.headerSubtitle}>快速记录设备故障，指派维修人员</Text>
        <View className={styles.statsRow}>
          <StatCard label="待处理" value={pendingCount} unit="个" />
          <StatCard label="处理中" value={processingCount} unit="个" />
          <StatCard label="今日故障" value={todayStats?.faultCount || 0} unit="个" highlight />
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
              </View>
            ))}
          </View>
        </View>

        {filteredFaults.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>🔧</Text>
            <Text className={styles.emptyText}>暂无故障记录</Text>
          </View>
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
                </View>
                <View
                  className={classnames(styles.urgencyBtn, urgency === 'medium' && styles.urgencyBtnActiveMedium)}
                  onClick={() => setUrgency('medium')}
                >
                  一般
                </View>
                <View
                  className={classnames(styles.urgencyBtn, urgency === 'low' && styles.urgencyBtnActiveLow)}
                  onClick={() => setUrgency('low')}
                >
                  较低
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
              <Text className={styles.formLabel}>指派维修负责人（选填）</Text>
              <View className={styles.assigneeRow}>
                {maintainers.map(m => (
                  <View
                    key={m.id}
                    className={classnames(styles.assigneeBtn, assigneeId === m.id && styles.assigneeBtnActive)}
                    onClick={() => handleSelectAssignee(m.id, m.name)}
                  >
                    {m.name}
                  </View>
                ))}
              </View>
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

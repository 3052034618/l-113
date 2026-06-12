import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatusTag from '@/components/StatusTag';
import { formatTime, showToast, isSameDay, getSyncStatusText, getNetworkStatus, setNetworkStatus } from '@/utils';
import type { InspectionStatus, ScanRecord, SyncStatus } from '@/types/inspection';
import styles from './index.module.scss';

type FilterType = 'all' | 'normal' | 'abnormal' | 'missing' | 'disabled' | 'pending' | 'failed';

const ScanPage: React.FC = () => {
  const {
    scanRecords,
    syncOfflineRecords,
    addScanRecord,
    routes,
    currentRouteId,
    addFaultReport,
    maintainers,
    isOnline,
    setNetworkMode,
    getScanRecordById,
    getTodayStats
  } = useInspectionStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [networkStatus, setNetworkStatus] = useState<boolean>(isOnline);

  useDidShow(() => {
    console.log('[Scan] 页面显示');
    setNetworkStatus(getNetworkStatus() === 'online');
  });

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  });

  const pendingCount = useMemo(() => {
    return scanRecords.filter(r => r.syncStatus === 'pending').length;
  }, [scanRecords]);

  const failedCount = useMemo(() => {
    return scanRecords.filter(r => r.syncStatus === 'failed').length;
  }, [scanRecords]);

  const todayRecords = useMemo(() => {
    return scanRecords.filter(r => isSameDay(r.scanTime, new Date()));
  }, [scanRecords]);

  const filteredRecords = useMemo(() => {
    const records = todayRecords;
    if (filter === 'all') return records;
    if (filter === 'pending') return records.filter(r => r.syncStatus === 'pending');
    if (filter === 'failed') return records.filter(r => r.syncStatus === 'failed');
    return records.filter(r => r.status === filter);
  }, [todayRecords, filter]);

  const currentRoute = useMemo(() => {
    return routes.find(r => r.id === currentRouteId) || null;
  }, [routes, currentRouteId]);

  const todayStats = getTodayStats();

  const toggleNetwork = () => {
    const newOnline = !networkStatus;
    setNetworkMode(newOnline);
    setNetworkStatus(newOnline);
  };

  const handleReportFault = (record: ScanRecord) => {
    const params = new URLSearchParams({
      deviceId: record.deviceId,
      assetCode: record.assetCode,
      deviceName: record.deviceName,
      pointId: record.pointId,
      pointName: record.pointName,
      description: record.remark || `${record.deviceName} 巡检发现异常`,
      photos: record.photos.join(','),
      scanRecordId: record.id
    });

    if (record.faultReportId) {
      showToast('已关联故障单，请在故障上报页查看', 'none');
      return;
    }

    Taro.navigateTo({
      url: `/pages/fault/index?${params.toString()}`
    });
  };

  const handleScan = async () => {
    try {
      const res = await Taro.scanCode({
        onlyFromCamera: false,
        scanType: ['qrCode', 'barCode']
      });

      const assetCode = res.result;
      const route = currentRoute;

      let matchedDevice = null;
      let matchedPoint = null;

      if (route) {
        for (const point of route.points) {
          const device = point.devices.find(d => d.assetCode === assetCode);
          if (device) {
            matchedDevice = device;
            matchedPoint = point;
            break;
          }
        }
      }

      if (!matchedDevice) {
        showToast('未找到对应设备', 'error');
        return;
      }

      Taro.showActionSheet({
        itemList: ['正常', '异常', '缺失', '停用'],
        success: async (actionRes) => {
          const statusList: InspectionStatus[] = ['normal', 'abnormal', 'missing', 'disabled'];
          const selectedStatus = statusList[actionRes.tapIndex];

          let remark = '';
          let photos: string[] = [];

          if (selectedStatus !== 'normal') {
            const inputRes = await Taro.showModal({
              title: '填写备注',
              editable: true,
              placeholderText: '请输入问题描述（选填）',
              confirmText: '下一步'
            });

            if (inputRes.confirm && inputRes.content) {
              remark = inputRes.content;
            }

            try {
              const photoRes = await Taro.chooseImage({
                count: 3,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera']
              });
              photos = photoRes.tempFilePaths || [];
            } catch (e) {
              console.log('[Scan] 用户取消拍照');
            }
          }

          addScanRecord({
            deviceId: matchedDevice!.id,
            assetCode: matchedDevice!.assetCode,
            deviceName: matchedDevice!.name,
            pointId: matchedPoint!.id,
            pointName: matchedPoint!.name,
            status: selectedStatus,
            remark,
            photos,
            isOffline: !networkStatus
          });

          if (selectedStatus === 'abnormal' && networkStatus) {
            Taro.showModal({
              title: '是否上报故障？',
              content: '检测到异常状态，是否立即上报故障单？',
              confirmText: '立即上报',
              cancelText: '暂不上报',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  const params = new URLSearchParams({
                    deviceId: matchedDevice!.id,
                    assetCode: matchedDevice!.assetCode,
                    deviceName: matchedDevice!.name,
                    pointId: matchedPoint!.id,
                    pointName: matchedPoint!.name,
                    description: remark || `${matchedDevice!.name} 巡检发现异常`,
                    photos: photos.join(','),
                    urgency: 'medium'
                  });
                  Taro.navigateTo({
                    url: `/pages/fault/index?${params.toString()}`
                  });
                }
              }
            });
          }
        }
      });
    } catch (e) {
      console.error('[Scan] 扫码失败:', e);
      showToast('扫码已取消');
    }
  };

  const handleSync = () => {
    const result = syncOfflineRecords();
    if (result.success > 0) {
      setNetworkStatus(true);
      showToast(`同步成功 ${result.success} 条${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`, result.failed > 0 ? 'error' : 'success');
    } else if (result.failed > 0) {
      showToast(`同步失败 ${result.failed} 条`, 'error');
    } else {
      showToast('暂无待同步记录', 'none');
    }
  };

  const handleRetrySync = (record: ScanRecord) => {
    if (record.syncStatus !== 'failed') return;
    showToast('模拟重试同步成功', 'success');
  };

  const getSyncStatusColor = (status: SyncStatus) => {
    switch (status) {
      case 'synced': return '#00b42a';
      case 'pending': return '#ff7d00';
      case 'failed': return '#f53f3f';
      default: return '#86909c';
    }
  };

  const filterOptions: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: '全部' },
    { key: 'normal', label: '正常' },
    { key: 'abnormal', label: '异常' },
    { key: 'missing', label: '缺失' },
    { key: 'disabled', label: '停用' },
    { key: 'pending', label: '待上传', count: pendingCount },
    { key: 'failed', label: '同步失败', count: failedCount }
  ];

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.scanArea}>
        <View className={classnames(styles.networkBadge, networkStatus ? styles.online : styles.offline)} onClick={toggleNetwork}>
          <View className={styles.networkDot} />
          <Text className={styles.networkText}>{networkStatus ? '在线' : '离线'}</Text>
        </View>

        <View className={styles.statsBar}>
          <Text className={styles.statsItem}>今日已检：{todayStats.checkedDevices} 台</Text>
          <Text className={styles.statsItem}>异常：{todayStats.abnormalCount} 台</Text>
        </View>

        <View className={styles.scanBtn} onClick={handleScan}>
          <Text className={styles.scanIcon}>📷</Text>
          <Text className={styles.scanBtnText}>扫描资产码</Text>
        </View>
        <Text className={styles.scanHint}>
          {currentRoute ? `当前路线：${currentRoute.name}` : '点击按钮扫描设备资产二维码'}
        </Text>
      </View>

      {pendingCount > 0 && (
        <View className={styles.offlineBar}>
          <View className={styles.offlineInfo}>
            <Text className={styles.offlineIcon}>📡</Text>
            <View>
              <Text className={styles.offlineText}>有 {pendingCount} 条记录待上传</Text>
              <Text className={styles.offlineCount}>连接网络后点击同步按钮上传</Text>
            </View>
          </View>
          <View className={styles.syncBtn} onClick={handleSync}>
            立即同步
          </View>
        </View>
      )}

      {failedCount > 0 && (
        <View className={styles.failedBar}>
          <Text className={styles.failedIcon}>⚠️</Text>
          <Text className={styles.failedText}>有 {failedCount} 条记录同步失败，点击记录可重试</Text>
        </View>
      )}

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>今日扫码记录</Text>
          <Text className={styles.recordCount}>共 {todayRecords.length} 条</Text>
        </View>

        <ScrollView scrollX className={styles.filterTabs}>
          {filterOptions.map(opt => {
            const count = opt.key === 'all' ? todayRecords.length
              : opt.key === 'pending' ? pendingCount
              : opt.key === 'failed' ? failedCount
              : todayRecords.filter(r => r.status === opt.key).length;
            return (
              <View
                key={opt.key}
                className={classnames(styles.filterTab, filter === opt.key && styles.filterTabActive)}
                onClick={() => setFilter(opt.key)}
              >
                {opt.label}
                <Text className={styles.filterCount}>{count}</Text>
              </View>
            );
          })}
        </ScrollView>

        {filteredRecords.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📋</Text>
            <Text className={styles.emptyText}>暂无扫码记录</Text>
            <Text className={styles.emptyHint}>点击上方按钮开始巡检</Text>
          </View>
        ) : (
          filteredRecords.map(record => {
            const syncStatusText = getSyncStatusText(record.syncStatus);
            const syncStatusColor = getSyncStatusColor(record.syncStatus);

            return (
              <View key={record.id} className={classnames(styles.recordItem, record.syncStatus === 'failed' && styles.recordItemFailed)}>
                <View className={styles.recordHeader}>
                  <Text className={styles.recordDevice}>{record.deviceName}</Text>
                  <View className={styles.recordTags}>
                    {record.syncStatus !== 'synced' && (
                      <View
                        className={classnames(
                          styles.syncTag,
                          record.syncStatus === 'failed' ? styles.syncTagFailed : styles.syncTagPending
                        )}
                        onClick={() => record.syncStatus === 'failed' && handleRetrySync(record)}
                      >
                        {syncStatusText}
                        {record.syncStatus === 'failed' && ' · 点击重试'}
                      </View>
                    )}
                    {record.syncStatus === 'synced' && (
                      <View className={styles.recordSynced}>已提交</View>
                    )}
                    <StatusTag type="inspection" status={record.status} />
                  </View>
                </View>

                <View className={styles.recordBody}>
                  <Text className={styles.recordMeta}>资产编号：{record.assetCode}</Text>
                  <Text className={styles.recordMeta}>{record.pointName}</Text>
                  <Text className={styles.recordMeta}>
                    {formatTime(record.scanTime, 'HH:mm')} · {record.inspectorName} · {record.shift}
                  </Text>

                  {record.syncStatus === 'synced' && record.syncedAt && (
                    <Text className={styles.recordMeta} style={{ color: '#00b42a' }}>
                      ✓ 同步于 {formatTime(record.syncedAt, 'HH:mm')}
                    </Text>
                  )}

                  {record.syncStatus === 'failed' && record.syncError && (
                    <Text className={styles.recordMeta} style={{ color: '#f53f3f' }}>
                      ✗ 失败原因：{record.syncError}
                    </Text>
                  )}

                  {record.remark && (
                    <Text className={styles.recordRemark}>备注：{record.remark}</Text>
                  )}

                  {record.photos.length > 0 && (
                    <View className={styles.recordPhotos}>
                      {record.photos.map((photo, idx) => (
                        <Image
                          key={idx}
                          src={photo}
                          mode="aspectFill"
                          className={styles.recordPhoto}
                        />
                      ))}
                    </View>
                  )}

                  {record.faultReportId && (
                    <View className={styles.faultLinked}>
                      <Text className={styles.faultLinkedIcon}>🔗</Text>
                      <Text className={styles.faultLinkedText}>已关联故障单 #{record.faultReportId.slice(-6)}</Text>
                    </View>
                  )}

                  {record.status === 'abnormal' && record.syncStatus === 'synced' && !record.faultReportId && (
                    <View className={styles.reportBtn} onClick={() => handleReportFault(record)}>
                      <Text className={styles.reportBtnText}>+ 上报故障</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

export default ScanPage;

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatusTag from '@/components/StatusTag';
import { formatTime, showToast, getNetworkStatus, setNetworkStatus } from '@/utils';
import type { InspectionStatus } from '@/types/inspection';
import styles from './index.module.scss';

type FilterType = 'all' | 'normal' | 'abnormal' | 'missing' | 'disabled' | 'offline';

const ScanPage: React.FC = () => {
  const { scanRecords, syncOfflineRecords, addScanRecord, routes, currentRouteId, addFaultReport, maintainers } = useInspectionStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [isOnline, setIsOnline] = useState<boolean>(getNetworkStatus() === 'online');

  useDidShow(() => {
    console.log('[Scan] 页面显示');
    setIsOnline(getNetworkStatus() === 'online');
  });

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  });

  const offlineCount = useMemo(() => {
    return scanRecords.filter(r => r.isOffline && !r.synced).length;
  }, [scanRecords]);

  const todayRecords = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return scanRecords.filter(r => r.scanTime.slice(0, 10) === today);
  }, [scanRecords]);

  const filteredRecords = useMemo(() => {
    const records = todayRecords;
    if (filter === 'all') return records;
    if (filter === 'offline') return records.filter(r => r.isOffline);
    return records.filter(r => r.status === filter);
  }, [todayRecords, filter]);

  const currentRoute = useMemo(() => {
    return routes.find(r => r.id === currentRouteId) || null;
  }, [routes, currentRouteId]);

  const toggleNetwork = () => {
    const newStatus = isOnline ? 'offline' : 'online';
    setNetworkStatus(newStatus);
    setIsOnline(!isOnline);
    showToast(isOnline ? '已切换到离线模式' : '已切换到在线模式', 'none');
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
            isOffline: !isOnline
          });

          if (selectedStatus === 'abnormal' && isOnline) {
            Taro.showModal({
              title: '是否上报故障？',
              content: '检测到异常状态，是否立即上报故障单？',
              confirmText: '立即上报',
              cancelText: '暂不上报',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  addFaultReport({
                    deviceId: matchedDevice!.id,
                    assetCode: matchedDevice!.assetCode,
                    deviceName: matchedDevice!.name,
                    pointId: matchedPoint!.id,
                    pointName: matchedPoint!.name,
                    description: remark || `${matchedDevice!.name} 巡检发现异常`,
                    urgency: 'medium',
                    photos,
                    assigneeId: maintainers[0]?.id,
                    assigneeName: maintainers[0]?.name
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
    const count = syncOfflineRecords();
    if (count > 0) {
      setIsOnline(true);
    }
  };

  const filterOptions: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: '全部' },
    { key: 'normal', label: '正常' },
    { key: 'abnormal', label: '异常' },
    { key: 'missing', label: '缺失' },
    { key: 'disabled', label: '停用' },
    { key: 'offline', label: '待同步' }
  ];

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.scanArea}>
        <View className={classnames(styles.networkBadge, isOnline ? styles.online : styles.offline)} onClick={toggleNetwork}>
          <View className={styles.networkDot} />
          <Text className={styles.networkText}>{isOnline ? '在线' : '离线'}</Text>
        </View>

        <View className={styles.scanBtn} onClick={handleScan}>
          <Text className={styles.scanIcon}>📷</Text>
          <Text className={styles.scanBtnText}>扫描资产码</Text>
        </View>
        <Text className={styles.scanHint}>
          {currentRoute ? `当前路线：${currentRoute.name}` : '点击按钮扫描设备资产二维码'}
        </Text>
      </View>

      {offlineCount > 0 && (
        <View className={styles.offlineBar}>
          <View className={styles.offlineInfo}>
            <Text className={styles.offlineIcon}>📡</Text>
            <View>
              <Text className={styles.offlineText}>有 {offlineCount} 条记录待同步</Text>
              <Text className={styles.offlineCount}>连接网络后点击同步按钮上传</Text>
            </View>
          </View>
          <View className={styles.syncBtn} onClick={handleSync}>
            立即同步
          </View>
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
              : opt.key === 'offline' ? offlineCount
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
          filteredRecords.map(record => (
            <View key={record.id} className={styles.recordItem}>
              <View className={styles.recordHeader}>
                <Text className={styles.recordDevice}>{record.deviceName}</Text>
                <View className={styles.recordTags}>
                  {record.isOffline && !record.synced && (
                    <View className={styles.recordOffline}>待同步</View>
                  )}
                  {record.synced && !record.isOffline && (
                    <View className={styles.recordSynced}>已提交</View>
                  )}
                  <StatusTag type="inspection" status={record.status} />
                </View>
              </View>
              <View className={styles.recordBody}>
                <Text className={styles.recordMeta}>资产编号：{record.assetCode}</Text>
                <Text className={styles.recordMeta}>{record.pointName}</Text>
                <Text className={styles.recordMeta}>
                  {formatTime(record.scanTime, 'HH:mm')} · {record.inspectorName}
                </Text>
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
                {record.status === 'abnormal' && (
                  <View className={styles.reportBtn}>
                    <Text className={styles.reportBtnText}>+ 上报故障</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

export default ScanPage;

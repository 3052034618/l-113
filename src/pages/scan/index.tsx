import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { useInspectionStore } from '@/store/inspection';
import StatusTag from '@/components/StatusTag';
import { formatTime, showToast } from '@/utils';
import type { InspectionStatus } from '@/types/inspection';
import styles from './index.module.scss';

type FilterType = 'all' | 'normal' | 'abnormal' | 'missing' | 'disabled' | 'offline';

const ScanPage: React.FC = () => {
  const { scanRecords, syncOfflineRecords, addScanRecord, routes, currentRouteId } = useInspectionStore();
  const [filter, setFilter] = useState<FilterType>('all');

  useDidShow(() => {
    console.log('[Scan] 页面显示');
  });

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  });

  const offlineCount = useMemo(() => {
    return scanRecords.filter(r => r.isOffline && !r.synced).length;
  }, [scanRecords]);

  const filteredRecords = useMemo(() => {
    if (filter === 'all') return scanRecords;
    if (filter === 'offline') return scanRecords.filter(r => r.isOffline);
    return scanRecords.filter(r => r.status === filter);
  }, [scanRecords, filter]);

  const handleScan = async () => {
    try {
      const res = await Taro.scanCode({
        onlyFromCamera: false,
        scanType: ['qrCode', 'barCode']
      });

      console.log('[Scan] 扫码结果:', res.result);

      const assetCode = res.result;
      const currentRoute = routes.find(r => r.id === currentRouteId);

      let matchedDevice = null;
      let matchedPoint = null;

      if (currentRoute) {
        for (const point of currentRoute.points) {
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

          const isOffline = !Taro.getStorageSync('networkStatus') || Taro.getStorageSync('networkStatus') === 'offline';

          addScanRecord({
            deviceId: matchedDevice!.id,
            assetCode: matchedDevice!.assetCode,
            deviceName: matchedDevice!.name,
            pointId: matchedPoint!.id,
            pointName: matchedPoint!.name,
            status: selectedStatus,
            remark,
            photos,
            isOffline
          });

          showToast('记录已保存', 'success');
        }
      });
    } catch (e) {
      console.error('[Scan] 扫码失败:', e);
      showToast('扫码已取消');
    }
  };

  const handleSync = () => {
    syncOfflineRecords();
  };

  const filterOptions: { key: FilterType; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'normal', label: '正常' },
    { key: 'abnormal', label: '异常' },
    { key: 'missing', label: '缺失' },
    { key: 'disabled', label: '停用' },
    { key: 'offline', label: '离线' }
  ];

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.scanArea}>
        <View className={styles.scanBtn} onClick={handleScan}>
          <Text className={styles.scanIcon}>📷</Text>
          <Text className={styles.scanBtnText}>扫描资产码</Text>
        </View>
        <Text className={styles.scanHint}>点击按钮扫描设备资产二维码</Text>
      </View>

      {offlineCount > 0 && (
        <View className={styles.offlineBar}>
          <View className={styles.offlineInfo}>
            <Text className={styles.offlineText}>有 {offlineCount} 条离线记录待同步</Text>
            <Text className={styles.offlineCount}>连接网络后点击同步按钮上传</Text>
          </View>
          <View className={styles.syncBtn} onClick={handleSync}>
            立即同步
          </View>
        </View>
      )}

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>扫码记录</Text>
          <ScrollView scrollX className={styles.filterTabs}>
            {filterOptions.map(opt => (
              <View
                key={opt.key}
                className={classnames(styles.filterTab, filter === opt.key && styles.filterTabActive)}
                onClick={() => setFilter(opt.key)}
              >
                {opt.label}
              </View>
            ))}
          </ScrollView>
        </View>

        {filteredRecords.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📋</Text>
            <Text className={styles.emptyText}>暂无扫码记录</Text>
          </View>
        ) : (
          filteredRecords.map(record => (
            <View key={record.id} className={styles.recordItem}>
              <View className={styles.recordHeader}>
                <Text className={styles.recordDevice}>{record.deviceName}</Text>
                {record.isOffline && !record.synced && (
                  <View className={styles.recordOffline}>离线</View>
                )}
                <StatusTag type="inspection" status={record.status} />
              </View>
              <View className={styles.recordBody}>
                <Text className={styles.recordMeta}>资产编号：{record.assetCode}</Text>
                <Text className={styles.recordMeta}>{record.pointName}</Text>
                <Text className={styles.recordMeta}>{formatTime(record.scanTime)} · {record.inspectorName}</Text>
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
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

export default ScanPage;

import React, { useMemo } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useInspectionStore } from '@/store/inspection';
import StatusTag from '@/components/StatusTag';
import ProgressBar from '@/components/ProgressBar';
import { formatTime, showToast } from '@/utils';
import styles from './index.module.scss';

const FaultDetailPage: React.FC = () => {
  const router = useRouter();
  const { faultReports, maintainers, assignFault, updateFaultProgress, recheckFault } = useInspectionStore();
  const faultId = router.params.id;

  useDidShow(() => {
    console.log('[FaultDetail] 页面显示', faultId);
  });

  const fault = useMemo(() => {
    return faultReports.find(f => f.id === faultId);
  }, [faultReports, faultId]);

  const handleAssign = async () => {
    if (!fault) return;
    const names = maintainers.map(m => m.name);
    const res = await Taro.showActionSheet({ itemList: names });
    const selected = maintainers[res.tapIndex];
    assignFault(fault.id, selected.id, selected.name);
  };

  const handleUpdateProgress = async () => {
    if (!fault) return;
    const res = await Taro.showActionSheet({
      itemList: ['25% - 已开始', '50% - 进行中', '75% - 即将完成', '100% - 整改完成']
    });
    const progressValues = [25, 50, 75, 100];
    const progress = progressValues[res.tapIndex];
    const status = progress === 100 ? 'recheck' : 'processing';
    const remark = progress === 100 ? '整改完成，待复检' : `整改进度 ${progress}%`;
    updateFaultProgress(fault.id, progress, status, remark);
    showToast('进度已更新', 'success');
  };

  const handleRecheck = async () => {
    if (!fault) return;
    const res = await Taro.showActionSheet({
      itemList: ['复检通过', '需重新整改']
    });
    if (res.tapIndex === 0) {
      recheckFault(fault.id, 'pass');
    } else {
      recheckFault(fault.id, 'fail');
    }
  };

  if (!fault) {
    return (
      <View className={styles.page}>
        <View style={{ padding: 100, textAlign: 'center' }}>
          <Text>故障记录不存在</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.deviceName}>{fault.deviceName}</Text>
        <Text className={styles.deviceMeta}>
          {fault.assetCode} · {fault.pointName}
        </Text>
        <View className={styles.tagsRow}>
          <StatusTag type="urgency" status={fault.urgency} />
          <StatusTag type="rectify" status={fault.rectifyStatus} />
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>故障信息</Text>
        <View className={styles.infoCard}>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>设备名称</Text>
            <Text className={styles.infoValue}>{fault.deviceName}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>资产编号</Text>
            <Text className={styles.infoValue}>{fault.assetCode}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>所在点位</Text>
            <Text className={styles.infoValue}>{fault.pointName}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>上报人员</Text>
            <Text className={styles.infoValue}>{fault.reporterName}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>上报时间</Text>
            <Text className={styles.infoValue}>{formatTime(fault.reportTime)}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>紧急程度</Text>
            <View className={styles.infoValue}>
              <StatusTag type="urgency" status={fault.urgency} />
            </View>
          </View>
        </View>

        <Text className={styles.sectionTitle}>故障描述</Text>
        <View className={styles.infoCard}>
          <Text className={styles.descText}>{fault.description}</Text>
          {fault.photos.length > 0 && (
            <View className={styles.photoGrid}>
              {fault.photos.map((photo, idx) => (
                <View key={idx} className={styles.photoItem}>
                  <Image src={photo} mode="aspectFill" className={styles.photoImage} />
                </View>
              ))}
            </View>
          )}
        </View>

        <Text className={styles.sectionTitle}>整改进度</Text>
        <View className={styles.infoCard}>
          <View className={styles.progressSection}>
            <View className={styles.progressHeader}>
              <Text className={styles.progressLabel}>当前进度</Text>
              <Text className={styles.progressValue}>{fault.rectifyProgress}%</Text>
            </View>
            <ProgressBar progress={fault.rectifyProgress} height={12} showLabel={false} />
          </View>

          {fault.rectifyRemark && (
            <View style={{ marginTop: 24, padding: 16, background: '#f0f5ff', borderRadius: 12 }}>
              <Text style={{ fontSize: 26, color: '#165dff', fontWeight: 500 }}>
                📝 {fault.rectifyRemark}
              </Text>
            </View>
          )}

          {fault.assigneeName ? (
            <View className={styles.assigneeCard}>
              <View className={styles.assigneeAvatar}>
                <Text className={styles.assigneeAvatarText}>{fault.assigneeName.charAt(0)}</Text>
              </View>
              <View className={styles.assigneeInfo}>
                <Text className={styles.assigneeName}>维修负责人：{fault.assigneeName}</Text>
                <Text className={styles.assigneeDept}>
                  {maintainers.find(m => m.id === fault.assigneeId)?.department || '维修组'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 24, padding: 16, background: '#fff7e6', borderRadius: 12 }}>
              <Text style={{ fontSize: 26, color: '#ff7d00' }}>⚠️ 暂未指派维修负责人</Text>
            </View>
          )}

          {fault.rectifyTime && (
            <View className={styles.infoRow} style={{ marginTop: 16 }}>
              <Text className={styles.infoLabel}>整改完成</Text>
              <Text className={styles.infoValue}>{formatTime(fault.rectifyTime)}</Text>
            </View>
          )}
          {fault.recheckTime && (
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>复检时间</Text>
              <Text className={styles.infoValue}>
                {formatTime(fault.recheckTime)}
                {fault.recheckResult && ` · ${fault.recheckResult === 'pass' ? '复检通过' : '需重新整改'}`}
              </Text>
            </View>
          )}
        </View>

        <Text className={styles.sectionTitle}>处理时间线</Text>
        <View className={styles.infoCard}>
          <View className={styles.timelineItem}>
            <View className={styles.timelineDot} />
            <View className={styles.timelineContent}>
              <Text className={styles.timelineTitle}>故障上报</Text>
              <Text className={styles.timelineDesc}>{fault.reporterName} 上报故障</Text>
              <Text className={styles.timelineTime}>{formatTime(fault.reportTime)}</Text>
            </View>
          </View>
          {fault.assigneeName && (
            <View className={styles.timelineItem}>
              <View className={styles.timelineDot} />
              <View className={styles.timelineContent}>
                <Text className={styles.timelineTitle}>指派维修</Text>
                <Text className={styles.timelineDesc}>已指派 {fault.assigneeName} 负责维修</Text>
                <Text className={styles.timelineTime}>{formatTime(fault.reportTime)}</Text>
              </View>
            </View>
          )}
          {fault.rectifyProgress >= 25 && (
            <View className={styles.timelineItem}>
              <View className={styles.timelineDot} />
              <View className={styles.timelineContent}>
                <Text className={styles.timelineTitle}>维修进行中</Text>
                <Text className={styles.timelineDesc}>
                  当前进度 {fault.rectifyProgress}%
                  {fault.rectifyRemark && `：${fault.rectifyRemark}`}
                </Text>
                <Text className={styles.timelineTime}>
                  {fault.rectifyTime ? formatTime(fault.rectifyTime) : '进行中'}
                </Text>
              </View>
            </View>
          )}
          {fault.recheckTime && (
            <View className={styles.timelineItem}>
              <View className={styles.timelineDot} style={{ backgroundColor: fault.recheckResult === 'pass' ? '#00b42a' : '#ff7d00' }} />
              <View className={styles.timelineContent}>
                <Text className={styles.timelineTitle}>
                  {fault.recheckResult === 'pass' ? '复检通过' : '需重新整改'}
                </Text>
                <Text className={styles.timelineDesc}>
                  {fault.recheckResult === 'pass' ? '故障已彻底解决' : '整改不达标，需重新处理'}
                </Text>
                <Text className={styles.timelineTime}>{formatTime(fault.recheckTime)}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View className={styles.bottomBar}>
        {!fault.assigneeName && (
          <View className={styles.secondaryBtn} onClick={handleAssign}>
            指派人员
          </View>
        )}
        {fault.rectifyStatus === 'recheck' ? (
          <View className={styles.primaryBtn} onClick={handleRecheck}>
            进行复检
          </View>
        ) : fault.rectifyStatus !== 'completed' && (
          <View className={styles.primaryBtn} onClick={handleUpdateProgress}>
            更新进度
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default FaultDetailPage;

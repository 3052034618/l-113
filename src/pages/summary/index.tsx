import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Textarea } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useInspectionStore } from '@/store/inspection';
import { formatTime, getTodayStr, showToast } from '@/utils';
import StatusTag from '@/components/StatusTag';
import styles from './index.module.scss';

const SummaryPage: React.FC = () => {
  const { user, getTodayStats, faultReports } = useInspectionStore();
  const [shift, setShift] = useState<'早班' | '中班' | '晚班'>('早班');
  const [remarks, setRemarks] = useState('');

  const todayStats = getTodayStats();
  const pendingFaults = useMemo(() => {
    return faultReports.filter(f => f.rectifyStatus !== 'completed');
  }, [faultReports]);

  useDidShow(() => {
    console.log('[Summary] 页面显示');
  });

  const handleGenerate = () => {
    showToast('交接班摘要已生成', 'success');
    setTimeout(() => {
      Taro.showModal({
        title: '摘要已生成',
        content: `已生成${shift}交接班巡检摘要，可用于交接班签字确认。`,
        showCancel: false
      });
    }, 1500);
  };

  const handleCopy = () => {
    const summaryText = `
【${shift}交接班巡检摘要】
生成时间：${formatTime(new Date())}
巡检员：${user.name}（${user.department}）
日期：${getTodayStr()}

━━━━━━━━━━━━━━━━━━
一、巡检数据统计
━━━━━━━━━━━━━━━━━━
点位巡检：${todayStats?.checkedPoints || 0}/${todayStats?.totalPoints || 0} 个
设备巡检：${todayStats?.checkedDevices || 0}/${todayStats?.totalDevices || 0} 台
完成率：${todayStats?.completionRate || 0}%

状态分布：
• 正常：${todayStats?.normalCount || 0} 台
• 异常：${todayStats?.abnormalCount || 0} 台
• 缺失：${todayStats?.missingCount || 0} 台
• 停用：${todayStats?.disabledCount || 0} 台

━━━━━━━━━━━━━━━━━━
二、故障处理情况
━━━━━━━━━━━━━━━━━━
今日上报故障：${todayStats?.faultCount || 0} 项
已完成整改：${todayStats?.completedFaultCount || 0} 项
待处理/处理中：${pendingFaults.length} 项
超时项：${todayStats?.timeoutCount || 0} 项

━━━━━━━━━━━━━━━━━━
三、待办事项
━━━━━━━━━━━━━━━━━━
${pendingFaults.length > 0
  ? pendingFaults.map((f, i) => `${i + 1}. ${f.deviceName} - ${f.description}（${f.rectifyStatus === 'pending' ? '待处理' : f.rectifyStatus === 'processing' ? '处理中' : '待复检'}）`).join('\n')
  : '暂无待办事项'
}

━━━━━━━━━━━━━━━━━━
四、交接班备注
━━━━━━━━━━━━━━━━━━
${remarks || '无'}

巡检员签字：_______________    接班员签字：_______________
    `.trim();

    Taro.setClipboardData({
      data: summaryText,
      success: () => {
        showToast('摘要已复制到剪贴板', 'success');
      }
    });
  };

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>交接班巡检摘要</Text>
        <Text className={styles.subtitle}>汇总当日巡检数据，用于交接班确认</Text>
      </View>

      <View className={styles.section}>
        <View className={styles.summaryCard}>
          <View className={styles.summaryHeader}>
            <Text className={styles.summaryTitle}>巡检摘要</Text>
            <Text className={styles.summaryTime}>{formatTime(new Date())}</Text>
          </View>

          <View className={styles.inspectorInfo}>
            <View className={styles.avatar}>
              <Text className={styles.avatarText}>{user.name.charAt(0)}</Text>
            </View>
            <View>
              <Text className={styles.inspectorName}>{user.name}</Text>
              <Text className={styles.inspectorDept}>{user.department} · {shift}</Text>
            </View>
          </View>

          <View className={styles.formGroup}>
            <Text className={styles.formLabel}>班次选择</Text>
            <View style={{ display: 'flex', gap: 16 }}>
              {(['早班', '中班', '晚班'] as const).map(s => (
                <View
                  key={s}
                  style={{
                    flex: 1,
                    height: 72,
                    borderRadius: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    fontWeight: 500,
                    backgroundColor: shift === s ? '#165dff' : '#f2f3f5',
                    color: shift === s ? '#ffffff' : '#4e5969'
                  }}
                  onClick={() => setShift(s)}
                >
                  {s}
                </View>
              ))}
            </View>
          </View>

          <View className={styles.statsGrid}>
            <View className={styles.gridItem}>
              <Text className={styles.gridValuePrimary}>{todayStats?.checkedPoints || 0}</Text>
              <Text className={styles.gridLabel}>已检点位</Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={styles.gridValueSuccess}>{todayStats?.normalCount || 0}</Text>
              <Text className={styles.gridLabel}>正常</Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={styles.gridValueWarning}>{todayStats?.abnormalCount || 0}</Text>
              <Text className={styles.gridLabel}>异常</Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={styles.gridValueError}>{todayStats?.missingCount || 0}</Text>
              <Text className={styles.gridLabel}>缺失</Text>
            </View>
          </View>

          <Text className={styles.sectionTitle}>📊 巡检概况</Text>
          <View className={styles.dataRow}>
            <Text className={styles.dataLabel}>点位完成率</Text>
            <Text className={styles.dataValue}>{todayStats?.completionRate || 0}%</Text>
          </View>
          <View className={styles.dataRow}>
            <Text className={styles.dataLabel}>设备巡检率</Text>
            <Text className={styles.dataValue}>
              {todayStats?.checkedDevices || 0} / {todayStats?.totalDevices || 0} 台
            </Text>
          </View>
          <View className={styles.dataRow}>
            <Text className={styles.dataLabel}>停用设备</Text>
            <Text className={styles.dataValue}>{todayStats?.disabledCount || 0} 台</Text>
          </View>

          <Text className={styles.sectionTitle}>🔧 故障处理</Text>
          <View className={styles.dataRow}>
            <Text className={styles.dataLabel}>今日上报</Text>
            <Text className={styles.dataValue}>{todayStats?.faultCount || 0} 项</Text>
          </View>
          <View className={styles.dataRow}>
            <Text className={styles.dataLabel}>已完成整改</Text>
            <Text className={styles.dataValue} style={{ color: '#00b42a' }}>
              {todayStats?.completedFaultCount || 0} 项
            </Text>
          </View>
          <View className={styles.dataRow}>
            <Text className={styles.dataLabel}>超时项</Text>
            <Text className={styles.dataValue} style={{ color: '#f53f3f' }}>
              {todayStats?.timeoutCount || 0} 项
            </Text>
          </View>

          <Text className={styles.sectionTitle}>⚠️ 待交接事项（{pendingFaults.length}项）</Text>
          {pendingFaults.length === 0 ? (
            <View style={{ padding: 32, textAlign: 'center' }}>
              <Text style={{ fontSize: 26, color: '#86909c' }}>暂无待交接事项</Text>
            </View>
          ) : (
            pendingFaults.map(fault => (
              <View key={fault.id} className={styles.pendingItem}>
                <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text className={styles.pendingTitle}>{fault.deviceName}</Text>
                  <StatusTag type="rectify" status={fault.rectifyStatus} />
                </View>
                <Text className={styles.pendingDesc}>{fault.description}</Text>
                {fault.assigneeName && (
                  <Text style={{ fontSize: 22, color: '#165dff', marginTop: 4 }}>
                    负责人：{fault.assigneeName}
                  </Text>
                )}
              </View>
            ))
          )}

          <Text className={styles.sectionTitle}>📝 交接班备注</Text>
          <Textarea
            className={styles.remarksInput}
            placeholder="请输入交接班备注信息（选填）"
            value={remarks}
            onInput={(e) => setRemarks(e.detail.value)}
          />
        </View>
      </View>

      <View className={styles.bottomBar}>
        <View className={styles.secondaryBtn} onClick={handleCopy}>
          复制文本
        </View>
        <View className={styles.primaryBtn} onClick={handleGenerate}>
          生成摘要
        </View>
      </View>
    </ScrollView>
  );
};

export default SummaryPage;

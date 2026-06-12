import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import type {
  InspectionStatus,
  UrgencyLevel,
  RectifyStatus,
  ScanRecord,
  FaultReport,
  InspectionRoute,
  DailyStats
} from '@/types/inspection';

export const formatTime = (date: string | Date, format = 'YYYY-MM-DD HH:mm'): string => {
  return dayjs(date).format(format);
};

export const formatDate = (date: string | Date, format = 'YYYY-MM-DD'): string => {
  return dayjs(date).format(format);
};

export const getStatusText = (status: InspectionStatus): string => {
  const map: Record<InspectionStatus, string> = {
    normal: '正常',
    abnormal: '异常',
    missing: '缺失',
    disabled: '停用'
  };
  return map[status];
};

export const getUrgencyText = (urgency: UrgencyLevel): string => {
  const map: Record<UrgencyLevel, string> = {
    high: '紧急',
    medium: '一般',
    low: '较低'
  };
  return map[urgency];
};

export const getRectifyStatusText = (status: RectifyStatus): string => {
  const map: Record<RectifyStatus, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    recheck: '待复检'
  };
  return map[status];
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const calcCompletionRate = (checked: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((checked / total) * 100);
};

export const getTodayStr = (): string => {
  return dayjs().format('YYYY-MM-DD');
};

export const saveToStorage = <T>(key: string, data: T): void => {
  try {
    Taro.setStorageSync(key, JSON.stringify(data));
  } catch (e) {
    console.error('[Storage] 保存失败', key, e);
  }
};

export const getFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const data = Taro.getStorageSync(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error('[Storage] 读取失败', key, e);
    return defaultValue;
  }
};

export const showToast = (title: string, icon: 'success' | 'error' | 'none' = 'none'): void => {
  Taro.showToast({ title, icon, duration: 2000 });
};

export const isFaultTimeout = (fault: FaultReport): boolean => {
  if (fault.rectifyStatus === 'completed') return false;
  const now = dayjs();
  const reportTime = dayjs(fault.reportTime);
  const hoursPassed = now.diff(reportTime, 'hour');

  const thresholdMap: Record<UrgencyLevel, number> = {
    high: 2,
    medium: 8,
    low: 24
  };
  return hoursPassed > thresholdMap[fault.urgency];
};

export const calcStatsFromRecords = (
  date: string,
  routes: InspectionRoute[],
  scanRecords: ScanRecord[],
  faultReports: FaultReport[]
): DailyStats => {
  const dayStart = dayjs(date).startOf('day');
  const dayEnd = dayjs(date).endOf('day');

  const dayRecords = scanRecords.filter(r => {
    const t = dayjs(r.scanTime);
    return t.isAfter(dayStart) && t.isBefore(dayEnd);
  });

  const dayFaults = faultReports.filter(f => {
    const t = dayjs(f.reportTime);
    return t.isAfter(dayStart) && t.isBefore(dayEnd);
  });

  const dayRoutes = routes.filter(r => r.date === date);

  let totalPoints = 0;
  let checkedPoints = 0;
  let totalDevices = 0;
  let checkedDevices = 0;

  dayRoutes.forEach(route => {
    totalPoints += route.totalPoints;
    totalDevices += route.points.reduce((sum, p) => sum + p.totalDevices, 0);

    route.points.forEach(point => {
      const pointScans = dayRecords.filter(r => r.pointId === point.id);
      const uniqueCheckedDevices = new Set(pointScans.map(r => r.deviceId)).size;
      if (uniqueCheckedDevices >= point.totalDevices && point.totalDevices > 0) {
        checkedPoints++;
      }
      checkedDevices += uniqueCheckedDevices;
    });
  });

  const statusCounts = {
    normal: 0,
    abnormal: 0,
    missing: 0,
    disabled: 0
  };

  const seenDevices = new Set<string>();
  dayRecords.forEach(record => {
    if (seenDevices.has(record.deviceId)) return;
    seenDevices.add(record.deviceId);
    statusCounts[record.status]++;
  });

  const completedFaultCount = dayFaults.filter(f => f.rectifyStatus === 'completed').length;
  const timeoutCount = dayFaults.filter(f => isFaultTimeout(f)).length;
  const completionRate = calcCompletionRate(checkedPoints, totalPoints);

  return {
    date,
    totalPoints,
    checkedPoints,
    totalDevices,
    checkedDevices,
    normalCount: statusCounts.normal,
    abnormalCount: statusCounts.abnormal,
    missingCount: statusCounts.missing,
    disabledCount: statusCounts.disabled,
    faultCount: dayFaults.length,
    completedFaultCount,
    timeoutCount,
    completionRate
  };
};

export const getDateList = (days: number = 7): string[] => {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
  }
  return dates;
};

export const isSameDay = (time1: string | Date, time2: string | Date): boolean => {
  return dayjs(time1).format('YYYY-MM-DD') === dayjs(time2).format('YYYY-MM-DD');
};

export const getNetworkStatus = (): 'online' | 'offline' => {
  try {
    const status = Taro.getStorageSync('networkStatus');
    return status === 'offline' ? 'offline' : 'online';
  } catch (e) {
    return 'online';
  }
};

export const setNetworkStatus = (status: 'online' | 'offline'): void => {
  try {
    Taro.setStorageSync('networkStatus', status);
  } catch (e) {
    console.error('[Storage] 网络状态保存失败', e);
  }
};

import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import type {
  InspectionStatus,
  UrgencyLevel,
  RectifyStatus,
  ScanRecord,
  FaultReport,
  InspectionRoute,
  DailyStats,
  ShiftType,
  SyncStatus,
  TimelineAction,
  FaultTimelineItem,
  RouteMemberResult
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
    assigned: '已指派',
    accepted: '已接单',
    rejected: '已退回',
    processing: '处理中',
    completed: '已完成',
    recheck: '待复检',
    closed: '已关闭'
  };
  return map[status];
};

export const getTimelineActionText = (action: TimelineAction): string => {
  const map: Record<TimelineAction, string> = {
    create: '创建故障单',
    assign: '指派维修负责人',
    accept: '接单',
    reject: '退回',
    start: '开始整改',
    progress: '更新进度',
    complete: '整改完成',
    recheck_request: '申请复检',
    recheck_pass: '复检通过',
    recheck_fail: '复检不通过',
    close: '关闭工单'
  };
  return map[action];
};

export const getSyncStatusText = (status: SyncStatus): string => {
  const map: Record<SyncStatus, string> = {
    pending: '待上传',
    syncing: '同步中',
    synced: '已同步',
    failed: '同步失败'
  };
  return map[status];
};

export const getCurrentShift = (): ShiftType => {
  const hour = dayjs().hour();
  if (hour >= 6 && hour < 14) return '早班';
  if (hour >= 14 && hour < 22) return '中班';
  return '晚班';
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
  if (fault.rectifyStatus === 'completed' || fault.rectifyStatus === 'closed') return false;
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

export const createTimelineItem = (
  action: TimelineAction,
  operatorId: string,
  operatorName: string,
  remark?: string,
  progress?: number
): FaultTimelineItem => {
  return {
    id: generateId(),
    action,
    operatorId,
    operatorName,
    time: new Date().toISOString(),
    remark,
    progress
  };
};

export const calcStatsFromRecords = (
  date: string,
  shift: ShiftType,
  routes: InspectionRoute[],
  scanRecords: ScanRecord[],
  faultReports: FaultReport[]
): DailyStats => {
  const dayStart = dayjs(date).startOf('day');
  const dayEnd = dayjs(date).endOf('day');

  const dayRecords = scanRecords.filter(r => {
    const t = dayjs(r.scanTime);
    return t.isAfter(dayStart) && t.isBefore(dayEnd) && r.shift === shift && r.syncStatus === 'synced';
  });

  const dayFaults = faultReports.filter(f => {
    const t = dayjs(f.reportTime);
    return t.isAfter(dayStart) && t.isBefore(dayEnd) && f.shift === shift;
  });

  const dayRoutes = routes.filter(r => r.date === date && r.shift === shift);

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

  const completedFaultCount = dayFaults.filter(f => f.rectifyStatus === 'completed' || f.rectifyStatus === 'closed').length;
  const timeoutCount = dayFaults.filter(f => isFaultTimeout(f)).length;
  const completionRate = calcCompletionRate(checkedPoints, totalPoints);

  return {
    date,
    shift,
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

export const calcRouteMemberResults = (
  route: InspectionRoute,
  scanRecords: ScanRecord[]
): RouteMemberResult[] => {
  const results: RouteMemberResult[] = [];
  const memberMap = new Map<string, RouteMemberResult>();

  route.points.forEach(point => {
    const assignment = point.assignment;
    if (!assignment) return;

    const pointScans = scanRecords.filter(r => r.pointId === point.id);
    const checkedDevices = pointScans.filter(r => r.syncStatus === 'synced').length;
    const abnormalDevices = pointScans.filter(r => r.status === 'abnormal' && r.syncStatus === 'synced').length;

    const assigneeId = assignment.assigneeId;
    if (!memberMap.has(assigneeId)) {
      memberMap.set(assigneeId, {
        userId: assigneeId,
        userName: assignment.assigneeName,
        checkedDevices: 0,
        abnormalDevices: 0,
        durationMinutes: 0,
        pointIds: []
      });
    }

    const result = memberMap.get(assigneeId)!;
    result.checkedDevices += checkedDevices;
    result.abnormalDevices += abnormalDevices;
    result.pointIds.push(point.id);

    if (assignment.startTime && assignment.endTime) {
      const duration = dayjs(assignment.endTime).diff(dayjs(assignment.startTime), 'minute');
      result.durationMinutes += duration;
    }

    if (assignment.assistMemberIds) {
      assignment.assistMemberIds.forEach((assistId, idx) => {
        if (!memberMap.has(assistId)) {
          memberMap.set(assistId, {
            userId: assistId,
            userName: assignment.assistMemberNames?.[idx] || '协作者',
            checkedDevices: 0,
            abnormalDevices: 0,
            durationMinutes: 0,
            pointIds: []
          });
        }
        const assistResult = memberMap.get(assistId)!;
        assistResult.pointIds.push(point.id);
        assistResult.checkedDevices += Math.floor(checkedDevices / 2);
      });
    }
  });

  return Array.from(memberMap.values());
};

export const getDateList = (days: number = 7): string[] => {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
  }
  return dates;
};

export const getShiftList = (): ShiftType[] => ['早班', '中班', '晚班'];

export const isSameDay = (time1: string | Date, time2: string | Date): boolean => {
  return dayjs(time1).format('YYYY-MM-DD') === dayjs(time2).format('YYYY-MM-DD');
};

export const isSameShift = (time1: string | Date, time2: string | Date): boolean => {
  const getShift = (t: string | Date) => {
    const h = dayjs(t).hour();
    if (h >= 6 && h < 14) return '早班';
    if (h >= 14 && h < 22) return '中班';
    return '晚班';
  };
  return isSameDay(time1, time2) && getShift(time1) === getShift(time2);
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

export const mergeStatsByDate = (statsList: DailyStats[]): Omit<DailyStats, 'shift'> => {
  if (statsList.length === 0) {
    return {
      date: getTodayStr(),
      totalPoints: 0,
      checkedPoints: 0,
      totalDevices: 0,
      checkedDevices: 0,
      normalCount: 0,
      abnormalCount: 0,
      missingCount: 0,
      disabledCount: 0,
      faultCount: 0,
      completedFaultCount: 0,
      timeoutCount: 0,
      completionRate: 0
    };
  }

  const merged = statsList.reduce((acc, stat) => ({
    totalPoints: acc.totalPoints + stat.totalPoints,
    checkedPoints: acc.checkedPoints + stat.checkedPoints,
    totalDevices: acc.totalDevices + stat.totalDevices,
    checkedDevices: acc.checkedDevices + stat.checkedDevices,
    normalCount: acc.normalCount + stat.normalCount,
    abnormalCount: acc.abnormalCount + stat.abnormalCount,
    missingCount: acc.missingCount + stat.missingCount,
    disabledCount: acc.disabledCount + stat.disabledCount,
    faultCount: acc.faultCount + stat.faultCount,
    completedFaultCount: acc.completedFaultCount + stat.completedFaultCount,
    timeoutCount: acc.timeoutCount + stat.timeoutCount
  }), {
    totalPoints: 0, checkedPoints: 0, totalDevices: 0, checkedDevices: 0,
    normalCount: 0, abnormalCount: 0, missingCount: 0, disabledCount: 0,
    faultCount: 0, completedFaultCount: 0, timeoutCount: 0
  });

  return {
    date: statsList[0].date,
    ...merged,
    completionRate: calcCompletionRate(merged.checkedPoints, merged.totalPoints)
  };
};

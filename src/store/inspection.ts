import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type {
  InspectionRoute,
  ScanRecord,
  FaultReport,
  DailyStats,
  UserProfile,
  InspectionStatus,
  UrgencyLevel,
  RectifyStatus,
  AssetDevice,
  Team,
  PointOperationLog,
  PointAssignment,
  ShiftType,
  SyncStatus,
  FaultTimelineItem
} from '@/types/inspection';
import {
  mockRoutes,
  mockScanRecords,
  mockFaultReports,
  mockUser,
  mockMaintainers,
  mockTeam
} from '@/data/inspection';
import {
  generateId,
  getTodayStr,
  saveToStorage,
  getFromStorage,
  showToast,
  calcStatsFromRecords,
  getNetworkStatus,
  setNetworkStatus,
  getCurrentShift,
  createTimelineItem,
  calcRouteMemberResults,
  mergeStatsByDate,
  getShiftList
} from '@/utils';

interface InspectionState {
  user: UserProfile;
  team: Team;
  routes: InspectionRoute[];
  scanRecords: ScanRecord[];
  faultReports: FaultReport[];
  maintainers: UserProfile[];
  currentRouteId: string | null;
  isOnline: boolean;
  currentShift: ShiftType;
  operationLogs: PointOperationLog[];

  setCurrentRoute: (id: string) => void;
  claimRoute: (routeId: string) => void;
  completeRoute: (routeId: string) => void;

  assignPoint: (routeId: string, pointId: string, assigneeId: string, assigneeName: string) => void;
  transferPoint: (routeId: string, pointId: string, targetUserId: string, targetUserName: string, remark?: string) => void;
  requestAssist: (routeId: string, pointId: string, assistantId: string, assistantName: string) => void;

  addScanRecord: (record: Omit<ScanRecord, 'id' | 'scanTime' | 'inspectorId' | 'inspectorName' | 'isOffline' | 'syncStatus' | 'shift'>) => void;
  syncOfflineRecords: () => { success: number; failed: number };
  setNetworkMode: (online: boolean) => void;

  addFaultReport: (
    report: Omit<FaultReport, 'id' | 'reporterId' | 'reporterName' | 'reportTime' | 'rectifyStatus' | 'rectifyProgress' | 'recheckRequired' | 'timeline' | 'shift'> & {
      recheckRequired?: boolean;
      scanRecordId?: string;
    }
  ) => FaultReport;
  assignFault: (faultId: string, assigneeId: string, assigneeName: string) => void;
  acceptFault: (faultId: string) => void;
  rejectFault: (faultId: string, reason: string) => void;
  updateFaultProgress: (faultId: string, progress: number, status: RectifyStatus, remark?: string) => void;
  completeFault: (faultId: string, remark?: string) => void;
  recheckFault: (faultId: string, result: 'pass' | 'fail', remark?: string) => void;

  getStatsByDateAndShift: (date: string, shift: ShiftType) => DailyStats;
  getStatsByDate: (date: string) => Omit<DailyStats, 'shift'>;
  getTodayStats: () => Omit<DailyStats, 'shift'>;
  getTodayStatsByShift: (shift: ShiftType) => DailyStats;
  getTimeoutFaults: () => FaultReport[];

  getDeviceById: (deviceId: string) => AssetDevice | null;
  getPointById: (pointId: string) => { point: InspectionPoint; route: InspectionRoute } | null;
  getRouteMemberResults: (routeId: string) => import('@/types/inspection').RouteMemberResult[];

  getScanRecordById: (recordId: string) => ScanRecord | undefined;
  linkScanRecordToFault: (scanRecordId: string, faultId: string) => void;
  getFaultById: (faultId: string) => FaultReport | undefined;
}

const updateRouteProgress = (route: InspectionRoute, scanRecords: ScanRecord[]): InspectionRoute => {
  const syncedRecords = scanRecords.filter(r => r.syncStatus === 'synced');

  const points = route.points.map(point => {
    const pointRecords = syncedRecords.filter(r => r.pointId === point.id);
    const uniqueCheckedDevices = new Set(pointRecords.map(r => r.deviceId));
    const checkedDevices = uniqueCheckedDevices.size;

    const devices = point.devices.map(d => {
      const record = pointRecords.find(r => r.deviceId === d.id);
      if (record) {
        return { ...d, status: record.status, lastCheckTime: record.scanTime };
      }
      return d;
    });

    return { ...point, devices, checkedDevices };
  });

  const checkedPoints = points.filter(p => p.checkedDevices >= p.totalDevices && p.totalDevices > 0).length;
  const allCompleted = checkedPoints === points.length && points.length > 0;
  const memberResults = allCompleted ? calcRouteMemberResults({ ...route, points }, syncedRecords) : undefined;

  return {
    ...route,
    points,
    checkedPoints,
    status: allCompleted && route.status !== 'pending' ? 'completed' : route.status,
    endTime: allCompleted && !route.endTime ? new Date().toISOString() : route.endTime,
    memberResults
  };
};

export const useInspectionStore = create<InspectionState>((set, get) => ({
  user: mockUser,
  team: mockTeam,
  routes: getFromStorage('routes', mockRoutes),
  scanRecords: getFromStorage('scanRecords', mockScanRecords),
  faultReports: getFromStorage('faultReports', mockFaultReports),
  maintainers: mockMaintainers,
  currentRouteId: getFromStorage('currentRouteId', null),
  isOnline: getNetworkStatus() === 'online',
  currentShift: getCurrentShift(),
  operationLogs: getFromStorage('operationLogs', []),

  setCurrentRoute: (id) => {
    set({ currentRouteId: id });
    saveToStorage('currentRouteId', id);
  },

  claimRoute: (routeId) => {
    const user = get().user;
    const currentShift = get().currentShift;
    const routes = get().routes.map(r => {
      if (r.id !== routeId) return r;

      const memberAssignments: PointAssignment[] = r.points.map(point => ({
        pointId: point.id,
        assigneeId: user.id,
        assigneeName: user.name,
        assignTime: new Date().toISOString(),
        startTime: new Date().toISOString()
      }));

      return {
        ...r,
        status: 'in_progress' as const,
        startTime: new Date().toISOString(),
        inspectorId: user.id,
        inspectorName: user.name,
        shift: currentShift,
        memberAssignments,
        points: r.points.map((p, idx) => ({ ...p, assignment: memberAssignments[idx] }))
      };
    });
    set({ routes, currentRouteId: routeId });
    saveToStorage('routes', routes);
    saveToStorage('currentRouteId', routeId);
    showToast('已领取路线', 'success');
  },

  completeRoute: (routeId) => {
    const routes = get().routes.map(r =>
      r.id === routeId
        ? { ...r, status: 'completed' as const, endTime: new Date().toISOString() }
        : r
    );
    set({ routes });
    saveToStorage('routes', routes);
    showToast('路线已完成', 'success');
  },

  assignPoint: (routeId, pointId, assigneeId, assigneeName) => {
    const { routes, operationLogs, user } = get();
    const newAssignment: PointAssignment = {
      pointId,
      assigneeId,
      assigneeName,
      assignTime: new Date().toISOString(),
      startTime: new Date().toISOString()
    };

    const newLog: PointOperationLog = {
      id: generateId(),
      pointId,
      routeId,
      operation: 'assign',
      operatorId: user.id,
      operatorName: user.name,
      targetUserId: assigneeId,
      targetUserName: assigneeName,
      time: new Date().toISOString()
    };

    const updatedRoutes = routes.map(r => {
      if (r.id !== routeId) return r;
      const points = r.points.map(p =>
        p.id === pointId ? { ...p, assignment: newAssignment } : p
      );
      return { ...r, points };
    });

    set({ routes: updatedRoutes, operationLogs: [newLog, ...operationLogs] });
    saveToStorage('routes', updatedRoutes);
    saveToStorage('operationLogs', [newLog, ...operationLogs]);
    showToast(`已指派给${assigneeName}`, 'success');
  },

  transferPoint: (routeId, pointId, targetUserId, targetUserName, remark) => {
    const { routes, operationLogs, user } = get();
    const route = routes.find(r => r.id === routeId);
    const currentAssignment = route?.points.find(p => p.id === pointId)?.assignment;

    const newAssignment: PointAssignment = {
      pointId,
      assigneeId: targetUserId,
      assigneeName: targetUserName,
      assignTime: new Date().toISOString(),
      startTime: new Date().toISOString()
    };

    const newLog: PointOperationLog = {
      id: generateId(),
      pointId,
      routeId,
      operation: 'transfer',
      operatorId: user.id,
      operatorName: user.name,
      targetUserId,
      targetUserName,
      remark,
      time: new Date().toISOString()
    };

    const updatedRoutes = routes.map(r => {
      if (r.id !== routeId) return r;
      const points = r.points.map(p =>
        p.id === pointId ? { ...p, assignment: newAssignment } : p
      );
      return { ...r, points };
    });

    set({ routes: updatedRoutes, operationLogs: [newLog, ...operationLogs] });
    saveToStorage('routes', updatedRoutes);
    saveToStorage('operationLogs', [newLog, ...operationLogs]);
    showToast(`已转派给${targetUserName}`, 'success');
  },

  requestAssist: (routeId, pointId, assistantId, assistantName) => {
    const { routes, operationLogs, user } = get();
    const route = routes.find(r => r.id === routeId);
    const point = route?.points.find(p => p.id === pointId);
    const currentAssignment = point?.assignment;

    if (!currentAssignment) {
      showToast('点位未分配', 'error');
      return;
    }

    const assistMemberIds = currentAssignment.assistMemberIds || [];
    const assistMemberNames = currentAssignment.assistMemberNames || [];
    if (!assistMemberIds.includes(assistantId)) {
      assistMemberIds.push(assistantId);
      assistMemberNames.push(assistantName);
    }

    const newAssignment: PointAssignment = {
      ...currentAssignment,
      assistMemberIds,
      assistMemberNames
    };

    const newLog: PointOperationLog = {
      id: generateId(),
      pointId,
      routeId,
      operation: 'assist',
      operatorId: user.id,
      operatorName: user.name,
      targetUserId: assistantId,
      targetUserName: assistantName,
      remark: '请求协助',
      time: new Date().toISOString()
    };

    const updatedRoutes = routes.map(r => {
      if (r.id !== routeId) return r;
      const points = r.points.map(p =>
        p.id === pointId ? { ...p, assignment: newAssignment } : p
      );
      return { ...r, points };
    });

    set({ routes: updatedRoutes, operationLogs: [newLog, ...operationLogs] });
    saveToStorage('routes', updatedRoutes);
    saveToStorage('operationLogs', [newLog, ...operationLogs]);
    showToast(`已请求${assistantName}协助`, 'success');
  },

  addScanRecord: (record) => {
    const user = get().user;
    const isOnline = get().isOnline;
    const currentShift = get().currentShift;
    const isOffline = record.isOffline || !isOnline;

    const syncStatus: SyncStatus = isOffline ? 'pending' : 'synced';

    const newRecord: ScanRecord = {
      ...record,
      id: generateId(),
      scanTime: new Date().toISOString(),
      inspectorId: user.id,
      inspectorName: user.name,
      isOffline,
      syncStatus,
      shift: currentShift
    };

    const scanRecords = [newRecord, ...get().scanRecords];
    set({ scanRecords });
    saveToStorage('scanRecords', scanRecords);

    if (syncStatus === 'synced' && record.pointId && record.deviceId) {
      const routes = get().routes.map(route => updateRouteProgress(route, scanRecords));
      set({ routes });
      saveToStorage('routes', routes);
    }

    showToast(isOffline ? '已保存到离线队列' : '记录已提交', 'success');
  },

  syncOfflineRecords: () => {
    const state = get();
    const pendingRecords = state.scanRecords.filter(r => r.syncStatus === 'pending');

    if (pendingRecords.length === 0) {
      showToast('暂无待上传记录', 'none');
      return { success: 0, failed: 0 };
    }

    let successCount = 0;
    let failedCount = 0;

    const scanRecords = state.scanRecords.map(r => {
      if (r.syncStatus !== 'pending') return r;

      const shouldFail = Math.random() < 0.1;
      if (shouldFail) {
        failedCount++;
        return {
          ...r,
          syncStatus: 'failed' as const,
          syncError: '网络超时，请稍后重试'
        };
      }

      successCount++;
      return {
        ...r,
        syncStatus: 'synced' as const,
        syncedAt: new Date().toISOString()
      };
    });

    const routes = state.routes.map(route => updateRouteProgress(route, scanRecords));

    set({ scanRecords, routes });
    saveToStorage('scanRecords', scanRecords);
    saveToStorage('routes', routes);

    if (failedCount > 0) {
      showToast(`同步完成：成功${successCount}条，失败${failedCount}条`, failedCount > 0 ? 'none' : 'success');
    } else {
      showToast(`已同步 ${successCount} 条记录`, 'success');
    }

    return { success: successCount, failed: failedCount };
  },

  setNetworkMode: (online) => {
    set({ isOnline: online });
    setNetworkStatus(online ? 'online' : 'offline');
    showToast(online ? '已切换到在线模式' : '已切换到离线模式', 'none');
  },

  addFaultReport: (report) => {
    const user = get().user;
    const currentShift = get().currentShift;

    const timeline: FaultTimelineItem[] = [
      createTimelineItem('create', user.id, user.name, report.description)
    ];

    let rectifyStatus: RectifyStatus = 'pending';
    if (report.assigneeId) {
      rectifyStatus = 'assigned';
      timeline.push(createTimelineItem('assign', user.id, user.name, `指派给${report.assigneeName}`));
    }

    const newReport: FaultReport = {
      ...report,
      id: generateId(),
      reporterId: user.id,
      reporterName: user.name,
      reportTime: new Date().toISOString(),
      shift: currentShift,
      rectifyStatus,
      rectifyProgress: 0,
      recheckRequired: report.recheckRequired !== false,
      timeline,
      assignTime: report.assigneeId ? new Date().toISOString() : undefined
    };

    const faultReports = [newReport, ...get().faultReports];
    set({ faultReports });
    saveToStorage('faultReports', faultReports);

    if (report.scanRecordId) {
      get().linkScanRecordToFault(report.scanRecordId, newReport.id);
    }

    showToast('故障已上报', 'success');
    return newReport;
  },

  assignFault: (faultId, assigneeId, assigneeName) => {
    const user = get().user;
    const faultReports = get().faultReports.map(f => {
      if (f.id !== faultId) return f;
      const newTimeline = [
        ...f.timeline,
        createTimelineItem('assign', user.id, user.name, `指派给${assigneeName}`)
      ];
      return {
        ...f,
        assigneeId,
        assigneeName,
        assignTime: new Date().toISOString(),
        rectifyStatus: 'assigned' as const,
        timeline: newTimeline
      };
    });
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
    showToast('已指派维修负责人', 'success');
  },

  acceptFault: (faultId) => {
    const user = get().user;
    const faultReports = get().faultReports.map(f => {
      if (f.id !== faultId) return f;
      const newTimeline = [
        ...f.timeline,
        createTimelineItem('accept', user.id, user.name, '已接单，开始处理')
      ];
      return {
        ...f,
        acceptedAt: new Date().toISOString(),
        rectifyStatus: 'processing' as const,
        rectifyProgress: 25,
        timeline: newTimeline
      };
    });
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
    showToast('已接单', 'success');
  },

  rejectFault: (faultId, reason) => {
    const user = get().user;
    const faultReports = get().faultReports.map(f => {
      if (f.id !== faultId) return f;
      const newTimeline = [
        ...f.timeline,
        createTimelineItem('reject', user.id, user.name, reason)
      ];
      return {
        ...f,
        rejectedAt: new Date().toISOString(),
        rejectReason: reason,
        rectifyStatus: 'pending' as const,
        assigneeId: undefined,
        assigneeName: undefined,
        timeline: newTimeline
      };
    });
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
    showToast('已退回', 'none');
  },

  updateFaultProgress: (faultId, progress, status, remark) => {
    const user = get().user;
    const faultReports = get().faultReports.map(f => {
      if (f.id !== faultId) return f;
      const newTimeline = [
        ...f.timeline,
        createTimelineItem('progress', user.id, user.name, remark || `进度更新到 ${progress}%`, progress)
      ];

      const updates: Partial<FaultReport> = {
        rectifyProgress: progress,
        rectifyStatus: status,
        rectifyRemark: remark || f.rectifyRemark,
        timeline: newTimeline
      };

      if (status === 'closed') {
        updates.closedAt = new Date().toISOString();
        newTimeline.push(createTimelineItem('close', user.id, user.name, '无需复检，自动关闭'));
      }

      if (status === 'recheck') {
        newTimeline.push(createTimelineItem('recheck_request', user.id, user.name, '申请复检'));
      }

      return { ...f, ...updates };
    });
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
  },

  completeFault: (faultId, remark) => {
    const user = get().user;
    const faultReports = get().faultReports.map(f => {
      if (f.id !== faultId) return f;

      const newTimeline = [
        ...f.timeline,
        createTimelineItem('complete', user.id, user.name, remark || '整改完成')
      ];

      if (f.recheckRequired) {
        newTimeline.push(createTimelineItem('recheck_request', user.id, user.name, '申请复检'));
      } else {
        newTimeline.push(createTimelineItem('close', user.id, user.name, '无需复检，自动关闭'));
      }

      return {
        ...f,
        rectifyProgress: 100,
        rectifyStatus: f.recheckRequired ? 'recheck' as const : 'closed' as const,
        rectifyTime: new Date().toISOString(),
        rectifyRemark: remark || f.rectifyRemark,
        closedAt: f.recheckRequired ? undefined : new Date().toISOString(),
        timeline: newTimeline
      };
    });
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
    showToast('整改已完成', 'success');
  },

  recheckFault: (faultId, result, remark) => {
    const user = get().user;
    const action = result === 'pass' ? 'recheck_pass' : 'recheck_fail';

    const faultReports = get().faultReports.map(f => {
      if (f.id !== faultId) return f;
      const newTimeline = [
        ...f.timeline,
        createTimelineItem(action, user.id, user.name, remark || (result === 'pass' ? '复检通过' : '复检不通过，需重新整改'))
      ];

      if (result === 'pass') {
        newTimeline.push(createTimelineItem('close', user.id, user.name, '工单已关闭'));
      }

      return {
        ...f,
        recheckTime: new Date().toISOString(),
        recheckResult: result,
        recheckRemark: remark,
        rectifyStatus: result === 'pass' ? 'closed' as const : 'processing' as const,
        rectifyProgress: result === 'pass' ? 100 : 25,
        closedAt: result === 'pass' ? new Date().toISOString() : undefined,
        timeline: newTimeline
      };
    });
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
    showToast(result === 'pass' ? '复检通过' : '需重新整改', result === 'pass' ? 'success' : 'none');
  },

  getStatsByDateAndShift: (date, shift) => {
    const state = get();
    return calcStatsFromRecords(date, shift, state.routes, state.scanRecords, state.faultReports);
  },

  getStatsByDate: (date) => {
    const shifts = getShiftList();
    const state = get();
    const shiftStats = shifts.map(s => calcStatsFromRecords(date, s, state.routes, state.scanRecords, state.faultReports));
    return mergeStatsByDate(shiftStats);
  },

  getTodayStats: () => {
    return get().getStatsByDate(getTodayStr());
  },

  getTodayStatsByShift: (shift) => {
    return get().getStatsByDateAndShift(getTodayStr(), shift);
  },

  getTimeoutFaults: () => {
    const { faultReports } = get();
    return faultReports.filter(f => {
      if (f.rectifyStatus === 'closed' || f.rectifyStatus === 'completed') return false;
      return true;
    }).sort((a, b) => new Date(a.reportTime).getTime() - new Date(b.reportTime).getTime());
  },

  getDeviceById: (deviceId) => {
    for (const route of get().routes) {
      for (const point of route.points) {
        const device = point.devices.find(d => d.id === deviceId);
        if (device) return device;
      }
    }
    return null;
  },

  getPointById: (pointId) => {
    for (const route of get().routes) {
      const point = route.points.find(p => p.id === pointId);
      if (point) return { point, route };
    }
    return null;
  },

  getRouteMemberResults: (routeId) => {
    const state = get();
    const route = state.routes.find(r => r.id === routeId);
    if (!route) return [];
    return calcRouteMemberResults(route, state.scanRecords);
  },

  getScanRecordById: (recordId) => {
    return get().scanRecords.find(r => r.id === recordId);
  },

  linkScanRecordToFault: (scanRecordId, faultId) => {
    const scanRecords = get().scanRecords.map(r =>
      r.id === scanRecordId ? { ...r, faultReportId: faultId } : r
    );
    set({ scanRecords });
    saveToStorage('scanRecords', scanRecords);
  },

  getFaultById: (faultId) => {
    return get().faultReports.find(f => f.id === faultId);
  }
}));

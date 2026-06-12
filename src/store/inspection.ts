import { create } from 'zustand';
import type {
  InspectionRoute,
  ScanRecord,
  FaultReport,
  DailyStats,
  UserProfile,
  InspectionStatus,
  UrgencyLevel,
  RectifyStatus,
  AssetDevice
} from '@/types/inspection';
import {
  mockRoutes,
  mockScanRecords,
  mockFaultReports,
  mockUser,
  mockMaintainers
} from '@/data/inspection';
import {
  generateId,
  getTodayStr,
  saveToStorage,
  getFromStorage,
  showToast,
  calcStatsFromRecords,
  getNetworkStatus
} from '@/utils';

interface InspectionState {
  user: UserProfile;
  routes: InspectionRoute[];
  scanRecords: ScanRecord[];
  faultReports: FaultReport[];
  maintainers: UserProfile[];
  currentRouteId: string | null;

  setCurrentRoute: (id: string) => void;
  claimRoute: (routeId: string) => void;
  completeRoute: (routeId: string) => void;

  addScanRecord: (record: Omit<ScanRecord, 'id' | 'scanTime' | 'inspectorId' | 'inspectorName' | 'synced'>) => void;
  syncOfflineRecords: () => number;

  addFaultReport: (
    report: Omit<FaultReport, 'id' | 'reporterId' | 'reporterName' | 'reportTime' | 'rectifyStatus' | 'rectifyProgress' | 'recheckRequired'> & { recheckRequired?: boolean }
  ) => void;
  updateFaultProgress: (faultId: string, progress: number, status: RectifyStatus, remark?: string) => void;
  assignFault: (faultId: string, assigneeId: string, assigneeName: string) => void;
  recheckFault: (faultId: string, result: 'pass' | 'fail') => void;

  getStatsByDate: (date: string) => DailyStats;
  getTodayStats: () => DailyStats;
  getTimeoutFaults: () => FaultReport[];

  getDeviceById: (deviceId: string) => AssetDevice | null;
  getPointById: (pointId: string) => { point: any; route: InspectionRoute } | null;
}

const updateRouteProgress = (route: InspectionRoute): InspectionRoute => {
  const points = route.points.map(point => {
    const checkedDevices = point.devices.filter(d => d.lastCheckTime).length;
    return { ...point, checkedDevices };
  });
  const checkedPoints = points.filter(p => p.checkedDevices >= p.totalDevices && p.totalDevices > 0).length;
  const allCompleted = checkedPoints === points.length && points.length > 0;

  return {
    ...route,
    points,
    checkedPoints,
    status: allCompleted && route.status !== 'pending' ? 'completed' : route.status,
    endTime: allCompleted && !route.endTime ? new Date().toISOString() : route.endTime
  };
};

export const useInspectionStore = create<InspectionState>((set, get) => ({
  user: mockUser,
  routes: getFromStorage('routes', mockRoutes),
  scanRecords: getFromStorage('scanRecords', mockScanRecords),
  faultReports: getFromStorage('faultReports', mockFaultReports),
  maintainers: mockMaintainers,
  currentRouteId: getFromStorage('currentRouteId', null),

  setCurrentRoute: (id) => {
    set({ currentRouteId: id });
    saveToStorage('currentRouteId', id);
  },

  claimRoute: (routeId) => {
    const routes = get().routes.map(r =>
      r.id === routeId
        ? { ...r, status: 'in_progress' as const, startTime: new Date().toISOString() }
        : r
    );
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

  addScanRecord: (record) => {
    const user = get().user;
    const isOnline = getNetworkStatus() === 'online';
    const isOffline = record.isOffline || !isOnline;

    const newRecord: ScanRecord = {
      ...record,
      id: generateId(),
      scanTime: new Date().toISOString(),
      inspectorId: user.id,
      inspectorName: user.name,
      isOffline,
      synced: !isOffline
    };

    const scanRecords = [newRecord, ...get().scanRecords];
    set({ scanRecords });
    saveToStorage('scanRecords', scanRecords);

    if (!isOffline && record.pointId && record.deviceId) {
      const routes = get().routes.map(route => {
        let updated = false;
        const points = route.points.map(point => {
          if (point.id !== record.pointId) return point;
          updated = true;
          const devices = point.devices.map(d =>
            d.id === record.deviceId
              ? { ...d, status: record.status, lastCheckTime: newRecord.scanTime }
              : d
          );
          return { ...point, devices };
        });
        if (!updated) return route;
        return updateRouteProgress({ ...route, points });
      });
      set({ routes });
      saveToStorage('routes', routes);
    }

    showToast(isOffline ? '已保存到离线队列' : '记录已提交', 'success');
  },

  syncOfflineRecords: () => {
    const state = get();
    const offlineRecords = state.scanRecords.filter(r => r.isOffline && !r.synced);

    if (offlineRecords.length === 0) {
      showToast('暂无离线记录', 'none');
      return 0;
    }

    const routesMap = new Map<string, InspectionRoute>();
    state.routes.forEach(r => routesMap.set(r.id, { ...r, points: r.points.map(p => ({ ...p, devices: [...p.devices] })) }));

    offlineRecords.forEach(record => {
      for (const [routeId, route] of routesMap) {
        const point = route.points.find(p => p.id === record.pointId);
        if (point) {
          const device = point.devices.find(d => d.id === record.deviceId);
          if (device) {
            device.status = record.status;
            device.lastCheckTime = record.scanTime;
          }
        }
      }
    });

    const routes = Array.from(routesMap.values()).map(route => updateRouteProgress(route));

    const scanRecords = state.scanRecords.map(r =>
      r.isOffline ? { ...r, isOffline: false, synced: true } : r
    );

    set({ routes, scanRecords });
    saveToStorage('routes', routes);
    saveToStorage('scanRecords', scanRecords);

    showToast(`已同步 ${offlineRecords.length} 条离线记录`, 'success');
    return offlineRecords.length;
  },

  addFaultReport: (report) => {
    const user = get().user;
    const newReport: FaultReport = {
      ...report,
      id: generateId(),
      reporterId: user.id,
      reporterName: user.name,
      reportTime: new Date().toISOString(),
      rectifyStatus: report.assigneeId ? 'processing' : 'pending',
      rectifyProgress: 0,
      recheckRequired: report.recheckRequired !== false
    };
    const faultReports = [newReport, ...get().faultReports];
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
    showToast('故障已上报', 'success');
  },

  updateFaultProgress: (faultId, progress, status, remark) => {
    const faultReports = get().faultReports.map(f =>
      f.id === faultId
        ? {
            ...f,
            rectifyProgress: progress,
            rectifyStatus: status,
            rectifyRemark: remark || f.rectifyRemark,
            rectifyTime: progress === 100 ? new Date().toISOString() : f.rectifyTime,
            recheckRequired: progress === 100 ? f.recheckRequired : f.recheckRequired
          }
        : f
    );
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
  },

  assignFault: (faultId, assigneeId, assigneeName) => {
    const faultReports = get().faultReports.map(f =>
      f.id === faultId
        ? { ...f, assigneeId, assigneeName, rectifyStatus: 'processing' as const }
        : f
    );
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
    showToast('已指派维修负责人', 'success');
  },

  recheckFault: (faultId, result) => {
    const faultReports = get().faultReports.map(f =>
      f.id === faultId
        ? {
            ...f,
            recheckTime: new Date().toISOString(),
            recheckResult: result,
            rectifyStatus: result === 'pass' ? 'completed' : 'processing' as RectifyStatus,
            rectifyProgress: result === 'pass' ? 100 : f.rectifyProgress
          }
        : f
    );
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
    showToast(result === 'pass' ? '复检通过' : '需重新整改', result === 'pass' ? 'success' : 'none');
  },

  getStatsByDate: (date) => {
    const state = get();
    return calcStatsFromRecords(date, state.routes, state.scanRecords, state.faultReports);
  },

  getTodayStats: () => {
    return get().getStatsByDate(getTodayStr());
  },

  getTimeoutFaults: () => {
    const { faultReports, getStatsByDate } = get();
    const today = getTodayStr();
    const stats = getStatsByDate(today);
    return faultReports.filter(f => {
      if (f.rectifyStatus === 'completed') return false;
      const reportDate = f.reportTime.slice(0, 10);
      return reportDate <= today;
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
  }
}));

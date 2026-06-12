import { create } from 'zustand';
import type {
  InspectionRoute,
  ScanRecord,
  FaultReport,
  DailyStats,
  UserProfile,
  InspectionStatus,
  UrgencyLevel
} from '@/types/inspection';
import {
  mockRoutes,
  mockScanRecords,
  mockFaultReports,
  mockDailyStats,
  mockUser,
  mockMaintainers
} from '@/data/inspection';
import { generateId, getTodayStr, saveToStorage, getFromStorage, showToast } from '@/utils';

interface InspectionState {
  user: UserProfile;
  routes: InspectionRoute[];
  scanRecords: ScanRecord[];
  faultReports: FaultReport[];
  dailyStats: DailyStats[];
  maintainers: UserProfile[];
  currentRouteId: string | null;

  setCurrentRoute: (id: string) => void;
  claimRoute: (routeId: string) => void;
  addScanRecord: (record: Omit<ScanRecord, 'id' | 'scanTime' | 'inspectorId' | 'inspectorName' | 'synced'>) => void;
  syncOfflineRecords: () => void;
  addFaultReport: (
    report: Omit<FaultReport, 'id' | 'reporterId' | 'reporterName' | 'reportTime' | 'rectifyStatus' | 'rectifyProgress' | 'recheckRequired'>
  ) => void;
  updateFaultProgress: (faultId: string, progress: number, status: FaultReport['rectifyStatus'], remark?: string) => void;
  assignFault: (faultId: string, assigneeId: string, assigneeName: string) => void;
  recheckFault: (faultId: string, result: 'pass' | 'fail') => void;
  updateDeviceStatus: (routeId: string, pointId: string, deviceId: string, status: InspectionStatus) => void;
  getTodayStats: () => DailyStats | undefined;
}

export const useInspectionStore = create<InspectionState>((set, get) => ({
  user: mockUser,
  routes: getFromStorage('routes', mockRoutes),
  scanRecords: getFromStorage('scanRecords', mockScanRecords),
  faultReports: getFromStorage('faultReports', mockFaultReports),
  dailyStats: getFromStorage('dailyStats', mockDailyStats),
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

  addScanRecord: (record) => {
    const user = get().user;
    const newRecord: ScanRecord = {
      ...record,
      id: generateId(),
      scanTime: new Date().toISOString(),
      inspectorId: user.id,
      inspectorName: user.name,
      synced: !record.isOffline
    };
    const scanRecords = [newRecord, ...get().scanRecords];
    set({ scanRecords });
    saveToStorage('scanRecords', scanRecords);

    if (record.pointId && record.deviceId) {
      get().updateDeviceStatus(
        get().currentRouteId || '',
        record.pointId,
        record.deviceId,
        record.status
      );
    }
  },

  syncOfflineRecords: () => {
    const scanRecords = get().scanRecords.map(r =>
      r.isOffline ? { ...r, isOffline: false, synced: true } : r
    );
    set({ scanRecords });
    saveToStorage('scanRecords', scanRecords);
    const count = get().scanRecords.filter(r => r.isOffline).length;
    showToast(`已同步 ${count} 条离线记录`, 'success');
  },

  addFaultReport: (report) => {
    const user = get().user;
    const newReport: FaultReport = {
      ...report,
      id: generateId(),
      reporterId: user.id,
      reporterName: user.name,
      reportTime: new Date().toISOString(),
      rectifyStatus: 'pending',
      rectifyProgress: 0,
      recheckRequired: true
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
            rectifyTime: progress === 100 ? new Date().toISOString() : f.rectifyTime
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
            rectifyStatus: result === 'pass' ? 'completed' : 'processing'
          }
        : f
    );
    set({ faultReports });
    saveToStorage('faultReports', faultReports);
    showToast(result === 'pass' ? '复检通过' : '需重新整改', result === 'pass' ? 'success' : 'none');
  },

  updateDeviceStatus: (routeId, pointId, deviceId, status) => {
    const routes = get().routes.map(route => {
      if (route.id !== routeId) return route;
      return {
        ...route,
        points: route.points.map(point => {
          if (point.id !== pointId) return point;
          const devices = point.devices.map(d =>
            d.id === deviceId ? { ...d, status, lastCheckTime: new Date().toISOString() } : d
          );
          const checkedDevices = devices.filter(d => d.lastCheckTime).length;
          return { ...point, devices, checkedDevices };
        }),
        checkedPoints: route.points.filter(p => p.checkedDevices === p.totalDevices).length
      };
    });
    set({ routes });
    saveToStorage('routes', routes);
  },

  getTodayStats: () => {
    return get().dailyStats.find(s => s.date === getTodayStr());
  }
}));

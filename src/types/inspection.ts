export type InspectionStatus = 'normal' | 'abnormal' | 'missing' | 'disabled';

export type UrgencyLevel = 'high' | 'medium' | 'low';

export type RectifyStatus = 'pending' | 'processing' | 'completed' | 'recheck';

export interface AssetDevice {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  model: string;
  location: string;
  pointId: string;
  status: InspectionStatus;
  lastCheckTime?: string;
}

export interface InspectionPoint {
  id: string;
  name: string;
  type: '机房' | '会议室' | '仓库' | '办公区' | '其他';
  building: string;
  floor: string;
  devices: AssetDevice[];
  totalDevices: number;
  checkedDevices: number;
  order: number;
}

export interface InspectionRoute {
  id: string;
  name: string;
  date: string;
  inspectorId: string;
  inspectorName: string;
  points: InspectionPoint[];
  totalPoints: number;
  checkedPoints: number;
  status: 'pending' | 'in_progress' | 'completed';
  startTime?: string;
  endTime?: string;
}

export interface ScanRecord {
  id: string;
  deviceId: string;
  assetCode: string;
  deviceName: string;
  pointId: string;
  pointName: string;
  status: InspectionStatus;
  remark?: string;
  photos: string[];
  scanTime: string;
  inspectorId: string;
  inspectorName: string;
  isOffline: boolean;
  synced: boolean;
}

export interface FaultReport {
  id: string;
  deviceId: string;
  assetCode: string;
  deviceName: string;
  pointId: string;
  pointName: string;
  description: string;
  urgency: UrgencyLevel;
  photos: string[];
  reporterId: string;
  reporterName: string;
  reportTime: string;
  assigneeId?: string;
  assigneeName?: string;
  rectifyStatus: RectifyStatus;
  rectifyProgress: number;
  rectifyRemark?: string;
  rectifyTime?: string;
  recheckRequired: boolean;
  recheckTime?: string;
  recheckResult?: 'pass' | 'fail';
}

export interface DailyStats {
  date: string;
  totalPoints: number;
  checkedPoints: number;
  totalDevices: number;
  checkedDevices: number;
  normalCount: number;
  abnormalCount: number;
  missingCount: number;
  disabledCount: number;
  faultCount: number;
  completedFaultCount: number;
  timeoutCount: number;
  completionRate: number;
}

export interface UserProfile {
  id: string;
  name: string;
  department: string;
  role: 'inspector' | 'maintainer' | 'admin';
  phone: string;
}

export interface ShiftSummary {
  id: string;
  date: string;
  shift: '早班' | '中班' | '晚班';
  inspectorId: string;
  inspectorName: string;
  stats: DailyStats;
  pendingFaults: FaultReport[];
  remarks: string;
  generatedAt: string;
}

export type InspectionStatus = 'normal' | 'abnormal' | 'missing' | 'disabled';

export type UrgencyLevel = 'high' | 'medium' | 'low';

export type RectifyStatus = 'pending' | 'assigned' | 'accepted' | 'rejected' | 'processing' | 'completed' | 'recheck' | 'closed';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type ShiftType = '早班' | '中班' | '晚班';

export type PointOperationType = 'assign' | 'transfer' | 'assist' | 'complete';

export type TimelineAction = 'create' | 'assign' | 'accept' | 'reject' | 'start' | 'progress' | 'complete' | 'recheck_request' | 'recheck_pass' | 'recheck_fail' | 'close';

export interface Team {
  id: string;
  name: string;
  leaderId: string;
  leaderName: string;
  memberIds: string[];
  memberNames: string[];
}

export interface PointAssignment {
  pointId: string;
  assigneeId: string;
  assigneeName: string;
  assignTime: string;
  startTime?: string;
  endTime?: string;
  assistMemberIds?: string[];
  assistMemberNames?: string[];
}

export interface PointOperationLog {
  id: string;
  pointId: string;
  routeId: string;
  operation: PointOperationType;
  operatorId: string;
  operatorName: string;
  targetUserId?: string;
  targetUserName?: string;
  remark?: string;
  time: string;
}

export interface FaultTimelineItem {
  id: string;
  action: TimelineAction;
  operatorId: string;
  operatorName: string;
  time: string;
  remark?: string;
  progress?: number;
}

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
  assignment?: PointAssignment;
}

export interface RouteMemberResult {
  userId: string;
  userName: string;
  checkedDevices: number;
  abnormalDevices: number;
  durationMinutes: number;
  pointIds: string[];
}

export interface InspectionRoute {
  id: string;
  name: string;
  date: string;
  shift: ShiftType;
  teamId?: string;
  teamName?: string;
  inspectorId: string;
  inspectorName: string;
  memberAssignments?: PointAssignment[];
  points: InspectionPoint[];
  totalPoints: number;
  checkedPoints: number;
  status: 'pending' | 'in_progress' | 'completed';
  startTime?: string;
  endTime?: string;
  memberResults?: RouteMemberResult[];
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
  shift: ShiftType;
  inspectorId: string;
  inspectorName: string;
  isOffline: boolean;
  syncStatus: SyncStatus;
  syncError?: string;
  syncedAt?: string;
  faultReportId?: string;
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
  shift: ShiftType;
  assigneeId?: string;
  assigneeName?: string;
  assignTime?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  rectifyStatus: RectifyStatus;
  rectifyProgress: number;
  rectifyRemark?: string;
  rectifyTime?: string;
  recheckRequired: boolean;
  recheckTime?: string;
  recheckResult?: 'pass' | 'fail';
  recheckRemark?: string;
  closedAt?: string;
  timeline: FaultTimelineItem[];
}

export interface DailyStats {
  date: string;
  shift: ShiftType;
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
  teamId?: string;
}

export interface ShiftSummary {
  id: string;
  date: string;
  shift: ShiftType;
  inspectorId: string;
  inspectorName: string;
  stats: DailyStats;
  pendingFaults: FaultReport[];
  remarks: string;
  generatedAt: string;
}

import type {
  InspectionRoute,
  InspectionPoint,
  AssetDevice,
  ScanRecord,
  FaultReport,
  UserProfile,
  Team,
  PointAssignment,
  FaultTimelineItem,
  ShiftType,
  SyncStatus
} from '@/types/inspection';
import { getTodayStr, createTimelineItem } from '@/utils';

export const mockUser: UserProfile = {
  id: 'U001',
  name: '张工',
  department: '物业运维部',
  role: 'inspector',
  phone: '13800138000',
  teamId: 'T001'
};

export const mockTeam: Team = {
  id: 'T001',
  name: '巡检一组',
  leaderId: 'U001',
  leaderName: '张工',
  memberIds: ['U001', 'U005', 'U006'],
  memberNames: ['张工', '刘工', '陈工']
};

export const mockTeamMembers: UserProfile[] = [
  { id: 'U001', name: '张工', department: '物业运维部', role: 'inspector', phone: '13800138000', teamId: 'T001' },
  { id: 'U005', name: '刘工', department: '物业运维部', role: 'inspector', phone: '13800138005', teamId: 'T001' },
  { id: 'U006', name: '陈工', department: '物业运维部', role: 'inspector', phone: '13800138006', teamId: 'T001' }
];

const createDevices = (pointId: string, prefix: string, count: number, withCheckTime = false): AssetDevice[] => {
  const categories = ['服务器', '交换机', '空调', 'UPS', '监控摄像头', '投影仪', '门禁系统'];
  const models = ['Pro-2000', 'X-100', 'Smart-V3', 'Standard-500', 'Enterprise-9000'];
  return Array.from({ length: count }, (_, i) => ({
    id: `DEV-${prefix}-${i + 1}`,
    assetCode: `AST-${prefix}-${String(i + 1).padStart(4, '0')}`,
    name: `${categories[i % categories.length]}${i + 1}号`,
    category: categories[i % categories.length],
    model: models[i % models.length],
    location: `A栋${pointId}区`,
    pointId,
    status: 'normal' as const,
    lastCheckTime: withCheckTime ? '2026-06-11T14:30:00.000Z' : undefined
  }));
};

const createAssignment = (pointId: string, assigneeId: string, assigneeName: string, startTime: string): PointAssignment => ({
  pointId,
  assigneeId,
  assigneeName,
  assignTime: '2026-06-12T08:00:00.000Z',
  startTime
});

const shift = '早班' as ShiftType;

export const mockRoutes: InspectionRoute[] = [
  {
    id: 'ROUTE-001',
    name: 'A栋日巡检路线',
    date: getTodayStr(),
    shift,
    teamId: 'T001',
    teamName: '巡检一组',
    inspectorId: 'U001',
    inspectorName: '张工',
    totalPoints: 4,
    checkedPoints: 1,
    status: 'in_progress',
    startTime: '2026-06-12T08:30:00.000Z',
    memberAssignments: [
      createAssignment('P001', 'U001', '张工', '2026-06-12T08:30:00.000Z'),
      createAssignment('P002', 'U005', '刘工', '2026-06-12T08:45:00.000Z'),
      createAssignment('P003', 'U006', '陈工', '2026-06-12T09:00:00.000Z'),
      createAssignment('P004', 'U001', '张工', '2026-06-12T09:15:00.000Z')
    ],
    points: [
      {
        id: 'P001',
        name: 'A栋主机房',
        type: '机房',
        building: 'A栋',
        floor: '1层',
        totalDevices: 8,
        checkedDevices: 3,
        order: 1,
        assignment: createAssignment('P001', 'U001', '张工', '2026-06-12T08:30:00.000Z'),
        devices: (() => {
          const devs = createDevices('P001', 'A1', 8);
          devs[0].lastCheckTime = '2026-06-12T08:45:00.000Z';
          devs[0].status = 'normal';
          devs[2].lastCheckTime = '2026-06-12T08:52:00.000Z';
          devs[2].status = 'abnormal';
          devs[4].lastCheckTime = '2026-06-12T08:58:00.000Z';
          devs[4].status = 'normal';
          return devs;
        })()
      },
      {
        id: 'P002',
        name: 'A栋会议室集群',
        type: '会议室',
        building: 'A栋',
        floor: '3层',
        totalDevices: 6,
        checkedDevices: 2,
        order: 2,
        assignment: createAssignment('P002', 'U005', '刘工', '2026-06-12T08:45:00.000Z'),
        devices: (() => {
          const devs = createDevices('P002', 'A3', 6);
          devs[1].lastCheckTime = '2026-06-12T09:20:00.000Z';
          devs[1].status = 'normal';
          devs[3].lastCheckTime = '2026-06-12T09:35:00.000Z';
          devs[3].status = 'missing';
          return devs;
        })()
      },
      {
        id: 'P003',
        name: 'A栋地下仓库',
        type: '仓库',
        building: 'A栋',
        floor: 'B1层',
        totalDevices: 5,
        checkedDevices: 0,
        order: 3,
        assignment: createAssignment('P003', 'U006', '陈工', '2026-06-12T09:00:00.000Z'),
        devices: createDevices('P003', 'AB1', 5)
      },
      {
        id: 'P004',
        name: 'A栋办公区网络柜',
        type: '办公区',
        building: 'A栋',
        floor: '5层',
        totalDevices: 4,
        checkedDevices: 0,
        order: 4,
        assignment: createAssignment('P004', 'U001', '张工', '2026-06-12T09:15:00.000Z'),
        devices: createDevices('P004', 'A5', 4)
      }
    ]
  },
  {
    id: 'ROUTE-002',
    name: 'B栋周巡检路线',
    date: getTodayStr(),
    shift,
    teamId: 'T001',
    teamName: '巡检一组',
    inspectorId: 'U001',
    inspectorName: '张工',
    totalPoints: 3,
    checkedPoints: 0,
    status: 'pending',
    points: [
      {
        id: 'P005',
        name: 'B栋数据机房',
        type: '机房',
        building: 'B栋',
        floor: '2层',
        totalDevices: 10,
        checkedDevices: 0,
        order: 1,
        devices: createDevices('P005', 'B2', 10)
      },
      {
        id: 'P006',
        name: 'B栋备品仓库',
        type: '仓库',
        building: 'B栋',
        floor: 'B2层',
        totalDevices: 6,
        checkedDevices: 0,
        order: 2,
        devices: createDevices('P006', 'BB2', 6)
      },
      {
        id: 'P007',
        name: 'B栋多功能厅',
        type: '会议室',
        building: 'B栋',
        floor: '1层',
        totalDevices: 5,
        checkedDevices: 0,
        order: 3,
        devices: createDevices('P007', 'B1', 5)
      }
    ]
  }
];

const synced: SyncStatus = 'synced';
const pending: SyncStatus = 'pending';

export const mockScanRecords: ScanRecord[] = [
  {
    id: 'SCAN-001',
    deviceId: 'DEV-A1-1',
    assetCode: 'AST-A1-0001',
    deviceName: '服务器1号',
    pointId: 'P001',
    pointName: 'A栋主机房',
    status: 'normal',
    scanTime: '2026-06-12T08:45:00.000Z',
    shift: '早班',
    inspectorId: 'U001',
    inspectorName: '张工',
    isOffline: false,
    syncStatus: synced,
    syncedAt: '2026-06-12T08:45:00.000Z',
    photos: []
  },
  {
    id: 'SCAN-002',
    deviceId: 'DEV-A1-3',
    assetCode: 'AST-A1-0003',
    deviceName: '空调1号',
    pointId: 'P001',
    pointName: 'A栋主机房',
    status: 'abnormal',
    remark: '运行声音异常，温度偏高',
    scanTime: '2026-06-12T08:52:00.000Z',
    shift: '早班',
    inspectorId: 'U001',
    inspectorName: '张工',
    isOffline: false,
    syncStatus: synced,
    syncedAt: '2026-06-12T08:52:00.000Z',
    faultReportId: 'FAULT-001',
    photos: ['https://picsum.photos/id/1/300/300']
  },
  {
    id: 'SCAN-003',
    deviceId: 'DEV-A3-2',
    assetCode: 'AST-A3-0002',
    deviceName: '投影仪2号',
    pointId: 'P002',
    pointName: 'A栋会议室集群',
    status: 'normal',
    scanTime: '2026-06-12T09:20:00.000Z',
    shift: '早班',
    inspectorId: 'U005',
    inspectorName: '刘工',
    isOffline: false,
    syncStatus: synced,
    syncedAt: '2026-06-12T09:20:00.000Z',
    photos: []
  },
  {
    id: 'SCAN-004',
    deviceId: 'DEV-A3-4',
    assetCode: 'AST-A3-0004',
    deviceName: '门禁系统1号',
    pointId: 'P002',
    pointName: 'A栋会议室集群',
    status: 'missing',
    remark: '设备未找到',
    scanTime: '2026-06-12T09:35:00.000Z',
    shift: '早班',
    inspectorId: 'U005',
    inspectorName: '刘工',
    isOffline: true,
    syncStatus: pending,
    photos: []
  },
  {
    id: 'SCAN-005',
    deviceId: 'DEV-A1-5',
    assetCode: 'AST-A1-0005',
    deviceName: '监控摄像头1号',
    pointId: 'P001',
    pointName: 'A栋主机房',
    status: 'normal',
    scanTime: '2026-06-12T08:58:00.000Z',
    shift: '早班',
    inspectorId: 'U001',
    inspectorName: '张工',
    isOffline: false,
    syncStatus: synced,
    syncedAt: '2026-06-12T08:58:00.000Z',
    photos: []
  }
];

const mockTimeline1: FaultTimelineItem[] = [
  createTimelineItem('create', 'U001', '张工', '空调运行异响，出风口温度偏高，机房温度有上升趋势'),
  createTimelineItem('assign', 'U001', '张工', '指派给李师傅'),
  createTimelineItem('accept', 'U002', '李师傅', '已接单，开始处理'),
  createTimelineItem('progress', 'U002', '李师傅', '已联系厂家，配件预计下午到货', 60)
];

const mockTimeline2: FaultTimelineItem[] = [
  createTimelineItem('create', 'U001', '张工', '会议室301门禁设备缺失，原安装位置空'),
  createTimelineItem('assign', 'U001', '张工', '指派给王主管')
];

const mockTimeline3: FaultTimelineItem[] = [
  createTimelineItem('create', 'U001', '张工', '监控画面模糊，需清洁镜头或更换'),
  createTimelineItem('assign', 'U001', '张工', '指派给李师傅'),
  createTimelineItem('accept', 'U002', '李师傅', '已接单'),
  createTimelineItem('progress', 'U002', '李师傅', '准备工具出发', 50),
  createTimelineItem('complete', 'U002', '李师傅', '已清洁镜头，画面恢复清晰'),
  createTimelineItem('recheck_request', 'U002', '李师傅', '申请复检'),
  createTimelineItem('recheck_pass', 'U001', '张工', '复检通过，画面清晰'),
  createTimelineItem('close', 'U001', '张工', '工单已关闭')
];

const mockTimeline4: FaultTimelineItem[] = [
  createTimelineItem('create', 'U001', '张工', '交换机端口3指示灯异常闪烁'),
  createTimelineItem('assign', 'U001', '张工', '指派给李师傅'),
  createTimelineItem('accept', 'U002', '李师傅', '已接单'),
  createTimelineItem('progress', 'U002', '李师傅', '检查中', 50),
  createTimelineItem('complete', 'U002', '李师傅', '已更换网线，端口恢复正常'),
  createTimelineItem('recheck_request', 'U002', '李师傅', '申请复检')
];

export const mockFaultReports: FaultReport[] = [
  {
    id: 'FAULT-001',
    deviceId: 'DEV-A1-3',
    assetCode: 'AST-A1-0003',
    deviceName: '空调1号',
    pointId: 'P001',
    pointName: 'A栋主机房',
    description: '空调运行异响，出风口温度偏高，机房温度有上升趋势',
    urgency: 'high',
    photos: ['https://picsum.photos/id/8/400/300'],
    reporterId: 'U001',
    reporterName: '张工',
    reportTime: '2026-06-12T08:55:00.000Z',
    shift: '早班',
    assigneeId: 'U002',
    assigneeName: '李师傅',
    assignTime: '2026-06-12T09:00:00.000Z',
    acceptedAt: '2026-06-12T09:05:00.000Z',
    rectifyStatus: 'processing',
    rectifyProgress: 60,
    rectifyRemark: '已联系厂家，配件预计下午到货',
    recheckRequired: true,
    timeline: mockTimeline1
  },
  {
    id: 'FAULT-002',
    deviceId: 'DEV-A3-4',
    assetCode: 'AST-A3-0004',
    deviceName: '门禁系统1号',
    pointId: 'P002',
    pointName: 'A栋会议室集群',
    description: '会议室301门禁设备缺失，原安装位置空',
    urgency: 'medium',
    photos: ['https://picsum.photos/id/3/400/300'],
    reporterId: 'U001',
    reporterName: '张工',
    reportTime: '2026-06-12T09:40:00.000Z',
    shift: '早班',
    assigneeId: 'U003',
    assigneeName: '王主管',
    assignTime: '2026-06-12T09:45:00.000Z',
    rectifyStatus: 'assigned',
    rectifyProgress: 0,
    recheckRequired: true,
    timeline: mockTimeline2
  },
  {
    id: 'FAULT-003',
    deviceId: 'DEV-A1-5',
    assetCode: 'AST-A1-0005',
    deviceName: '监控摄像头1号',
    pointId: 'P001',
    pointName: 'A栋主机房',
    description: '监控画面模糊，需清洁镜头或更换',
    urgency: 'low',
    photos: [],
    reporterId: 'U001',
    reporterName: '张工',
    reportTime: '2026-06-11T16:20:00.000Z',
    shift: '中班',
    assigneeId: 'U002',
    assigneeName: '李师傅',
    assignTime: '2026-06-11T16:25:00.000Z',
    acceptedAt: '2026-06-11T16:30:00.000Z',
    rectifyStatus: 'closed',
    rectifyProgress: 100,
    rectifyRemark: '已清洁镜头，画面恢复清晰',
    rectifyTime: '2026-06-11T18:00:00.000Z',
    recheckRequired: true,
    recheckTime: '2026-06-12T08:30:00.000Z',
    recheckResult: 'pass',
    closedAt: '2026-06-12T08:30:00.000Z',
    timeline: mockTimeline3
  },
  {
    id: 'FAULT-004',
    deviceId: 'DEV-A1-2',
    assetCode: 'AST-A1-0002',
    deviceName: '交换机1号',
    pointId: 'P001',
    pointName: 'A栋主机房',
    description: '交换机端口3指示灯异常闪烁',
    urgency: 'medium',
    photos: ['https://picsum.photos/id/6/400/300'],
    reporterId: 'U001',
    reporterName: '张工',
    reportTime: '2026-06-12T09:05:00.000Z',
    shift: '早班',
    assigneeId: 'U002',
    assigneeName: '李师傅',
    assignTime: '2026-06-12T09:10:00.000Z',
    acceptedAt: '2026-06-12T09:15:00.000Z',
    rectifyStatus: 'recheck',
    rectifyProgress: 100,
    rectifyRemark: '已更换网线，端口恢复正常',
    rectifyTime: '2026-06-12T10:30:00.000Z',
    recheckRequired: true,
    timeline: mockTimeline4
  },
  {
    id: 'FAULT-005',
    deviceId: 'DEV-A1-6',
    assetCode: 'AST-A1-0006',
    deviceName: 'UPS1号',
    pointId: 'P001',
    pointName: 'A栋主机房',
    description: 'UPS电池组电压偏低，需要检查',
    urgency: 'medium',
    photos: [],
    reporterId: 'U005',
    reporterName: '刘工',
    reportTime: '2026-06-11T14:30:00.000Z',
    shift: '早班',
    assigneeId: 'U003',
    assigneeName: '王主管',
    assignTime: '2026-06-11T14:35:00.000Z',
    acceptedAt: '2026-06-11T14:40:00.000Z',
    rectifyStatus: 'processing',
    rectifyProgress: 50,
    rectifyRemark: '已联系电池供应商',
    recheckRequired: false,
    timeline: [
      createTimelineItem('create', 'U005', '刘工', 'UPS电池组电压偏低'),
      createTimelineItem('assign', 'U001', '张工', '指派给王主管'),
      createTimelineItem('accept', 'U003', '王主管', '已接单'),
      createTimelineItem('progress', 'U003', '王主管', '已联系电池供应商', 50)
    ]
  }
];

export const mockMaintainers: UserProfile[] = [
  { id: 'U002', name: '李师傅', department: '维修组', role: 'maintainer', phone: '13900139000' },
  { id: 'U003', name: '王主管', department: '运维部', role: 'maintainer', phone: '13700137000' },
  { id: 'U004', name: '赵工', department: '弱电组', role: 'maintainer', phone: '13600136000' }
];

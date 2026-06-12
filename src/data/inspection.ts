import type {
  InspectionRoute,
  InspectionPoint,
  AssetDevice,
  ScanRecord,
  FaultReport,
  DailyStats,
  UserProfile,
  ShiftSummary
} from '@/types/inspection';
import { getTodayStr } from '@/utils';

export const mockUser: UserProfile = {
  id: 'U001',
  name: '张工',
  department: '物业运维部',
  role: 'inspector',
  phone: '13800138000'
};

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
    lastCheckTime: withCheckTime ? '2026-06-11 14:30' : undefined
  }));
};

export const mockRoutes: InspectionRoute[] = [
  {
    id: 'ROUTE-001',
    name: 'A栋日巡检路线',
    date: getTodayStr(),
    inspectorId: 'U001',
    inspectorName: '张工',
    totalPoints: 4,
    checkedPoints: 1,
    status: 'in_progress',
    startTime: '2026-06-12 08:30',
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
        devices: (() => {
          const devs = createDevices('P001', 'A1', 8);
          devs[0].lastCheckTime = '2026-06-12 08:45';
          devs[0].status = 'normal';
          devs[2].lastCheckTime = '2026-06-12 08:52';
          devs[2].status = 'abnormal';
          devs[4].lastCheckTime = '2026-06-12 08:58';
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
        devices: (() => {
          const devs = createDevices('P002', 'A3', 6);
          devs[1].lastCheckTime = '2026-06-12 09:20';
          devs[1].status = 'normal';
          devs[3].lastCheckTime = '2026-06-12 09:35';
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
        devices: createDevices('P004', 'A5', 4)
      }
    ]
  },
  {
    id: 'ROUTE-002',
    name: 'B栋周巡检路线',
    date: getTodayStr(),
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

export const mockScanRecords: ScanRecord[] = [
  {
    id: 'SCAN-001',
    deviceId: 'DEV-A1-1',
    assetCode: 'AST-A1-0001',
    deviceName: '服务器1号',
    pointId: 'P001',
    pointName: 'A栋主机房',
    status: 'normal',
    scanTime: '2026-06-12 08:45',
    inspectorId: 'U001',
    inspectorName: '张工',
    isOffline: false,
    synced: true,
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
    scanTime: '2026-06-12 08:52',
    inspectorId: 'U001',
    inspectorName: '张工',
    isOffline: false,
    synced: true,
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
    scanTime: '2026-06-12 09:20',
    inspectorId: 'U001',
    inspectorName: '张工',
    isOffline: false,
    synced: true,
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
    scanTime: '2026-06-12 09:35',
    inspectorId: 'U001',
    inspectorName: '张工',
    isOffline: true,
    synced: false,
    photos: []
  }
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
    reportTime: '2026-06-12 08:55',
    assigneeId: 'U002',
    assigneeName: '李师傅',
    rectifyStatus: 'processing',
    rectifyProgress: 60,
    rectifyRemark: '已联系厂家，配件预计下午到货',
    recheckRequired: true
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
    reportTime: '2026-06-12 09:40',
    assigneeId: 'U003',
    assigneeName: '王主管',
    rectifyStatus: 'pending',
    rectifyProgress: 0,
    recheckRequired: true
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
    reportTime: '2026-06-11 16:20',
    assigneeId: 'U002',
    assigneeName: '李师傅',
    rectifyStatus: 'completed',
    rectifyProgress: 100,
    rectifyRemark: '已清洁镜头，画面恢复清晰',
    rectifyTime: '2026-06-11 18:00',
    recheckRequired: true,
    recheckTime: '2026-06-12 08:30',
    recheckResult: 'pass'
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
    reportTime: '2026-06-12 09:05',
    assigneeId: 'U002',
    assigneeName: '李师傅',
    rectifyStatus: 'recheck',
    rectifyProgress: 100,
    rectifyRemark: '已更换网线，端口恢复正常',
    rectifyTime: '2026-06-12 10:30',
    recheckRequired: true
  }
];

export const mockDailyStats: DailyStats[] = [
  {
    date: getTodayStr(),
    totalPoints: 7,
    checkedPoints: 2,
    totalDevices: 44,
    checkedDevices: 12,
    normalCount: 9,
    abnormalCount: 2,
    missingCount: 1,
    disabledCount: 0,
    faultCount: 4,
    completedFaultCount: 1,
    timeoutCount: 0,
    completionRate: 27
  },
  {
    date: '2026-06-11',
    totalPoints: 5,
    checkedPoints: 5,
    totalDevices: 32,
    checkedDevices: 32,
    normalCount: 28,
    abnormalCount: 3,
    missingCount: 0,
    disabledCount: 1,
    faultCount: 3,
    completedFaultCount: 3,
    timeoutCount: 0,
    completionRate: 100
  },
  {
    date: '2026-06-10',
    totalPoints: 6,
    checkedPoints: 5,
    totalDevices: 38,
    checkedDevices: 34,
    normalCount: 30,
    abnormalCount: 2,
    missingCount: 1,
    disabledCount: 1,
    faultCount: 3,
    completedFaultCount: 2,
    timeoutCount: 1,
    completionRate: 89
  },
  {
    date: '2026-06-09',
    totalPoints: 5,
    checkedPoints: 5,
    totalDevices: 30,
    checkedDevices: 30,
    normalCount: 27,
    abnormalCount: 2,
    missingCount: 0,
    disabledCount: 1,
    faultCount: 2,
    completedFaultCount: 2,
    timeoutCount: 0,
    completionRate: 100
  },
  {
    date: '2026-06-08',
    totalPoints: 6,
    checkedPoints: 6,
    totalDevices: 36,
    checkedDevices: 36,
    normalCount: 33,
    abnormalCount: 2,
    missingCount: 0,
    disabledCount: 1,
    faultCount: 2,
    completedFaultCount: 2,
    timeoutCount: 0,
    completionRate: 100
  }
];

export const mockMaintainers: UserProfile[] = [
  { id: 'U002', name: '李师傅', department: '维修组', role: 'maintainer', phone: '13900139000' },
  { id: 'U003', name: '王主管', department: '运维部', role: 'maintainer', phone: '13700137000' },
  { id: 'U004', name: '赵工', department: '弱电组', role: 'maintainer', phone: '13600136000' }
];

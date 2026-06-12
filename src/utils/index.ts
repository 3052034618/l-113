import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import type { InspectionStatus, UrgencyLevel, RectifyStatus } from '@/types/inspection';

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

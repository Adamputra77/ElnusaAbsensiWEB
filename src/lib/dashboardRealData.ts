import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { PresenceType, PresenceLog, Employee } from '../types';
import { syncEmployees } from './employeeCache';
import { calculateActiveRealtimeHours } from './manHours';

export interface DailyAggregate {
  date: string; // yyyy-MM-dd
  formattedDate: string; // e.g. "20 July 2026"
  uniqueIn: number; // unique employees who scanned IN that day
  uniqueOut: number; // unique employees who are OUT at end of day (last log OUT)
  visitorIn: number;
  visitorOut: number;
  byDepartment: Record<string, number>; // department -> unique IN count
  byShift: Record<string, number>; // shift -> unique IN count
}

export interface DashboardDataResult {
  dailyData: DailyAggregate[];
  todayStats: {
    pob: number;
    masuk: number;
    keluar: number;
    visitorIn: number;
    visitorOut: number;
    totalVisits: number;
    resetAt: number;
  };
  warehouseStats: {
    completedManHours: number;
    activeManHours: number;
    totalManHours: number;
  };
  selectedDateRange: { start: string; end: string };
}

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const getYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getFormattedDate = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const monthStr = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${monthStr} ${year}`;
};

// Shift config - adjust these numbers if actual shift times differ
export const SHIFT_CONFIG = {
  // Non-Security employees (office hours)
  OFFICE: { start: 6, end: 10 }, // scan IN between 06:00-09:59 -> Office
  // Security shifts (adjust if actual times differ)
  SECURITY_PAGI: { start: 7, end: 16 }, // 07:00-15:59 -> Security Pagi
  SECURITY_MALAM: { start: 16, end: 7 }, // 16:00-06:59 -> Security Malam (spans midnight)
};

function getShiftFromScanTime(log: PresenceLog, employee: Employee): string {
  const hours = (log.timestamp as Timestamp)?.toDate?.().getHours?.() ?? new Date(log.timestamp).getHours();
  const isSecurity = employee.department.toLowerCase().includes('security');
  
  if (!isSecurity) return 'Office';
  
  // Security shifts: Pagi 07:00-15:59, Malam 16:00-06:59
  if (hours >= 7 && hours <= 15) return 'Security Pagi';
  return 'Security Malam';
}

function getLogTimestampSeconds(log: PresenceLog): number {
  const ts = log.timestamp;
  if (!ts) return 0;
  if (typeof (ts as any).toDate === 'function') return Math.floor((ts as any).toDate().getTime() / 1000);
  return Math.floor(new Date(ts).getTime() / 1000);
}

export async function fetchDashboardData(
  startDateStr: string,
  endDateStr: string
): Promise<DashboardDataResult> {
  // 1. Fetch all employees (cached, 0 reads)
  const allEmployees = await syncEmployees();
  
  // 2. Fetch presence logs for the date range
  const logsRef = collection(db, 'presence_logs');
  const q = query(
    logsRef,
    where('date', '>=', startDateStr),
    where('date', '<=', endDateStr)
  );
  const logsSnap = await getDocs(q);
  
  const logs: PresenceLog[] = logsSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as PresenceLog))
    .sort((a, b) => getLogTimestampSeconds(b) - getLogTimestampSeconds(a));
  
  // 3. Fetch today's stats for live counters
  const todayStr = getYYYYMMDD(new Date());
  const todayStatsDoc = await getDoc(doc(db, 'stats', todayStr));
  const todayStatsData = todayStatsDoc.data() || {};
  const todayStats = {
    pob: todayStatsData.pob ?? 0,
    masuk: todayStatsData.in ?? 0,
    keluar: todayStatsData.out ?? 0,
    visitorIn: todayStatsData.visitorIn ?? 0,
    visitorOut: todayStatsData.visitorOut ?? 0,
    totalVisits: todayStatsData.totalVisits ?? 0,
    resetAt: (todayStatsData.resetAt as any)?.seconds ?? 0,
  };
  
  // 4. Fetch warehouse cumulative man hours
  const warehouseDoc = await getDoc(doc(db, 'stats', 'warehouse'));
  const warehouseData = warehouseDoc.data() || {};
  const completedManHours = warehouseData.completedManHours ?? 0;
  
  // 5. Compute active man hours from logs (yesterday + today)
  const activeManHours = calculateActiveRealtimeHours(logs, new Date());
  const totalManHours = completedManHours + activeManHours;
  
  // 6. Determine resetAt for today
  const resetAtSeconds = todayStats.resetAt;
  
  // 6. Aggregate per date
  const dailyMap = new Map<string, DailyAggregate>();
  
  // Initialize all dates in range
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const current = new Date(startDate);
  while (current <= endDate) {
    const dStr = getYYYYMMDD(current);
    dailyMap.set(dStr, {
      date: dStr,
      formattedDate: getFormattedDate(current),
      uniqueIn: 0,
      uniqueOut: 0,
      visitorIn: 0,
      visitorOut: 0,
      byDepartment: {},
      byShift: {},
    });
    current.setDate(current.getDate() + 1);
  }
  
  // Process logs grouped by date
  const logsByDate = new Map<string, PresenceLog[]>();
  for (const log of logs) {
    if (!logsByDate.has(log.date)) logsByDate.set(log.date, []);
    logsByDate.get(log.date)!.push(log);
  }
  
  // For each date, compute aggregates respecting resetAt for today
  for (const [dateStr, dayLogs] of logsByDate.entries()) {
    const dayAgg = dailyMap.get(dateStr);
    if (!dayAgg) continue;
    
    // For today, filter out logs before resetAt
    const resetAt = (dateStr === todayStr) ? resetAtSeconds : 0;
    const validLogs = resetAt > 0
      ? dayLogs.filter(l => getLogTimestampSeconds(l) >= resetAt)
      : dayLogs;
    
    // Track latest log per employee for this date (for current status: dept/shift breakdown)
    const latestPerEmployee = new Map<string, PresenceLog>();
    for (const log of validLogs) {
      const existing = latestPerEmployee.get(log.employeeId);
      if (!existing || getLogTimestampSeconds(log) > getLogTimestampSeconds(existing)) {
        latestPerEmployee.set(log.employeeId, log);
      }
    }
    
    // Count unique IN from ALL valid logs (anyone who EVER scanned IN that day)
    // This ensures "Masuk" never decreases - only increases when NEW people scan IN
    const inEmployees = new Set<string>();
    const outEmployees = new Set<string>();
    const deptInCount = new Map<string, number>();
    const shiftInCount = new Map<string, number>();
    let vIn = 0, vOut = 0;
    
    // First pass: count ALL IN scans across the day (unique employees who ever scanned IN)
    for (const log of validLogs) {
      const emp = allEmployees[log.employeeId];
      const isVisitor = emp?.isVisitor === true;
      const shift = getShiftFromScanTime(log, emp);
      const dept = emp?.department || 'Unknown';
      
      if (log.type === PresenceType.IN) {
        // Add to unique IN set (automatically deduplicates same person)
        if (!inEmployees.has(log.employeeId)) {
          inEmployees.add(log.employeeId);
          deptInCount.set(log.employeeId, (deptInCount.get(log.employeeId) || 0) + 1);
          shiftInCount.set(shift, (shiftInCount.get(shift) || 0) + 1);
          if (isVisitor) vIn++;
        }
      } else {
        // OUT scan - track for uniqueOut
        outEmployees.add(log.employeeId);
        if (isVisitor) vOut++;
      }
    }
    
    // For department/shift breakdown, use LATEST log to show current status
    // But don't recount unique IN - we already have the correct uniqueIn count
    for (const [empId, log] of latestPerEmployee.entries()) {
      if (log.type === PresenceType.OUT) {
        outEmployees.add(empId);
        const emp = allEmployees[empId];
        if (emp?.isVisitor === true) vOut++;
      }
    }
    
    dayAgg.uniqueIn = inEmployees.size;
    dayAgg.uniqueOut = outEmployees.size;
    dayAgg.visitorIn = vIn;
    dayAgg.visitorOut = vOut;
    dayAgg.byDepartment = Object.fromEntries(deptInCount);
    dayAgg.byShift = Object.fromEntries(shiftInCount);
  }
  
  const dailyData = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    dailyData,
    todayStats,
    warehouseStats: {
      completedManHours,
      activeManHours,
      totalManHours,
    },
    selectedDateRange: { start: startDateStr, end: endDateStr },
  };
}
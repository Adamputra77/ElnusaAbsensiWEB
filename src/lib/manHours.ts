import { PresenceLog, PresenceType } from '../types';

/**
 * Calculates live ticking active man hours for anyone currently checked in.
 * Includes both registered employees and visitors (no filtering isVisitor).
 * 
 * Safe against double-scans and missing checkouts (> 24h).
 */
export function calculateActiveRealtimeHours(
  logs: PresenceLog[],
  now: Date
): number {
  if (!logs || logs.length === 0) return 0;

  // Group logs by employeeId to find their absolute latest log in logs array (yesterday + today)
  const latestLogPerUser: Record<string, PresenceLog> = {};
  
  logs.forEach(log => {
    if (!log.employeeId) return;
    const existing = latestLogPerUser[log.employeeId];
    if (!existing) {
      latestLogPerUser[log.employeeId] = log;
      return;
    }
    
    const tCurrent = log.timestamp 
      ? (typeof log.timestamp.toDate === 'function' ? log.timestamp.toDate().getTime() : new Date(log.timestamp).getTime()) 
      : 0;
    const tExisting = existing.timestamp 
      ? (typeof existing.timestamp.toDate === 'function' ? existing.timestamp.toDate().getTime() : new Date(existing.timestamp).getTime()) 
      : 0;
      
    if (tCurrent > tExisting) {
      latestLogPerUser[log.employeeId] = log;
    }
  });

  let activeMs = 0;
  
  Object.values(latestLogPerUser).forEach(log => {
    if (log.type === PresenceType.IN) {
      const checkInTime = log.timestamp
        ? (typeof log.timestamp.toDate === 'function' ? log.timestamp.toDate().getTime() : new Date(log.timestamp).getTime())
        : now.getTime();
        
      const diffMs = now.getTime() - checkInTime;
      
      // Handle edge cases:
      // 1. If checkInTime is in the future relative to now (due to slight device clock differences), skip.
      // 2. Missing checkout guard: If they checked in more than 24 hours ago, we treat it as lapsed (0 active hours).
      if (diffMs > 0 && diffMs < 24 * 3600 * 1000) {
        activeMs += diffMs;
      }
    }
  });

  return activeMs / (1000 * 60 * 60);
}

/**
 * Backwards compatibility helper for daily calculation if needed elsewhere.
 */
export function calculateTodayManHours(
  logs: PresenceLog[],
  employees: Record<string, any>,
  todayDateStr: string,
  now: Date
): { totalHours: number } {
  const activeHours = calculateActiveRealtimeHours(logs, now);
  return { totalHours: activeHours };
}

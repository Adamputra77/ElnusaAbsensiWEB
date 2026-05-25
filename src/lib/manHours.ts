import { PresenceLog, Employee, PresenceType } from '../types';
import { startOfDay, subDays, format } from 'date-fns';

interface ManHoursResult {
  totalHours: number;
  userHours: Record<string, { name: string; hours: number; isInside: boolean }>;
}

/**
 * Calculates real-time total and per-employee Man Hours worked "today"
 * taking into account cross-day shifts, missing check-outs, and double scans.
 * 
 * Formula: Man Hours = Σ (checkoutTime - checkinTime)
 * If still checked in: checkoutTime = now (realtime)
 * 
 * @param logs List of presence logs for yesterday and today (to support night shifts)
 * @param employees Map of employee profiles, keyed by ID
 * @param todayDateStr The current date string in 'yyyy-MM-dd' format
 * @param now The current ticking Date object
 */
export function calculateTodayManHours(
  logs: PresenceLog[],
  employees: Record<string, Employee>,
  todayDateStr: string,
  now: Date
): ManHoursResult {
  const startOfToday = startOfDay(now);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Group logs by employee. Only include non-visitor employees
  const logsByUser: Record<string, PresenceLog[]> = {};
  
  logs.forEach(log => {
    if (!log.employeeId) return;
    
    const emp = employees[log.employeeId];
    // Keep only registered employees who are NOT visitors
    if (emp?.isVisitor === true) return;
    
    if (!logsByUser[log.employeeId]) {
      logsByUser[log.employeeId] = [];
    }
    logsByUser[log.employeeId].push(log);
  });

  let totalMs = 0;
  const userHours: Record<string, { name: string; hours: number; isInside: boolean }> = {};

  Object.entries(logsByUser).forEach(([empId, userLogs]) => {
    const emp = employees[empId];
    const empName = emp ? emp.name : `Employee ${empId}`;

    // Sort logs chronologically
    const sortedLogs = [...userLogs].sort((a, b) => {
      const t1 = a.timestamp 
        ? (typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) 
        : Date.now();
      const t2 = b.timestamp 
        ? (typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) 
        : Date.now();
      return t1 - t2;
    });

    let activeInTime: Date | null = null;
    let employeeWorkedTodayMs = 0;

    sortedLogs.forEach(log => {
      const logTime = log.timestamp
        ? (typeof log.timestamp.toDate === 'function' ? log.timestamp.toDate() : new Date(log.timestamp))
        : new Date();

      if (log.type === PresenceType.IN) {
        // Set check-in if none is active
        if (activeInTime === null) {
          activeInTime = logTime;
        }
      } else if (log.type === PresenceType.OUT) {
        if (activeInTime !== null) {
          // We have a pair: activeInTime -> logTime
          const checkIn = activeInTime;
          const checkOut = logTime;

          // Determine the overlap with "today"
          const overlapStart = checkIn.getTime() < startOfToday.getTime() ? startOfToday : checkIn;
          const overlapEnd = checkOut;

          const durationMs = overlapEnd.getTime() - overlapStart.getTime();
          if (durationMs > 0) {
            employeeWorkedTodayMs += durationMs;
          }

          // Reset check-in state
          activeInTime = null;
        }
      }
    });

    // Handle edge case: still checked in (no matching checkout yet on these logs)
    let isInside = false;
    
    // Check if the overall final state of candidate on today is inside.
    // In our system, the final state of activeInTime determines if they are inside.
    if (activeInTime !== null) {
      isInside = true;
      const checkIn = activeInTime;
      const checkOut = now; // Real-time calculation up to now

      const overlapStart = checkIn.getTime() < startOfToday.getTime() ? startOfToday : checkIn;
      const overlapEnd = checkOut;

      const durationMs = overlapEnd.getTime() - overlapStart.getTime();
      if (durationMs > 0) {
        employeeWorkedTodayMs += durationMs;
      }
    }

    const workedHours = employeeWorkedTodayMs / (1000 * 60 * 60);
    totalMs += employeeWorkedTodayMs;

    userHours[empId] = {
      name: empName,
      hours: Number(workedHours.toFixed(2)),
      isInside
    };
  });

  const totalHours = totalMs / (1000 * 60 * 60);
  return {
    totalHours: Number(totalHours.toFixed(2)),
    userHours
  };
}

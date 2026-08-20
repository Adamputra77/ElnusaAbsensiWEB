import { 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { PresenceType, PresenceLog, Employee } from '../types';
import { format, subDays } from 'date-fns';
import { handleFirestoreError, OperationType } from './firestoreUtils';
import { getCachedEmployee, syncEmployees } from './employeeCache';

export async function getEmployeeByNik(nik: string): Promise<Employee | null> {
  // Clean input from any common scanner suffixes and non-printable characters
  // 1. Remove all control characters (0-31 and 127-159)
  // 2. Remove common barcode start/stop markers (*, ;, ?, %, #)
  // 3. Trim whitespace
  let cleanNik = nik.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  cleanNik = cleanNik.replace(/[^\x20-\x7E]/g, ''); // Non-printable ASCII
  cleanNik = cleanNik.replace(/^[*?;%#]+|[*?;%#]+$/g, ''); // Strip prefix/suffix
  
  if (!cleanNik) return null;

  try {
    // Strategy 1: Client cache (0 Firestore reads — biggest quota saver)
    const cached = getCachedEmployee(cleanNik);
    if (cached) return cached;

    // Strategy 2: Direct Document ID (Exactly as stored)
    const docRef = doc(db, 'employees', cleanNik);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Employee;
    }

    // Strategy 3: Full collection scan as last resort (reads everything — only when cache misses)
    const all = await syncEmployees();
    const found = all[cleanNik]
      || Object.values(all).find(e => e.nik === cleanNik)
      || Object.values(all).find(e => e.nik === cleanNik.toUpperCase())
      || Object.values(all).find(e => {
        const storedName = String(e.name || '').toUpperCase();
        const searchVal = cleanNik.toUpperCase();
        return storedName === searchVal || storedName.includes(searchVal) || searchVal.includes(storedName);
      });
    if (found) return found;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'employees');
  }

  return null;
}

export async function getLatestLog(employeeId: string, date: string): Promise<PresenceLog | null> {
  try {
    const logsRef = collection(db, 'presence_logs');
    const q = query(
      logsRef,
      where('employeeId', '==', employeeId),
      where('date', '==', date)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      // Sort in memory to avoid composite index
      const sorted = querySnapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as PresenceLog))
        .sort((a, b) => {
          const t1 = (a.timestamp as any)?.seconds || 0;
          const t2 = (b.timestamp as any)?.seconds || 0;
          return t2 - t1; // Descending
        });
      return sorted[0];
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'presence_logs');
  }
  return null;
}

export async function getAbsoluteLatestLog(employeeId: string): Promise<PresenceLog | null> {
  try {
    const logsRef = collection(db, 'presence_logs');
    // Bound the query to yesterday + today to support night shifts
    // without scanning the employee's entire log history on every scan.
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const q = query(
      logsRef,
      where('employeeId', '==', employeeId),
      where('date', '>=', yesterdayStr)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const sorted = querySnapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as PresenceLog))
        .sort((a, b) => {
          const t1 = a.timestamp 
            ? (typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) 
            : 0;
          const t2 = b.timestamp 
            ? (typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) 
            : 0;
          return t2 - t1; // Descending (latest first)
        });
      return sorted[0];
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'presence_logs');
  }
  return null;
}

export async function processScan(nik: string): Promise<{ success: boolean; message: string; employee?: Employee; type?: PresenceType }> {
  try {
    const employee = await getEmployeeByNik(nik);
    if (!employee) {
      return { success: false, message: 'Karyawan tidak ditemukan' };
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const latestLog = await getAbsoluteLatestLog(employee.id);

    // If stats/{today}.resetAt is set, ignore logs before it so re-testing starts with a clean slate
    // (everyone scans IN on their first post-reset scan regardless of older history).
    let effectiveLatestLog = latestLog;
    if (latestLog && latestLog.timestamp) {
      const resetSnap = await getDoc(doc(db, 'stats', todayStr));
      const resetAt = (resetSnap.data() as any)?.resetAt as any;
      const resetSeconds = resetAt?.seconds || 0;
      if (resetSeconds) {
        const latestSeconds = (latestLog.timestamp as any).seconds
          || Math.floor(new Date(latestLog.timestamp).getTime() / 1000);
        if (latestSeconds < resetSeconds) {
          effectiveLatestLog = null;
        }
      }
    }

    // Guard: Prevent double-scans within a 1-minute window
    if (effectiveLatestLog && effectiveLatestLog.timestamp) {
      const lastSeconds = (effectiveLatestLog.timestamp as any).seconds || Math.floor(new Date(effectiveLatestLog.timestamp).getTime() / 1000);
      const lastTime = lastSeconds * 1000;
      const now = Date.now();
      const diffMinutes = (now - lastTime) / (1000 * 60);
      
      if (diffMinutes < 1) { // 1 minute cooldown per individual
        return { 
          success: false, 
          message: `Mohon tunggu sebentar (${Math.ceil(60 - (now - lastTime) / 1000)}s)`, 
          employee 
        };
      }
    }

    let nextType = PresenceType.IN;
    if (effectiveLatestLog && effectiveLatestLog.type === PresenceType.IN) {
      nextType = PresenceType.OUT;
    }

    // Atomic update for Log and Stats Document
    const batch = writeBatch(db);
    
    // 1. Create Presence Log record
    const logRef = doc(collection(db, 'presence_logs'));
    batch.set(logRef, {
      employeeId: employee.id,
      type: nextType,
      timestamp: serverTimestamp(),
      date: todayStr
    });

    // 2. Update the Daily Stats document for real-time aggregation
    const statsRef = doc(db, 'stats', todayStr);
    const isVisitor = employee.isVisitor === true;
    
    const statsUpdate: any = {};
    if (nextType === PresenceType.IN) {
      statsUpdate.in = increment(1);
      statsUpdate.pob = increment(1);
      if (isVisitor) {
        statsUpdate.totalVisits = increment(1);
        statsUpdate.visitorIn = increment(1);
      }
    } else {
      statsUpdate.out = increment(1);
      statsUpdate.pob = increment(-1);
      if (isVisitor) {
        statsUpdate.visitorOut = increment(1);
      }
    }

    // Ensure document exists and update counters atomically
    batch.set(statsRef, statsUpdate, { merge: true });

    // 3. Accumulate Running Total Man Hours to Firestore under stats/warehouse
    if (nextType === PresenceType.OUT && effectiveLatestLog && effectiveLatestLog.timestamp) {
      const checkInTime = typeof effectiveLatestLog.timestamp.toDate === 'function'
        ? effectiveLatestLog.timestamp.toDate()
        : new Date(effectiveLatestLog.timestamp);
      
      const checkOutTime = new Date();
      const durationMs = checkOutTime.getTime() - checkInTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      // Validate duration: positive and less than 24 hours (safeguard against legacy anomalous open check-ins)
      if (durationHours > 0 && durationHours < 24) {
        const warehouseStatsRef = doc(db, 'stats', 'warehouse');
        batch.set(warehouseStatsRef, {
          completedManHours: increment(durationHours),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    }

    await batch.commit();

    const msg = nextType === PresenceType.IN 
      ? `Selamat Datang, ${employee.name}` 
      : `Selamat Jalan, ${employee.name}`;

    return { 
      success: true, 
      message: msg, 
      employee, 
      type: nextType 
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'presence_logs (batch)');
    return { success: false, message: 'Terjadi kesalahan sistem' };
  }
}

export async function getDailyStats(date: string) {
  try {
    const logsRef = collection(db, 'presence_logs');
    const employeesRef = collection(db, 'employees');
    
    // Fetch both to correlate data
    const [logsSnap, empSnap] = await Promise.all([
      getDocs(query(logsRef, where('date', '==', date))),
      getDocs(employeesRef)
    ]);
    
    const empMap: Record<string, any> = {};
    empSnap.forEach(d => { empMap[d.id] = { ...d.data(), id: d.id }; });

    // Sort in memory to avoid mandatory composite index
    const logs = logsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as PresenceLog))
      .sort((a, b) => {
        const t1 = (a.timestamp as any)?.seconds || 0;
        const t2 = (b.timestamp as any)?.seconds || 0;
        return t1 - t2;
      });
    const personStates: Record<string, PresenceType> = {};
    const visitorInIds = new Set<string>();

    let inCount = 0;
    let outCount = 0;
    let vInCount = 0;
    let vOutCount = 0;

    logs.forEach(log => {
      const emp = empMap[log.employeeId];
      const isVisitor = emp?.isVisitor === true;
      
      // Track current state for POB (Personnel On Board) - for EVERYONE
      personStates[log.employeeId] = log.type;

      if (log.type === PresenceType.IN) {
        inCount++;
        if (isVisitor) {
          visitorInIds.add(log.employeeId);
          vInCount++;
        }
      } else {
        outCount++;
        if (isVisitor) {
          vOutCount++;
        }
      }
    });

    // POB is current people (employees + visitors) active on site (last state is IN)
    let pob = 0;
    Object.values(personStates).forEach(status => {
      if (status === PresenceType.IN) pob++;
    });

    return {
      in: inCount,
      out: outCount,
      pob,
      totalVisits: visitorInIds.size,
      visitorIn: vInCount,
      visitorOut: vOutCount
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'presence_logs/employees');
    return { in: 0, out: 0, pob: 0, totalVisits: 0, visitorIn: 0, visitorOut: 0 };
  }
}

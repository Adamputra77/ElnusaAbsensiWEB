import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { PresenceType, PresenceLog, Employee } from '../types';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from './firestoreUtils';

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
    const employeesRef = collection(db, 'employees');
    
    // Strategy 1: Direct Document ID (Exactly as stored)
    const docRef = doc(db, 'employees', cleanNik);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Employee;
    }
    
    // Strategy 2: Explicit 'nik' field query (Exact match)
    const q1 = query(employeesRef, where('nik', '==', cleanNik));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      const d = snap1.docs[0];
      return { id: d.id, ...d.data() } as Employee;
    }

    // Strategy 3: Case-insensitive 'nik' search
    const qUpper = query(employeesRef, where('nik', '==', cleanNik.toUpperCase()));
    const snapUpper = await getDocs(qUpper);
    if (!snapUpper.empty) return { id: snapUpper.docs[0].id, ...snapUpper.docs[0].data() } as Employee;

    // Strategy 4: Numeric normalization (Leading Zeros)
    if (/^\d+$/.test(cleanNik)) {
       const stripped = cleanNik.replace(/^0+/, '');
       if (stripped && stripped !== cleanNik) {
         const qStripped = query(employeesRef, where('nik', '==', stripped));
         const snapStripped = await getDocs(qStripped);
         if (!snapStripped.empty) return { id: snapStripped.docs[0].id, ...snapStripped.docs[0].data() } as Employee;
       }
    }

    // Strategy 5: Search by Name (Fallback if scanner reads the name instead of NIK)
    const qName = query(employeesRef, where('name', '==', cleanNik.toUpperCase()));
    const snapName = await getDocs(qName);
    if (!snapName.empty) return { id: snapName.docs[0].id, ...snapName.docs[0].data() } as Employee;

    // Strategy 6: Partial Name Match (Just in case scanner adds extra text or prefixes)
    const qAll = query(employeesRef);
    const allSnap = await getDocs(qAll);
    const found = allSnap.docs.find(d => {
      const data = d.data();
      const storedNik = String(data.nik || d.id).toUpperCase();
      const storedName = String(data.name || '').toUpperCase();
      const searchVal = cleanNik.toUpperCase();
      
      return storedNik === searchVal || 
             storedName === searchVal || 
             storedName.includes(searchVal) ||
             searchVal.includes(storedName);
    });
    
    if (found) return { id: found.id, ...found.data() } as Employee;

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

export async function processScan(nik: string): Promise<{ success: boolean; message: string; employee?: Employee; type?: PresenceType }> {
  try {
    const employee = await getEmployeeByNik(nik);
    if (!employee) {
      return { success: false, message: 'Karyawan tidak ditemukan' };
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const latestLog = await getLatestLog(employee.id, todayStr);

    // Guard: Prevent double-scans within a 1-minute window
    if (latestLog && latestLog.timestamp) {
      const lastTime = (latestLog.timestamp as any).seconds * 1000;
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
    if (latestLog && latestLog.type === PresenceType.IN) {
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

import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Employee } from '../types';

const CACHE_KEY = 'elnusa_employees_cache_v1';
const META_REF = doc(db, 'meta', 'employees');

interface EmployeesCache {
  version: number;
  savedAt: number;
  employees: Record<string, Employee>;
}

export async function readMetaVersion(): Promise<number> {
  try {
    const snap = await getDoc(META_REF);
    return snap.exists() ? Number(snap.data().version || 0) : 0;
  } catch {
    return -1;
  }
}

export async function fetchAllEmployees(): Promise<Record<string, Employee>> {
  const snap = await getDocs(collection(db, 'employees'));
  const map: Record<string, Employee> = {};
  snap.forEach(d => {
    map[d.id] = { id: d.id, ...d.data() } as Employee;
  });
  return map;
}

function loadCache(): EmployeesCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmployeesCache;
    if (!parsed || typeof parsed.version !== 'number' || !parsed.employees) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(version: number, employees: Record<string, Employee>) {
  try {
    const payload: EmployeesCache = {
      version,
      savedAt: Date.now(),
      employees
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full/blocked — ignore, app falls back to Firestore reads
  }
}

export function getCachedEmployee(nik: string): Employee | null {
  const cache = loadCache();
  if (!cache) return null;
  const clean = nik.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim()
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/^[*?;%#]+|[*?;%#]+$/g, '');
  if (!clean) return null;

  const { employees } = cache;
  if (employees[clean]) return employees[clean];
  const byNik = Object.values(employees).find(e => e.nik === clean);
  if (byNik) return byNik;
  const byUpper = Object.values(employees).find(e => e.nik === clean.toUpperCase());
  if (byUpper) return byUpper;
  if (/^\d+$/.test(clean)) {
    const stripped = clean.replace(/^0+/, '');
    if (stripped && stripped !== clean) {
      const byStripped = Object.values(employees).find(e => e.nik === stripped);
      if (byStripped) return byStripped;
    }
  }
  const cleanUpper = clean.toUpperCase();
  const byName = Object.values(employees).find(e =>
    String(e.name || '').toUpperCase() === cleanUpper ||
    String(e.name || '').toUpperCase().includes(cleanUpper) ||
    cleanUpper.includes(String(e.name || '').toUpperCase())
  );
  return byName || null;
}

export async function syncEmployees(): Promise<Record<string, Employee>> {
  const remoteVersion = await readMetaVersion();
  if (remoteVersion < 0) {
    const cache = loadCache();
    if (cache) return cache.employees;
    return {};
  }

  const cache = loadCache();
  if (cache && cache.version === remoteVersion) {
    return cache.employees;
  }

  const employees = await fetchAllEmployees();
  saveCache(remoteVersion, employees);
  return employees;
}

export async function bumpEmployeeVersion() {
  try {
    const current = await readMetaVersion();
    const next = current < 0 ? 1 : current + 1;
    await setDoc(META_REF, { version: next, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    // Best effort — next session sync will correct
  }
}
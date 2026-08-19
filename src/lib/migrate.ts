import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  query,
  limit,
  startAfter,
  where,
  setDoc,
  doc,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';

const TARGET_CONFIG = {
  apiKey: 'AIzaSyB6y06FzLHKYRBmJ3IXseBFLbZeQXWhKY8',
  authDomain: 'elnusa-absensi-bsd.firebaseapp.com',
  projectId: 'elnusa-absensi-bsd',
  storageBucket: 'elnusa-absensi-bsd.firebasestorage.app',
  messagingSenderId: '563884307915',
  appId: '1:563884307915:web:fe11fd9880281ad686f24e'
};

const COLLECTIONS = ['employees', 'presence_logs', 'stats', 'system_config'] as const;

interface MigrationOptions {
  skipIfPresent?: boolean;
  sinceDate?: string;
}

type ProgressFn = (message: string) => void;

async function copyCollection(
  sourceRef: any,
  targetRef: any,
  onProgress: ProgressFn,
  opts: MigrationOptions
): Promise<number> {
  const PAGE_SIZE = 500;
  let total = 0;
  let lastDoc: any = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q;
    if (opts.sinceDate && targetRef.id === 'presence_logs') {
      q = lastDoc
        ? query(sourceRef, where('date', '>=', opts.sinceDate), limit(PAGE_SIZE), startAfter(lastDoc))
        : query(sourceRef, where('date', '>=', opts.sinceDate), limit(PAGE_SIZE));
    } else if (opts.sinceDate && targetRef.id === 'stats') {
      // stats doc IDs are the date strings; filter in memory
      q = lastDoc
        ? query(sourceRef, limit(PAGE_SIZE), startAfter(lastDoc))
        : query(sourceRef, limit(PAGE_SIZE));
    } else {
      q = lastDoc
        ? query(sourceRef, limit(PAGE_SIZE), startAfter(lastDoc))
        : query(sourceRef, limit(PAGE_SIZE));
    }

    const snap = await getDocs(q);
    if (snap.empty) break;

    const chunk: { id: string; data: any }[] = [];
    snap.docs.forEach(d => {
      if (opts.sinceDate && targetRef.id === 'stats' && d.id < opts.sinceDate) return;
      chunk.push({ id: d.id, data: d.data() });
    });

    if (chunk.length > 0) {
      const batch = writeBatch(targetRef.firestore);
      chunk.forEach(({ id, data }) => {
        batch.set(doc(targetRef, id), data);
      });
      await batch.commit();
      total += chunk.length;
      onProgress(`${targetRef.id}: ${total} dokumen tersalin...`);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (chunk.length < PAGE_SIZE) break;
  }

  return total;
}

export async function runMigration(
  onProgress: ProgressFn,
  opts: MigrationOptions = {}
): Promise<Record<string, number>> {
  const targetApp = initializeApp(TARGET_CONFIG, 'migration-target');
  const targetDb = getFirestore(targetApp);

  const summary: Record<string, number> = {};

  try {
    for (const coll of COLLECTIONS) {
      const sourceRef = collection(db, coll);
      const targetRef = collection(targetDb, coll);

      if (opts.skipIfPresent && !opts.sinceDate) {
        const probe = await getDocs(query(targetRef, limit(1)));
        if (!probe.empty) {
          onProgress(`${coll}: sudah ada di target, dilewati.`);
          summary[coll] = -1; // -1 = skipped
          continue;
        }
      }

      try {
        summary[coll] = await copyCollection(sourceRef, targetRef, onProgress, opts);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onProgress(`${coll}: GAGAL (${msg})`);
        summary[coll] = -1;
      }
    }

    // Ensure meta/employees version exists (used by client-side cache)
    const metaRef = doc(targetDb, 'meta', 'employees');
    try {
      if (!(await getDoc(metaRef)).exists()) {
        await setDoc(metaRef, { version: 1, updatedAt: Timestamp.now() }, { merge: true });
        onProgress('meta/employees: dibuat (version 1).');
      } else {
        onProgress('meta/employees: sudah ada, dilewati.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onProgress(`meta/employees: GAGAL (${msg})`);
    }
  } finally {
    try {
      await deleteApp(targetApp);
    } catch {
      // App instance may already be deleted — ignore
    }
  }

  return summary;
}

export function buildDeltaOptions(): MigrationOptions {
  return { sinceDate: format(new Date(), 'yyyy-MM-dd') };
}
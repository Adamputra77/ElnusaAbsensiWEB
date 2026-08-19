import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  query,
  limit,
  startAfter,
  setDoc,
  doc,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

const TARGET_CONFIG = {
  apiKey: 'AIzaSyB6y06FzLHKYRBmJ3IXseBFLbZeQXWhKY8',
  authDomain: 'elnusa-absensi-bsd.firebaseapp.com',
  projectId: 'elnusa-absensi-bsd',
  storageBucket: 'elnusa-absensi-bsd.firebasestorage.app',
  messagingSenderId: '563884307915',
  appId: '1:563884307915:web:fe11fd9880281ad686f24e'
};

const COLLECTIONS = ['employees', 'presence_logs', 'stats', 'system_config', 'meta'] as const;

type ProgressFn = (message: string) => void;

export async function runMigration(onProgress: ProgressFn): Promise<Record<string, number>> {
  const targetApp = initializeApp(TARGET_CONFIG, 'migration-target');
  const targetDb = getFirestore(targetApp);

  const summary: Record<string, number> = {};

  try {
    for (const coll of COLLECTIONS) {
      const sourceRef = collection(db, coll);
      const targetRef = collection(targetDb, coll);
      const PAGE_SIZE = 500;
      let total = 0;
      let lastDoc: any = null;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const q = lastDoc
          ? query(sourceRef, limit(PAGE_SIZE), startAfter(lastDoc))
          : query(sourceRef, limit(PAGE_SIZE));
        const snap = await getDocs(q);
        if (snap.empty) break;

        const chunk: { id: string; data: any }[] = [];
        snap.docs.forEach(d => {
          chunk.push({ id: d.id, data: d.data() });
        });

        const batch = writeBatch(targetDb);
        chunk.forEach(({ id, data }) => {
          batch.set(doc(targetRef, id), data);
        });
        await batch.commit();

        total += chunk.length;
        lastDoc = snap.docs[snap.docs.length - 1];
        onProgress(`${coll}: ${total} dokumen tersalin...`);
        if (chunk.length < PAGE_SIZE) break;
      }

      summary[coll] = total;
    }

    // Ensure meta/employees version exists (used by client-side cache)
    const metaRef = doc(targetDb, 'meta', 'employees');
    if (!(await getDoc(metaRef)).exists()) {
      await setDoc(metaRef, { version: 1, updatedAt: Timestamp.now() }, { merge: true });
      summary.meta = (summary.meta || 0) + 1;
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
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function resetManHours() {
  const warehouseRef = doc(db, 'stats', 'warehouse');
  const snapBefore = await getDoc(warehouseRef);
  const before = snapBefore.data() || {};

  console.log(`📊 Sebelum reset: completedManHours = ${before.completedManHours ?? 0}`);

  await setDoc(warehouseRef, {
    completedManHours: 0,
    manHoursResetAt: serverTimestamp(),
    manHoursResetNote: 'Manual reset via scripts/reset-manhours.ts'
  }, { merge: true });

  const snapAfter = await getDoc(warehouseRef);
  console.log(`✅ Setelah reset: completedManHours = ${snapAfter.data()?.completedManHours ?? 0}`);
  console.log('   Man hours baru akan mulai dihitung dari scan OUT berikutnya.');
}

resetManHours().catch((err) => {
  console.error('❌ Gagal reset:', err);
  process.exit(1);
});

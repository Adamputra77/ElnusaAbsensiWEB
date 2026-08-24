import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function resetToday() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const statsRef = doc(db, 'stats', todayStr);

  // Update (bukan delete) — diizinkan oleh Firestore rules:
  //   match /stats/{date} { allow create, update: if true; }
  await setDoc(statsRef, {
    in: 0,
    out: 0,
    pob: 0,
    totalVisits: 0,
    visitorIn: 0,
    visitorOut: 0,
    resetAt: serverTimestamp(),
    resetNote: 'Manual reset via scripts/reset-today-stats.ts'
  }, { merge: true });

  const snap = await getDoc(statsRef);
  console.log(`✅ stats/${todayStr} berhasil direset ke 0.`);
  console.log('   Data:', JSON.stringify(snap.data(), null, 2));
  console.log('');
  console.log('📌 Log lama TIDAK dihapus — sistem otomatis mengabaikan');
  console.log('   semua log sebelum resetAt (marker sudah dipasang).');
}

resetToday().catch((err) => {
  console.error('❌ Gagal reset:', err);
  process.exit(1);
});
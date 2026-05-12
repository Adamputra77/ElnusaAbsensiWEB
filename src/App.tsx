import { useState, useEffect } from 'react';
import ScanInterface from './components/ScanInterface';
import AdminDashboard from './components/AdminDashboard';
import { LoginSelection } from './components/LoginSelection';
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';
import { Settings2, ScanLine, LogOut, User, Clock, Bell, History, ArrowRight, Loader2, Calendar, Smartphone, QrCode, AlertTriangle, Hammer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Employee, PresenceLog, UserRole } from './types';
import { collection, query, where, orderBy, getDocs, Timestamp, onSnapshot, doc } from 'firebase/firestore';
import { db } from './firebase';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from './lib/firestoreUtils';

type ViewMode = 'SCAN' | 'ADMIN';

export default function App() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [authEmployee, setAuthEmployee] = useState<Employee | null>(null);
  const [myLogs, setMyLogs] = useState<PresenceLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [view, setView] = useState<ViewMode>('SCAN');
  const [maintenance, setMaintenance] = useState<{ active: boolean; message: string }>({ active: false, message: '' });

  useEffect(() => {
    // Listen to maintenance mode
    const unsub = onSnapshot(doc(db, 'system_config', 'main'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setMaintenance({
          active: !!data.maintenanceMode,
          message: data.message || 'Sistem sedang dalam pemeliharaan rutin. Mohon tunggu beberapa saat.'
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system_config/main');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Force view mode based on role
    if (userRole === UserRole.SECURITY) {
      setView('SCAN');
    } else if (userRole === UserRole.ADMIN) {
      setView('ADMIN');
    }
  }, [userRole]);

  const handleLogout = () => {
    setUserRole(null);
    setAuthEmployee(null);
    setMyLogs([]);
    setView('SCAN');
  };

  const handleLoginSelect = (role: UserRole, employeeData?: Employee) => {
    setUserRole(role);
    if (employeeData) {
      setAuthEmployee(employeeData);
    }
  };

  useEffect(() => {
    if (userRole === UserRole.EMPLOYEE && authEmployee) {
      fetchMyLogs();
    }
  }, [userRole, authEmployee]);

  const fetchMyLogs = async () => {
    if (!authEmployee) return;
    setIsLoadingLogs(true);
    try {
      const logsRef = collection(db, 'presence_logs');
      const q = query(
        logsRef,
        where('employeeId', '==', authEmployee.id),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: (doc.data().timestamp as Timestamp)?.toDate()
      })) as PresenceLog[];
      setMyLogs(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'presence_logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  if (!userRole) {
    return <LoginSelection onSelectRole={handleLoginSelect} />;
  }

  // Employee Portal View
  if (userRole === UserRole.EMPLOYEE && authEmployee) {
    return (
      <div className="min-h-screen bg-[#020617] text-white p-4 md:p-12 relative overflow-hidden font-sans">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] -z-10" />
        
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-10">
          {/* Employee Header */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/40 p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-800 backdrop-blur-xl">
            <div className="flex items-center gap-4 md:gap-5">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-purple-500/20 shrink-0">
                <User size={24} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-4xl font-black uppercase tracking-tighter leading-tight truncate">
                  Halo, <span className="text-purple-400">{authEmployee.name.split(' ')[0]}</span>!
                </h1>
                <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                  <span className="text-slate-500 uppercase tracking-widest text-[8px] md:text-[10px] font-black border border-slate-800 px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg shrink-0">
                    {authEmployee.id}
                  </span>
                  <span className="text-purple-400 uppercase tracking-widest text-[8px] md:text-[10px] font-black bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg shrink-0 truncate max-w-[120px] md:max-w-none">
                    {authEmployee.department}
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="w-full md:w-auto group flex items-center justify-center gap-3 px-6 py-3 md:py-4 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 rounded-2xl text-red-400 hover:text-white transition-all font-black uppercase tracking-widest text-[9px] md:text-[10px] active:scale-95"
            >
              <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" />
              Keluar Portal
            </button>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Main Log History */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] md:rounded-[2.5rem] backdrop-blur-xl overflow-hidden shadow-2xl">
                <div className="p-5 md:p-8 border-b border-slate-800 flex justify-between items-center">
                  <h2 className="text-base md:text-xl font-black uppercase tracking-tight flex items-center gap-3 italic">
                    <History className="text-purple-400" size={20} />
                    Riwayat Kehadiran
                  </h2>
                  <button 
                    onClick={fetchMyLogs}
                    className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                  >
                    Refresh
                  </button>
                </div>
                
                <div className="p-2 overflow-x-auto">
                  {isLoadingLogs ? (
                    <div className="py-16 md:py-24 flex flex-col items-center gap-4 text-slate-500">
                      <Loader2 size={32} className="animate-spin text-purple-500" />
                      <p className="text-[9px] font-black uppercase tracking-[0.3em]">Memuat Data...</p>
                    </div>
                  ) : myLogs.length === 0 ? (
                    <div className="py-16 md:py-24 flex flex-col items-center gap-4 opacity-30">
                      <Clock size={40} />
                      <p className="text-xs font-black uppercase tracking-[0.2em]">Belum Ada Riwayat</p>
                    </div>
                  ) : (
                    <table className="w-full text-left min-w-[320px]">
                      <thead>
                        <tr className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                          <th className="px-4 md:px-6 py-4 md:py-5">Tanggal</th>
                          <th className="px-4 md:px-6 py-4 md:py-5">Status</th>
                          <th className="hidden md:table-cell px-6 py-5 text-right w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {myLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-800/30 transition-all group">
                            <td className="px-4 md:px-6 py-4 md:py-5">
                              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                <span className="font-bold text-slate-200 text-sm">{format(log.timestamp, 'dd MMM yyyy')}</span>
                                <span className="font-mono text-slate-500 text-[10px] md:text-sm">{format(log.timestamp, 'HH:mm')}</span>
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4 md:py-5">
                              <span className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest border ${
                                log.type === 'IN' 
                                  ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                <div className={`w-1 h-1 rounded-full ${log.type === 'IN' ? 'bg-green-500' : 'bg-red-500'}`} />
                                {log.type === 'IN' ? 'Masuk' : 'Keluar'}
                              </span>
                            </td>
                            <td className="hidden md:table-cell px-6 py-5 text-right">
                              <ArrowRight size={14} className="text-slate-700 group-hover:text-purple-500 transition-colors" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Stats & Info */}
            <div className="space-y-6 md:space-y-8">
              {/* My Access Code Card */}
              <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl flex flex-col items-center">
                <div className="flex items-center gap-2 mb-6">
                  <QrCode className="text-blue-500" size={16} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Scan QR Code</span>
                </div>
                
                <div className="bg-white p-4 md:p-6 rounded-3xl border-2 border-slate-50 mb-6 flex justify-center shadow-inner">
                  <div className="p-2 bg-white">
                    <QRCode 
                      value={authEmployee.id}
                      size={120}
                      level="H"
                    />
                  </div>
                </div>

                <div className="w-full h-px bg-slate-100 mb-6" />

                <div className="flex items-center gap-2 mb-4">
                  <Smartphone className="text-slate-300" size={12} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Alternatif Barcode</span>
                </div>

                <div className="opacity-40 grayscale hover:grayscale-0 transition-all cursor-help scale-90 md:scale-100">
                  <Barcode 
                    value={authEmployee.id}
                    width={1}
                    height={35}
                    fontSize={10}
                    margin={0}
                  />
                </div>
                
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mt-6 leading-relaxed">
                  Gunakan QR Code di atas untuk scan<br className="hidden md:block" />langsung dari layar handphone Anda
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-8 rounded-[2.5rem] shadow-2xl shadow-purple-600/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Bell size={80} />
                </div>
                <h3 className="font-black text-xs md:text-sm flex items-center gap-2 mb-4 uppercase tracking-widest">
                  <Bell size={20} />
                  Informasi Penting
                </h3>
                <p className="text-sm text-slate-900 bg-white p-4 rounded-2xl font-bold leading-relaxed shadow-inner">
                  "Pastikan barcode di scan dengan benar. Hubungi IT Warehouse jika NIK tidak terbaca."
                </p>
              </div>
              
              <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] backdrop-blur-xl space-y-6 shadow-xl">
                <div>
                  <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Ringkasan Absensi</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Scan</p>
                      <p className="text-2xl font-black text-white">{myLogs.length}</p>
                    </div>
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Hari Ini</p>
                      <p className="text-2xl font-black text-purple-400">
                        {myLogs.filter(l => format(l.timestamp, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Lokasi Tugas</h3>
                  <div className="flex items-center gap-3 p-4 bg-slate-950/50 rounded-2xl border border-blue-500/20">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    <span className="font-bold text-xs uppercase tracking-widest text-slate-200">Gudang BSD Blok A</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Branding */}
        <footer className="mt-20 text-center opacity-20 pointer-events-none select-none pb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
            Warehouse ELNUSA BSD IT Systems • 2026
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen font-sans">
      {/* Maintenance Overlay */}
      <AnimatePresence>
        {maintenance.active && userRole !== UserRole.ADMIN && userRole !== UserRole.SECURITY && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-[#020617]/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl max-w-lg w-full text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 md:h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 animate-shimmer" />
              
              <div className="w-16 h-16 md:w-24 md:h-24 bg-orange-600/10 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8 text-orange-500 relative">
                <Hammer size={32} className="md:size-[48px] animate-bounce" />
                <AlertTriangle size={18} className="md:size-[24px] absolute -top-1 -right-1 text-amber-500" />
              </div>

              <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight mb-3 md:mb-4 italic">
                SISTEM <span className="text-orange-500 underline decoration-orange-500/30">MAINTENANCE</span>
              </h2>
              
              <p className="text-slate-400 text-xs md:text-sm font-bold leading-relaxed mb-8 md:mb-10 px-2 md:px-4">
                {maintenance.message}
              </p>

              <div className="bg-slate-950 p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-800/50 mb-6 md:mb-8 inline-block">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-slate-500 leading-none">
                  Expected Uptime <span className="text-white ml-2">SOON</span>
                </p>
              </div>

              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">
                WH ELNUSA BSD • IT OPS
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin/Security Controls */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3">
        <button
          onClick={handleLogout}
          className="p-3 md:p-5 bg-red-600/10 hover:bg-red-600/30 backdrop-blur-xl border border-red-500/20 hover:border-red-500 rounded-2xl md:rounded-[1.5rem] shadow-2xl transition-all text-red-500 active:scale-95 group relative flex items-center justify-center shrink-0"
          title="Logout"
        >
          <LogOut size={20} className="md:size-6" />
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 py-2 px-4 bg-red-600 text-white text-[10px] font-black rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none uppercase tracking-widest whitespace-nowrap shadow-xl hidden md:block">
            Logout {userRole === UserRole.ADMIN ? 'Admin' : 'Security'}
          </div>
        </button>

        {(userRole === UserRole.ADMIN || userRole === UserRole.SECURITY) && (
          <button
            onClick={() => setView(view === 'SCAN' ? 'ADMIN' : 'SCAN')}
            className="p-3 md:p-5 bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-2xl md:rounded-[1.5rem] shadow-2xl hover:scale-110 hover:border-blue-500/50 transition-all text-slate-400 hover:text-blue-400 group active:scale-95 relative flex items-center justify-center shrink-0"
            title={view === 'SCAN' ? 'Go to Dashboard' : 'Go to Scan Interface'}
          >
            {view === 'SCAN' ? <Settings2 size={20} className="md:size-6" /> : <ScanLine size={20} className="md:size-6" />}
            <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 py-2 px-4 bg-blue-600 text-white text-[10px] font-black rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none uppercase tracking-widest whitespace-nowrap shadow-xl hidden md:block">
              {view === 'SCAN' ? 'Dashboard Monitoring' : 'Gate Scan Interface'}
            </div>
          </button>
        )}
      </div>

      {/* Conditional Rendering of Views */}
      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {view === 'SCAN' ? <ScanInterface /> : <AdminDashboard userRole={userRole} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="fixed bottom-4 left-4 pointer-events-none opacity-30 select-none">
        <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
          Powered by Warehouse ELNUSA BSD
        </div>
      </footer>
    </div>
  );
}

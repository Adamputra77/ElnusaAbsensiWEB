import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scan, Users, LogIn, LogOut, Search, AlertCircle } from 'lucide-react';
import { processScan, getDailyStats } from '../lib/attendance';
import { DailyStats, PresenceType, Employee } from '../types';
import { format } from 'date-fns';
import Scanner from './Scanner';
import { collection, getDocs, onSnapshot, doc, query } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export default function ScanInterface() {
  const [nikInput, setNikInput] = useState('');
  const [stats, setStats] = useState<DailyStats>({ in: 0, out: 0, pob: 0, totalVisits: 0 });
  const [hasEmployees, setHasEmployees] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | null; employee?: Employee; scanType?: PresenceType } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  
  // Refs for immediate synchronous locking (React state is too slow for 100ms hardware repeats)
  const isProcessingRef = useRef(false);
  const recentScansRef = useRef<Record<string, number>>({});
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkEmployees();
    
    // Timer for display
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Dedicated real-time stats listener (separated for clarity)
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const unsubscribe = onSnapshot(doc(db, 'stats', today), (snap) => {
      if (snap.exists()) {
        setStats(snap.data() as DailyStats);
      } else {
        setStats({ in: 0, out: 0, pob: 0, totalVisits: 0 });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `stats/${today}`);
    });

    return () => unsubscribe();
  }, []);

  // Keep input focused for barcode scanner
  useEffect(() => {
    const handleFocus = () => {
      if (!showCamera) inputRef.current?.focus();
    };
    window.addEventListener('click', handleFocus);
    handleFocus();
    return () => window.removeEventListener('click', handleFocus);
  }, [showCamera]);

  const fetchStats = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const s = await getDailyStats(today);
    setStats(s);
  };

  const checkEmployees = async () => {
    try {
      const snap = await getDocs(collection(db, 'employees'));
      setHasEmployees(!snap.empty);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'employees');
    }
  };

  const handleScan = async (nik: string) => {
    // 1. Immediate capture and clear to prevent race conditions
    const cleanNik = nik.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
    
    if (!cleanNik) return;
    
    // Check Ref for immediate lock
    if (isProcessingRef.current) return;

    // 2. Cooldown check per NIK using Ref (Synchronous)
    const now = Date.now();
    const CLIENT_COOLDOWN = 10000; // 10 seconds client-side guard
    const lastNIKTime = recentScansRef.current[cleanNik] || 0;
    
    if (now - lastNIKTime < CLIENT_COOLDOWN) {
      console.log(`Cooldown active (REF) for ${cleanNik}...`);
      setNikInput(''); // Clear input anyway
      return;
    }
    
    // Set immediate Ref locks
    isProcessingRef.current = true;
    recentScansRef.current[cleanNik] = now;
    
    // Set UI states
    setIsProcessing(true);
    setNikInput(''); // Clear UI input immediately
    
    try {
      const result = await processScan(cleanNik);
      if (result.success) {
        setNotification({ 
          message: result.message, 
          type: 'success', 
          employee: result.employee,
          scanType: result.type
        });
        fetchStats();
      } else {
        // Show check if it was just a cooldown from server
        setNotification({ 
          message: result.message, 
          type: result.message.includes('tunggu') ? 'error' : 'error' 
        });
      }
    } catch (err) {
      console.error("Scan Error:", err);
      setNotification({ message: 'Terjadi kegagalan sistem.', type: 'error' });
    } finally {
      // Release locks
      isProcessingRef.current = false;
      setIsProcessing(false);
      
      // Refocus after short delay
      setTimeout(() => {
        if (!showCamera && inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }

    // Clear notification after 5 seconds
    setTimeout(() => {
      setNotification(prev => (prev?.type === 'success' || prev?.type === 'error' ? null : prev));
    }, 5000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Hardware scanners often send 'Enter' or 'Tab' after the barcode data
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const valueAtTrigger = (e.currentTarget as HTMLInputElement).value;
      
      if (valueAtTrigger) {
        // If already processing, just clear and ignore
        if (isProcessingRef.current) {
          setNikInput('');
          return;
        }
        handleScan(valueAtTrigger);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#020617] text-slate-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-auto md:h-16 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md flex flex-col md:flex-row items-center justify-between px-4 md:px-8 py-3 md:py-0 flex-shrink-0 z-50 gap-2 md:gap-0">
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg md:text-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] text-white shrink-0">
              E
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold tracking-tight text-white leading-none uppercase truncate">Warehouse ELNUSA BSD</h1>
              <p className="text-[8px] md:text-[10px] text-slate-400 uppercase tracking-widest mt-1">Presence System</p>
            </div>
          </div>
          
          {/* Mobile Time */}
          <div className="md:hidden text-right">
            <p className="text-sm font-mono font-medium text-white leading-none">{format(currentTime, 'HH:mm:ss')}</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 md:gap-8 w-full md:w-auto justify-end">
          <div className="text-right">
            <p className="text-base md:text-xl font-mono font-medium text-white leading-none">{format(currentTime, 'HH:mm:ss')}</p>
            <p className="text-[8px] md:text-[10px] text-slate-500 uppercase tracking-wider mt-1">{format(currentTime, 'EEEE, dd MMM yyyy')}</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden">
        {/* Decorative Grid Background */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '30px 30px' }}
        ></div>

        <div className="z-10 w-full max-w-4xl flex flex-col items-center">
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg md:text-2xl font-light tracking-[0.2em] md:tracking-[0.3em] text-slate-400 uppercase mb-6 md:mb-8 text-center"
          >
            Silahkan Scan Nomor Anda
          </motion.h2>

          {hasEmployees === false && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-4 max-w-md w-full"
            >
              <AlertCircle className="text-amber-500 shrink-0" size={24} />
              <p className="text-[10px] md:text-xs font-bold text-amber-200/80 uppercase tracking-widest leading-relaxed">
                Database Kosong! Silahkan masuk ke Admin (Password: <span className="text-white">elnusa123</span>) lalu klik "Seed Data".
              </p>
            </motion.div>
          )}

          {/* Scanner Container */}
          <div className="w-full flex flex-col items-center gap-4 md:gap-12">
            {!showCamera ? (
              <div className="relative group w-full max-w-[280px] sm:max-w-md">
                <input
                  ref={inputRef}
                  type="text"
                  autoFocus
                  value={nikInput}
                  onChange={(e) => setNikInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Scan..."
                  className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-xl px-4 md:px-8 py-3 md:py-6 text-center text-xl md:text-3xl font-mono text-blue-400 focus:outline-none focus:border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.1)] transition-all placeholder:text-slate-700"
                />
                
                {/* Corner Accents */}
                <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-sm group-focus-within:animate-pulse"></div>
                <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-sm group-focus-within:animate-pulse"></div>
                <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-sm group-focus-within:animate-pulse"></div>
                <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-sm group-focus-within:animate-pulse"></div>
              </div>
            ) : (
              <div className="relative p-1 md:p-2 bg-slate-900 border-2 border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm">
                <Scanner onScan={(text) => handleScan(text)} />
                <div className="absolute top-2 left-2 w-6 md:w-8 h-6 md:h-8 border-t-4 border-l-4 border-blue-500 z-50"></div>
                <div className="absolute top-2 right-2 w-6 md:w-8 h-6 md:h-8 border-t-4 border-r-4 border-blue-500 z-50"></div>
                <div className="absolute bottom-2 left-2 w-6 md:w-8 h-6 md:h-8 border-b-4 border-l-4 border-blue-500 z-50"></div>
                <div className="absolute bottom-2 right-2 w-6 md:w-8 h-6 md:h-8 border-b-4 border-r-4 border-blue-500 z-50"></div>
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setShowCamera(!showCamera)}
                className="flex items-center gap-3 px-6 md:px-8 py-3 md:py-3.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-2xl text-[10px] md:text-sm font-bold text-blue-400 transition-all active:scale-95 uppercase tracking-widest shadow-lg shadow-blue-600/5 group"
              >
                <Scan size={18} className="group-hover:rotate-90 transition-transform duration-500" />
                {showCamera ? 'Manual NIK' : 'Kamera Scan'}
              </button>
              {showCamera && (
                <p className="text-[8px] text-slate-500 uppercase tracking-widest animate-pulse">
                  Gunakan Kamera untuk Scan
                </p>
              )}
            </div>
          </div>

          {/* Notifications / Results Overlay */}
          <div className="mt-8 md:mt-16 h-auto md:h-40 w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {notification && (
                <motion.div
                  key={notification.message}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className={`w-full p-4 md:p-6 rounded-2xl flex items-center gap-4 md:gap-6 border backdrop-blur-sm ${
                    notification.type === 'error' 
                      ? 'bg-red-500/10 border-red-500/50' 
                      : notification.scanType === PresenceType.OUT
                        ? 'bg-red-500/10 border-red-500/50'
                        : 'bg-green-500/10 border-green-500/50'
                  }`}
                >
                  <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center shrink-0 shadow-lg ${
                    notification.type === 'error' 
                      ? 'bg-red-500 shadow-red-500/40' 
                      : notification.scanType === PresenceType.OUT
                        ? 'bg-red-500 shadow-red-500/40'
                        : 'bg-green-500 shadow-green-500/40'
                  }`}>
                    {notification.type === 'error' || notification.scanType === PresenceType.OUT ? <LogOut size={24} className="text-white" /> : <LogIn size={24} className="text-white" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {notification.type === 'success' && notification.employee ? (
                      <>
                        <p className={`${notification.scanType === PresenceType.OUT ? 'text-red-400' : 'text-green-400'} font-bold text-lg md:text-xl truncate`}>
                          {notification.message.split(',')[0]},
                        </p>
                        <p className="text-white text-xl md:text-2xl font-semibold uppercase tracking-tight truncate">{notification.employee.name}</p>
                        <p className="text-[8px] md:text-[10px] text-slate-400 mt-1 uppercase tracking-[0.2em] font-bold">
                          DEPT: {notification.employee.department} • {format(new Date(), 'HH:mm:ss')}
                        </p>
                      </>
                    ) : (
                      <p className="text-red-400 font-bold text-lg md:text-2xl uppercase tracking-tighter">{notification.message}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Summary Stats Footer Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6 p-3 md:p-8 bg-[#0f172a]/50 border-t border-slate-800 backdrop-blur-lg">
        <div className="bg-slate-900/50 border border-slate-800 p-3 md:p-5 rounded-lg md:rounded-2xl flex flex-col">
          <span className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] mb-1">Masuk</span>
          <span className="text-xl md:text-4xl font-mono text-blue-400">{stats.in}</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 p-3 md:p-5 rounded-lg md:rounded-2xl flex flex-col">
          <span className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] mb-1">Keluar</span>
          <span className="text-xl md:text-4xl font-mono text-slate-300">{stats.out}</span>
        </div>
        <div className="bg-blue-600/10 border border-blue-500/30 p-3 md:p-5 rounded-lg md:rounded-2xl flex flex-col relative overflow-hidden">
          <div className="absolute right-[-5px] md:right-[-10px] bottom-[-5px] md:bottom-[-10px] opacity-10 pointer-events-none">
            <Users size={32} className="text-blue-500 md:size-16" />
          </div>
          <span className="text-blue-400 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] mb-1">POB</span>
          <span className="text-xl md:text-4xl font-mono text-white">{stats.pob}</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-3 md:p-5 rounded-lg md:rounded-2xl flex flex-col">
          <span className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] mb-1">Total Vis.</span>
          <span className="text-xl md:text-4xl font-mono text-white/80">{stats.totalVisits}</span>
        </div>
      </div>

      {/* Real Footer */}
      <footer className="h-12 md:h-10 bg-[#020617] border-t border-slate-900 flex flex-col md:flex-row items-center justify-center md:justify-between px-4 md:px-8 py-2 md:py-0 text-[8px] md:text-[10px] text-slate-600 flex-shrink-0 uppercase tracking-widest gap-1 md:gap-0">
        <div className="flex gap-4 md:gap-8">
          <span>ID: ELN-HQ-01</span>
          <span>Status: ONLINE</span>
        </div>
        <div className="text-center md:text-right">
          © 2026 Warehouse ELNUSA BSD • Systems Virtual
        </div>
      </footer>
    </div>
  );
}

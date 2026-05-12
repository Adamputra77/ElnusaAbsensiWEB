import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, User, ArrowRight, Lock, KeyRound, Loader2, Settings, ShieldAlert, X } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Employee, UserRole } from '../types';

interface LoginSelectionProps {
  onSelectRole: (role: UserRole, employeeData?: Employee) => void;
}

export const LoginSelection: React.FC<LoginSelectionProps> = ({ onSelectRole }) => {
  const [showSecurityLogin, setShowSecurityLogin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showEmployeeLogin, setShowEmployeeLogin] = useState(false);
  
  const [password, setPassword] = useState('');
  const [nik, setNik] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSecurityLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'security123') {
      onSelectRole(UserRole.SECURITY);
    } else {
      setError('Password Security salah! Coba lagi.');
      setPassword('');
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      onSelectRole(UserRole.ADMIN);
    } else {
      setError('Password Admin salah! Coba lagi.');
      setPassword('');
    }
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nik) return;

    setIsLoading(true);
    setError('');

    try {
      const docRef = doc(db, 'employees', nik);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const empData = { id: docSnap.id, ...docSnap.data() } as Employee;
        onSelectRole(UserRole.EMPLOYEE, empData);
      } else {
        setError('NIK tidak terdaftar! Silahkan hubungi Admin jika data belum di-seed.');
      }
    } catch (err) {
      console.error(err);
      setError('Gagal menghubungkan ke server.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setShowSecurityLogin(false);
    setShowAdminLogin(false);
    setShowEmployeeLogin(false);
    setError('');
    setPassword('');
    setNik('');
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-6xl relative z-10">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block p-4 bg-blue-600 rounded-3xl mb-6 shadow-2xl shadow-blue-600/40"
          >
            <ShieldCheck size={48} className="text-white" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter"
          >
            WAREHOUSE <span className="text-blue-500">ELNUSA</span> BSD
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-slate-500 mt-3 font-bold uppercase tracking-[0.4em] text-[10px] md:text-xs"
          >
            Integrated Presence & Warehouse Management
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          {/* Card Admin */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-900/40 border border-slate-800 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] backdrop-blur-2xl hover:border-indigo-500/50 transition-all group relative overflow-hidden min-h-[360px] md:min-h-[420px] flex flex-col"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center mb-6 md:mb-8 text-indigo-500 group-hover:scale-110 transition-transform duration-500">
              <Settings size={28} />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white mb-3 md:mb-4 uppercase tracking-tight">System Admin</h2>
            <p className="text-slate-400 text-[10px] md:text-xs mb-8 md:mb-10 flex-1 font-medium leading-relaxed">
              Manajemen data karyawan, monitoring log historis, perizinan, dan pemeliharaan sistem utama.
            </p>
            <button 
              onClick={() => setShowAdminLogin(true)}
              className="w-full h-12 md:h-14 bg-slate-800/50 group-hover:bg-indigo-600 text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-2 md:gap-3 transition-all border border-slate-700 group-hover:border-indigo-500"
            >
              Portal Admin
              <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* Card Security */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-900/40 border border-slate-800 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] backdrop-blur-2xl hover:border-blue-500/50 transition-all group relative overflow-hidden min-h-[360px] md:min-h-[420px] flex flex-col"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-6 md:mb-8 text-blue-500 group-hover:scale-110 transition-transform duration-500">
              <ShieldAlert size={28} />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white mb-3 md:mb-4 uppercase tracking-tight">Security Officer</h2>
            <p className="text-slate-400 text-[10px] md:text-xs mb-8 md:mb-10 flex-1 font-medium leading-relaxed">
              Operasional gate harian, scanning barcode/QR karyawan & tamu, serta monitoring POB real-time.
            </p>
            <button 
              onClick={() => setShowSecurityLogin(true)}
              className="w-full h-12 md:h-14 bg-slate-800/50 group-hover:bg-blue-600 text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-2 md:gap-3 transition-all border border-slate-700 group-hover:border-blue-500"
            >
              Akses Security
              <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* Card Employee */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-900/40 border border-slate-800 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] backdrop-blur-2xl hover:border-purple-500/50 transition-all group relative overflow-hidden min-h-[360px] md:min-h-[420px] flex flex-col"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 bg-purple-600/10 rounded-2xl flex items-center justify-center mb-6 md:mb-8 text-purple-500 group-hover:scale-110 transition-transform duration-500">
              <User size={28} />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white mb-3 md:mb-4 uppercase tracking-tight">Employee Portal</h2>
            <p className="text-slate-400 text-[10px] md:text-xs mb-8 md:mb-10 flex-1 font-medium leading-relaxed">
              Akses kode identitas digital (QR/Barcode), riwayat kehadiran pribadi, dan informasi operasional.
            </p>
            <button 
              onClick={() => setShowEmployeeLogin(true)}
              className="w-full h-12 md:h-14 bg-slate-800/50 group-hover:bg-purple-600 text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-2 md:gap-3 transition-all border border-slate-700 group-hover:border-purple-500"
            >
              Buka Portal
              <ArrowRight size={16} />
            </button>
          </motion.div>
        </div>
      </div>

      {/* Login Modals */}
      <AnimatePresence>
        {(showSecurityLogin || showAdminLogin || showEmployeeLogin) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetState}
              className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl relative z-10"
            >
              <button onClick={resetState} className="absolute top-8 right-8 text-slate-500 hover:text-white">
                <X size={24} />
              </button>

              {showAdminLogin && (
                <form onSubmit={handleAdminLogin} className="space-y-6">
                  <div className="mb-8">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">Admin Login</h2>
                    <p className="text-slate-400 text-sm mt-2">Otorisasi penuh manajemen sistem.</p>
                  </div>
                  <div className="relative">
                    <Lock size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      autoFocus
                      type="password"
                      placeholder="Admin Master Pass..."
                      className="w-full h-16 bg-slate-950/50 border border-slate-800 rounded-2xl pl-14 pr-4 text-white focus:border-indigo-500 focus:outline-none transition-all font-mono"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest text-center">{error}</p>}
                  <button type="submit" className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Authorize Admin</button>
                </form>
              )}

              {showSecurityLogin && (
                <form onSubmit={handleSecurityLogin} className="space-y-6">
                  <div className="mb-8">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">Security Code</h2>
                    <p className="text-slate-400 text-sm mt-2">Akses terbatas dashboard operasional gate.</p>
                  </div>
                  <div className="relative">
                    <Lock size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      autoFocus
                      type="password"
                      placeholder="Security Pass..."
                      className="w-full h-16 bg-slate-950/50 border border-slate-800 rounded-2xl pl-14 pr-4 text-white focus:border-blue-500 focus:outline-none transition-all font-mono"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest text-center">{error}</p>}
                  <button type="submit" className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 active:scale-95 transition-all">Launch Gate System</button>
                </form>
              )}

              {showEmployeeLogin && (
                <form onSubmit={handleEmployeeLogin} className="space-y-6">
                  <div className="mb-8">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">Employee Portal</h2>
                    <p className="text-slate-400 text-sm mt-2">Identifikasi menggunakan NIK terdaftar.</p>
                  </div>
                  <div className="relative">
                    <KeyRound size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      autoFocus
                      type="text"
                      placeholder="NIK Karyawan..."
                      className="w-full h-16 bg-slate-950/50 border border-slate-800 rounded-2xl pl-14 pr-4 text-white focus:border-purple-500 focus:outline-none transition-all font-mono"
                      value={nik}
                      onChange={(e) => setNik(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest text-center">{error}</p>}
                  <button type="submit" disabled={isLoading} className="w-full h-16 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-purple-600/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Enter Personal Portal'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

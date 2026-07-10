import { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Layers, 
  Activity, 
  TrendingUp, 
  CheckSquare, 
  Square,
  Building2,
  RefreshCw,
  Database,
  BarChart3,
  PieChart as PieIcon,
  HelpCircle
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { motion } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  CATEGORIES_LIST, 
  SHIFTS_LIST, 
  CHART_COLORS, 
  DashboardData,
  generateDynamicMockData,
  getYYYYMMDD
} from '../lib/dashboardMockData';

interface WarehouseDashboardProps {
  onBack: () => void;
}

export default function WarehouseDashboard({ onBack }: WarehouseDashboardProps) {
  // Real-time stats listener from Firestore to synchronize with main page
  const [realStats, setRealStats] = useState<{ pob: number; visitorIn: number }>({ pob: 46, visitorIn: 5 });

  useEffect(() => {
    const today = getYYYYMMDD(new Date());
    const unsubscribe = onSnapshot(doc(db, 'stats', today), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRealStats({
          pob: data.pob || 0,
          visitorIn: data.visitorIn || 0
        });
      }
    }, (error) => {
      console.error("Failed to sync live stats for dashboard:", error);
    });

    return () => unsubscribe();
  }, []);

  // Generate dynamic mock data reactively based on realStats
  const dynamicMockData = useMemo(() => {
    return generateDynamicMockData(realStats);
  }, [realStats]);

  // Default period: last 14 days from today
  const defaultDates = useMemo(() => {
    const todayDate = new Date();
    const end = getYYYYMMDD(todayDate);
    
    const startD = new Date();
    startD.setDate(todayDate.getDate() - 14);
    const start = getYYYYMMDD(startD);
    return { start, end };
  }, []);

  // Filter states
  const [startDate, setStartDate] = useState<string>(defaultDates.start);
  const [endDate, setEndDate] = useState<string>(defaultDates.end);
  
  // Date selection states (initially all dates are selected)
  const initialDates = useMemo(() => dynamicMockData.map(d => d.date), [dynamicMockData]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(initialDates));

  // Automatically select all dates when dynamicMockData changes initially
  useEffect(() => {
    if (dynamicMockData.length > 0) {
      setSelectedDates(new Set(dynamicMockData.map(d => d.date)));
    }
  }, [dynamicMockData]);

  // Auto-filtering the checkbox list based on the date range picker
  const visibleDates = useMemo(() => {
    return dynamicMockData.filter(item => {
      return item.date >= startDate && item.date <= endDate;
    });
  }, [dynamicMockData, startDate, endDate]);

  // Handle checking/unchecking a date
  const toggleDate = (date: string) => {
    const nextSelected = new Set(selectedDates);
    if (nextSelected.has(date)) {
      nextSelected.delete(date);
    } else {
      nextSelected.add(date);
    }
    setSelectedDates(nextSelected);
  };

  const selectAllVisible = () => {
    const nextSelected = new Set(selectedDates);
    visibleDates.forEach(d => nextSelected.add(d.date));
    setSelectedDates(nextSelected);
  };

  const clearAllVisible = () => {
    const nextSelected = new Set(selectedDates);
    visibleDates.forEach(d => nextSelected.delete(d.date));
    setSelectedDates(nextSelected);
  };

  // Filtered dataset based on BOTH date range AND selected checkboxes
  const activeData = useMemo(() => {
    return dynamicMockData.filter(item => {
      const isInRange = item.date >= startDate && item.date <= endDate;
      const isChecked = selectedDates.has(item.date);
      return isInRange && isChecked;
    });
  }, [dynamicMockData, startDate, endDate, selectedDates]);

  // 1. Calculate Grand Total Kehadiran (Accumulative POB headcount for all selected days)
  const grandTotalPOB = useMemo((): number => {
    return activeData.reduce((acc, curr) => {
      const categories = curr.categories as Record<string, number>;
      const dayTotal = Object.keys(categories).reduce((sum, key) => sum + categories[key], 0);
      return acc + dayTotal;
    }, 0);
  }, [activeData]);

  // 2. Calculate POB per Category
  const categoryTotals = useMemo((): Record<string, number> => {
    const totals: Record<string, number> = {};
    CATEGORIES_LIST.forEach(cat => {
      totals[cat] = 0;
    });

    activeData.forEach(day => {
      const categories = day.categories as Record<string, number>;
      Object.keys(categories).forEach(cat => {
        const val = categories[cat];
        if (cat in totals) {
          totals[cat] += val;
        } else {
          totals[cat] = val;
        }
      });
    });

    return totals;
  }, [activeData]);

  // 3. Calculate POB per Shift
  const shiftTotals = useMemo((): Record<string, number> => {
    const totals: Record<string, number> = {};
    SHIFTS_LIST.forEach(shift => {
      totals[shift] = 0;
    });

    activeData.forEach(day => {
      const shifts = day.shifts as Record<string, number>;
      Object.keys(shifts).forEach(shift => {
        const val = shifts[shift];
        if (shift in totals) {
          totals[shift] += val;
        } else {
          totals[shift] = val;
        }
      });
    });

    return totals;
  }, [activeData]);

  // Donut chart formatted data
  const donutChartData = useMemo(() => {
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value: value as number }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categoryTotals]);

  // Bar chart trend formatted data
  const trendChartData = useMemo(() => {
    return activeData.map(day => {
      const categories = day.categories as Record<string, number>;
      const total = Object.keys(categories).reduce((sum, key) => sum + categories[key], 0);
      return {
        dateStr: day.date,
        formattedDate: day.formattedDate.replace(" 2020", ""),
        headcount: total
      };
    });
  }, [activeData]);

  // Suggestions for API endpoints
  const apiSuggestions = [
    {
      method: "GET",
      endpoint: "/api/dashboard/summary",
      desc: "Mengambil total POB, live active hours, & cumulative man-hours secara realtime dari Firestore/database."
    },
    {
      method: "GET",
      endpoint: "/api/dashboard/presence-trend?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD",
      desc: "Mengambil data rekap kehadiran harian (aggregate headcount) berdasarkan rentang tanggal untuk render Bar Chart."
    },
    {
      method: "GET",
      endpoint: "/api/dashboard/pob-categories?dates=date1,date2",
      desc: "Mengambil breakdown jumlah personel POB berdasarkan departemen/kategori untuk tanggal-tanggal yang dipilih."
    },
    {
      method: "GET",
      endpoint: "/api/dashboard/shift-breakdown?dates=date1,date2",
      desc: "Mengambil ringkasan POB per shift kerja (Shift 1, Shift 2, Shift 3, Office) di Warehouse BSD."
    }
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans p-4 md:p-8 relative overflow-hidden">
      {/* Background Cyber Glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px] -z-10" />

      {/* HEADER BAR */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-900/40 border border-slate-800/80 p-6 md:p-8 rounded-[2rem] backdrop-blur-2xl mb-8 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-500" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
          <button 
            onClick={onBack}
            className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white hover:border-cyan-500/50 transition-all active:scale-95 group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform text-cyan-400" />
            Kembali
          </button>
          
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              ELNUSA BSD MONITORING CENTRE
            </div>
            <h1 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight leading-none">
              POB WAREHOUSE MONITORING <span className="text-cyan-400 font-medium">- BSD</span>
            </h1>
          </div>
        </div>

        {/* Date Range Picker & Total Kehadiran Display */}
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          {/* Date range inputs */}
          <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 p-3 rounded-xl w-full sm:w-auto">
            <Calendar className="text-cyan-400 shrink-0" size={16} />
            <div className="flex items-center gap-2 text-xs">
              <input 
                type="date" 
                value={startDate}
                min={dynamicMockData[0]?.date || defaultDates.start}
                max={dynamicMockData[dynamicMockData.length - 1]?.date || defaultDates.end}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-slate-300 focus:outline-none focus:text-cyan-400 uppercase font-mono font-bold shrink-0 cursor-pointer"
              />
              <span className="text-slate-600 font-black">—</span>
              <input 
                type="date" 
                value={endDate}
                min={dynamicMockData[0]?.date || defaultDates.start}
                max={dynamicMockData[dynamicMockData.length - 1]?.date || defaultDates.end}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-slate-300 focus:outline-none focus:text-cyan-400 uppercase font-mono font-bold shrink-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Grand Total POB Block */}
          <div className="bg-gradient-to-br from-slate-900 to-cyan-950/40 border-2 border-cyan-500/30 p-4 rounded-xl flex items-center gap-4 shadow-lg shadow-cyan-950/20 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Activity size={20} className="animate-pulse" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-cyan-400/80 tracking-widest leading-none mb-1">TOTAL KEHADIRAN</p>
              <p className="text-2xl md:text-3xl font-mono font-black text-white leading-none tracking-tight">
                {grandTotalPOB.toLocaleString()} <span className="text-[10px] md:text-xs text-slate-500 font-sans font-bold uppercase">POB</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* DASHBOARD LAYOUT GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* PANEL KIRI: Filters and POB Table */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          
          {/* Tgl Kehadiran Filter Panel */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-[280px]">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-2">
                <Calendar size={14} />
                Tanggal Kehadiran
              </h2>
              <div className="flex gap-2 text-[10px] font-black uppercase tracking-wider">
                <button onClick={selectAllVisible} className="text-cyan-500 hover:text-cyan-400 cursor-pointer">ALL</button>
                <span className="text-slate-700">|</span>
                <button onClick={clearAllVisible} className="text-slate-500 hover:text-white cursor-pointer">NONE</button>
              </div>
            </div>

            {/* Checkbox Scroll List */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-2.5 custom-scrollbar">
              {visibleDates.map(item => {
                const isSelected = selectedDates.has(item.date);
                return (
                  <button
                    key={item.date}
                    onClick={() => toggleDate(item.date)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected 
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-white' 
                        : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isSelected ? (
                        <CheckSquare size={16} className="text-cyan-400" />
                      ) : (
                        <Square size={16} className="text-slate-600" />
                      )}
                      <span className="text-xs font-bold">{item.formattedDate}</span>
                    </div>
                    <span className="font-mono text-[10px] font-bold bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800/60 text-slate-400">
                      {Object.keys(item.categories as Record<string, number>).reduce((s, k) => s + (item.categories as Record<string, number>)[k], 0)}
                    </span>
                  </button>
                );
              })}
              {visibleDates.length === 0 && (
                <div className="h-full flex items-center justify-center text-xs text-slate-600 uppercase font-bold text-center py-12">
                  Tidak ada tanggal dalam range
                </div>
              )}
            </div>
          </div>

          {/* Tabel Personel POB */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col flex-1 shadow-xl">
            <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-4 shrink-0 flex items-center gap-2">
              <Building2 size={14} />
              Personel POB (Breakdown)
            </h2>

            <div className="overflow-y-auto flex-1 max-h-[460px] pr-1 custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/80">
                    <th className="pb-3 font-bold">Kategori Personel</th>
                    <th className="pb-3 text-right font-bold">Total POB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {CATEGORIES_LIST.map((cat, idx) => {
                    const count = categoryTotals[cat] || 0;
                    return (
                      <tr 
                        key={cat} 
                        className="hover:bg-slate-800/20 group transition-colors"
                      >
                        <td className="py-2.5 text-slate-300 group-hover:text-white font-medium flex items-center gap-2">
                          <span 
                            className="w-1.5 h-1.5 rounded-full shrink-0" 
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} 
                          />
                          {cat}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-200 group-hover:text-cyan-400">
                          {count.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-slate-700 bg-slate-950/40 font-black text-white">
                    <td className="py-3 pl-2 uppercase tracking-wider font-black">TOTAL</td>
                    <td className="py-3 text-right pr-2 font-mono text-cyan-400">
                      {grandTotalPOB.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* PANELS TENGAH (ATAS: Mini Map & Pie Chart, BAWAH: Trend Attendance) */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          
          {/* MIDDLE TOP PANEL: Map & Donut Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. BSD Warehouse Mini Map Illustration */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-[350px]">
              <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-3 flex items-center gap-2 shrink-0">
                <MapPin size={14} className="text-red-500" />
                Personel POB - Warehouse BSD
              </h2>

              {/* Custom SVG Blueprint Cyber BSD Map */}
              <div className="flex-1 bg-slate-950 border border-slate-900 rounded-xl relative overflow-hidden flex items-center justify-center p-2 group">
                {/* HUD Tech Lines decoration */}
                <div className="absolute top-2 left-2 text-[9px] font-mono text-slate-500 leading-none">
                  LOC: BSD_CENTRAL_GUDANG_A<br />
                  LAT: 6.3016° S | LON: 106.6536° E
                </div>
                <div className="absolute top-2 right-2 text-[9px] font-mono text-green-500 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded leading-none flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-green-500 animate-ping" />
                  SYS ONLINE
                </div>

                {/* Vector Grid/Roads */}
                <svg className="w-full h-full text-slate-800 opacity-60 pointer-events-none" viewBox="0 0 200 120" fill="none">
                  {/* Grid Lines */}
                  <defs>
                    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1e293b" strokeWidth="0.3" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />

                  {/* Main Roads (BSD Area style) */}
                  <path d="M 10 60 Q 50 40 100 60 T 190 60" stroke="#0f172a" strokeWidth="12" strokeLinecap="round" />
                  <path d="M 10 60 Q 50 40 100 60 T 190 60" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="3 3" />
                  
                  <path d="M 80 10 L 110 110" stroke="#0f172a" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 80 10 L 110 110" stroke="#334155" strokeWidth="1" />

                  {/* Minor Roads / Blocks */}
                  <rect x="25" y="15" width="35" height="20" rx="3" fill="#090d16" stroke="#1e293b" strokeWidth="0.5" />
                  <rect x="135" y="15" width="40" height="25" rx="3" fill="#090d16" stroke="#1e293b" strokeWidth="0.5" />
                  <rect x="35" y="80" width="45" height="25" rx="3" fill="#090d16" stroke="#1e293b" strokeWidth="0.5" />

                  <text x="42" y="27" fill="#475569" fontSize="4" fontWeight="bold" fontFamily="monospace">OFFICE BLOK</text>
                  <text x="142" y="28" fill="#475569" fontSize="4" fontWeight="bold" fontFamily="monospace">ICE BSD SITE</text>
                  <text x="45" y="94" fill="#475569" fontSize="4" fontWeight="bold" fontFamily="monospace">DEPO BSD UTAMA</text>
                </svg>

                {/* ELNUSA BSD Warehouse Pin & HUD Indicator */}
                <div className="absolute top-[48%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  {/* Glowing Radar Pulse Effect */}
                  <div className="absolute w-20 h-20 rounded-full bg-cyan-500/20 border border-cyan-500/40 animate-ping duration-1000 -z-10" />
                  <div className="absolute w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 animate-pulse duration-700 -z-10" />
                  
                  {/* Map Pin */}
                  <div className="relative cursor-pointer transition-transform group-hover:scale-125 duration-300">
                    <MapPin size={28} className="text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] fill-slate-900" />
                    <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-cyan-400" />
                  </div>
                  
                  {/* Glowing Badge */}
                  <div className="mt-2 bg-slate-900/90 border border-cyan-500/50 px-2.5 py-1 rounded-md shadow-2xl backdrop-blur-md">
                    <p className="text-[8px] font-black uppercase text-cyan-400 tracking-wider whitespace-nowrap">ELNUSA BSD WAREHOUSE</p>
                    <p className="text-[7px] font-mono text-slate-400 text-center uppercase tracking-widest mt-0.5">BSD CITY SECTOR XI</p>
                  </div>
                </div>

                {/* Bottom HUD Compass */}
                <div className="absolute bottom-2 left-2 text-[8px] font-mono text-slate-500 uppercase flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded border border-slate-900">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  GATE SCAN LIVE (POB ACTIVE)
                </div>
              </div>
            </div>

            {/* 2. Donut Pie Chart: POB by Personnel */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-[350px]">
              <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-2 flex items-center gap-2 shrink-0">
                <PieIcon size={14} />
                Total POB by Personel (%)
              </h2>

              <div className="flex-1 flex items-center justify-center min-h-0 relative">
                {donutChartData.length === 0 ? (
                  <div className="text-xs text-slate-500 font-bold uppercase text-center">
                    Tidak ada data terpilih
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {donutChartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={CHART_COLORS[CATEGORIES_LIST.indexOf(entry.name) % CHART_COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ 
                            backgroundColor: '#0f172a', 
                            border: '1px solid rgba(51, 65, 85, 0.8)',
                            borderRadius: '12px'
                          }}
                          labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                          itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                          formatter={(value: any, name: any) => [
                            `${value.toLocaleString()} POB (${((value / grandTotalPOB) * 100).toFixed(2)}%)`, 
                            name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Inner Stats overlay */}
                    <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest">KATEGORI</span>
                      <span className="text-white text-2xl font-mono font-black">{donutChartData.length}</span>
                      <span className="text-cyan-400 text-[8px] font-bold uppercase tracking-widest mt-0.5">TERDETEKSI</span>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* MIDDLE BOTTOM PANEL: Bar Chart - Trend Kehadiran */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl h-[330px] flex flex-col shadow-2xl">
            <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-4 flex items-center gap-2 shrink-0">
              <TrendingUp size={14} />
              Trend Kehadiran (Headcount Harian)
            </h2>

            <div className="flex-1 min-h-0">
              {trendChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 font-bold uppercase">
                  Tidak ada data untuk dirender
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={trendChartData}
                    margin={{ top: 15, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="formattedDate" 
                      stroke="#475569" 
                      fontSize={10}
                      fontWeight="bold"
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={10} 
                      fontWeight="bold"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(34, 211, 238, 0.05)' }}
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        border: '1px solid rgba(51, 65, 85, 0.8)',
                        borderRadius: '12px'
                      }}
                      itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
                      formatter={(value: any) => [`${value} Orang`, 'Total POB']}
                    />
                    <Bar 
                      dataKey="headcount" 
                      fill="url(#trendGlow)" 
                      radius={[6, 6, 0, 0]}
                      maxBarSize={45}
                      label={{ 
                        position: 'top', 
                        fill: '#e2e8f0', 
                        fontSize: 9, 
                        fontWeight: 'bold',
                        fontFamily: 'monospace'
                      }}
                    >
                      {/* Gradient Definitions */}
                      <defs>
                        <linearGradient id="trendGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#0891b2" stopOpacity={0.15} />
                        </linearGradient>
                      </defs>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        {/* PANEL KANAN: Shift Breakdown & API Suggestions */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          
          {/* Shift Breakdown Panel */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-[350px] shadow-2xl">
            <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-4 flex items-center gap-2 shrink-0">
              <Clock size={14} />
              Total POB by Shift / Divisi
            </h2>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {SHIFTS_LIST.map((shift, idx) => {
                const count = shiftTotals[shift] || 0;
                const pct = grandTotalPOB > 0 ? (count / grandTotalPOB) * 100 : 0;
                
                // Color variation for shifts
                const barColors = ["from-cyan-500 to-cyan-600", "from-indigo-500 to-indigo-600", "from-emerald-500 to-emerald-600", "from-purple-500 to-purple-600"];
                const barColor = barColors[idx % barColors.length];

                return (
                  <div key={shift} className="space-y-1.5 group">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-bold group-hover:text-white transition-colors">{shift}</span>
                      <span className="font-mono font-bold text-slate-400 group-hover:text-cyan-400">
                        {count.toLocaleString()} <span className="text-[10px] text-slate-500">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    
                    {/* Visual glowing bar */}
                    <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-900 p-0.5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full bg-gradient-to-r ${barColor} rounded-full relative overflow-hidden`}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                      </motion.div>
                    </div>
                  </div>
                );
              })}
              
              {grandTotalPOB === 0 && (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 font-bold uppercase">
                  Tidak ada data aktif
                </div>
              )}
            </div>
            
            {/* Legend / Info Footer */}
            <div className="pt-3 border-t border-slate-800/80 mt-2 shrink-0 text-[10px] text-slate-500 flex items-center gap-2">
              <HelpCircle size={12} className="text-cyan-500" />
              <span>Shift terdistribusi merata sesuai shift roster aktif.</span>
            </div>
          </div>

          {/* API Suggestions / Developer Documentation Panel */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col flex-1 shadow-2xl relative overflow-hidden">
            {/* Accent Corner Decor */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/5 rotate-45 transform origin-top-right" />
            
            <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-3 flex items-center gap-2 shrink-0">
              <Database size={14} className="text-cyan-500" />
              Panduan Integrasi API Asli
            </h2>
            
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              Untuk mengganti data mock di atas dengan database realtime, gunakan endpoint-endpoint Express/Next.js API berikut:
            </p>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar">
              {apiSuggestions.map((api, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800/60 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[8px] font-mono font-black bg-cyan-500/10 text-cyan-400 border border-cyan-400/20 px-1.5 py-0.5 rounded">
                      {api.method}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-200 select-all truncate max-w-full">
                      {api.endpoint}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-snug">
                    {api.desc}
                  </p>
                </div>
              ))}
            </div>
            
            <div className="pt-3 border-t border-slate-800/60 mt-3 shrink-0 flex items-center justify-between text-[9px] font-mono text-slate-600">
              <span>STACK: EXPRESS + FIRESTORE</span>
              <span>VER: 2.1.0</span>
            </div>
          </div>

        </div>

      </div>

      {/* Footer copyright */}
      <footer className="mt-10 text-center opacity-35 pb-6 flex flex-col gap-1">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
          Warehouse ELNUSA BSD Monitoring Dashboard Center • 2026
        </p>
        <p className="text-[8px] font-black uppercase tracking-[0.25em] text-slate-600">
          System by Pratama Raharja
        </p>
      </footer>
    </div>
  );
}

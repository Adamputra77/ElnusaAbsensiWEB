import { useState, useMemo, useEffect, useRef } from 'react';
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
  HelpCircle,
  Navigation,
  ExternalLink,
  AlertCircle,
  Moon,
  Info
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { motion } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  CHART_COLORS, 
  getYYYYMMDD,
  getFormattedDate
} from '../lib/dashboardMockData';
import { 
  fetchDashboardData, 
  DashboardDataResult, 
  DailyAggregate,
  SHIFT_CONFIG
} from '../lib/dashboardRealData';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon for react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface WarehouseDashboardProps {
  onBack: () => void;
}

const defaultMarkerIcon = new (L as any).Icon.Default();

function GoogleMapsButton({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=ChIJF85UPOLkaS4RQVPWcte1yQU`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/30 active:scale-95"
    >
      <ExternalLink size={12} />
      Buka di Google Maps
    </a>
  );
}

function MapAttributionControl() {
  useMapEvents({
    click(e: any) {
      console.log('Map clicked:', e.latlng);
    }
  });
  return null;
}

function LeafletMap({ 
  center, 
  zoom = 16, 
  pob = 0, 
  label = "Warehouse Elnusa BSD",
  address = "Jl. Tekno Widya No.21, Setu, Tangerang Selatan"
}: { 
  center: [number, number]; 
  zoom?: number; 
  pob: number; 
  label: string;
  address: string;
}) {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-800/50 bg-slate-950">
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={true}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />
        <Marker position={center} icon={defaultMarkerIcon}>
          <Popup 
            className="leaflet-popup-dark"
            offset={[0, -20]}
            autoClose={false}
            closeOnClick={false}
          >
            <div className="min-w-[220px] p-2 text-center">
              <p className="font-black text-white text-sm mb-1">{label}</p>
              <p className="text-[11px] text-slate-400 mb-2">{"Jl. Tekno Widya No.21, Setu, Tangerang Selatan"}</p>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                <span className="text-[11px] font-bold text-green-400">SYS ONLINE</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3 mb-2 border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">POB AKTIF</p>
                <p className="text-2xl font-mono font-black text-cyan-400">{pob}</p>
              </div>
              <GoogleMapsButton 
                lat={-6.3006} 
                lng={106.6578} 
                label="Warehouse Elnusa BSD"
              />
            </div>
          </Popup>
        </Marker>
        <MapAttributionControl />
      </MapContainer>
      <div className="absolute bottom-2 right-2 z-10 bg-slate-950/90 backdrop-blur-sm rounded-xl p-2 border border-slate-800/50 text-[10px] font-mono text-slate-400">
        📍 Warehouse Elnusa BSD
      </div>
    </div>
  );
}

export default function WarehouseDashboard({ onBack }: WarehouseDashboardProps) {
  // Default period: last 14 days from today
  const defaultDates = useMemo(() => {
    const todayDate = new Date();
    const end = getYYYYMMDD(todayDate);
    
    const startD = new Date();
    startD.setDate(todayDate.getDate() - 14);
    const start = getYYYYMMDD(startD);
    return { start, end };
  }, []);

  // Data states
  const [dashboardData, setDashboardData] = useState<DashboardDataResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [startDate, setStartDate] = useState<string>(defaultDates.start);
  const [endDate, setEndDate] = useState<string>(defaultDates.end);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // Live stats
  const [realStats, setRealStats] = useState<{ pob: number; visitorIn: number }>({ pob: 0, visitorIn: 0 });
  
  // Map center - resolve exact coords at runtime
  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.3006, 106.6578]);

  // Resolve map center from Google share link at runtime
  useEffect(() => {
    const resolveCoords = async () => {
      try {
        const response = await fetch('https://share.google/j8cp3jGUWSXBEHAmM', { 
          method: 'HEAD',
          redirect: 'follow'
        });
        const finalUrl = response.url;
        // Extract lat,lng from Google Maps URL
        const match = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          setMapCenter([lat, lng]);
          console.log('Resolved map center:', lat, lng);
        }
      } catch (e) {
        console.log('Could not resolve exact coords, using fallback');
      }
    };
    resolveCoords();
  }, []);

  // Real-time stats listener
  useEffect(() => {
    const today = getYYYYMMDD(new Date());
    const unsubscribe = onSnapshot(doc(db, 'stats', today), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRealStats({
          pob: Math.max(0, data.pob || 0),
          visitorIn: data.visitorIn || 0
        });
      }
    }, (error) => {
      console.error("Failed to sync live stats for dashboard:", error);
    });
    return () => unsubscribe();
  }, []);

  // Fetch dashboard data
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardData(startDate, endDate);
      setDashboardData(data);
      
      // Auto-select all dates in range on first load
      const allDates = data.dailyData.map(d => d.date);
      setSelectedDates(new Set(allDates));
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Gagal memuat data dashboard. Coba refresh halaman.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  // Filter visible dates in range
  const visibleDates = useMemo(() => {
    if (!dashboardData) return [];
    return dashboardData.dailyData.filter(item => 
      item.date >= startDate && item.date <= endDate
    );
  }, [dashboardData, startDate, endDate]);

  // Handle date selection
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

  // Filtered data based on date range AND checkboxes
  const activeData = useMemo(() => {
    if (!dashboardData) return [];
    return dashboardData.dailyData.filter(item => {
      const isInRange = item.date >= startDate && item.date <= endDate;
      const isChecked = selectedDates.has(item.date);
      return isInRange && isChecked;
    });
  }, [dashboardData, startDate, endDate, selectedDates]);

  // Grand total unique IN across selected days
  const grandTotalIn = useMemo((): number => {
    return activeData.reduce((acc, curr) => acc + curr.uniqueIn, 0);
  }, [activeData]);

  // Aggregated department totals across selected days
  const departmentTotals = useMemo((): Record<string, number> => {
    const totals: Record<string, number> = {};
    for (const day of activeData) {
      const deptEntries = Object.entries(day.byDepartment) as [string, number][];
      for (const [dept, count] of deptEntries) {
        totals[dept] = (totals[dept] || 0) + count;
      }
    }
    return totals;
  }, [activeData]);

  // Aggregated shift totals across selected days
  const shiftTotals = useMemo((): Record<string, number> => {
    const totals: Record<string, number> = {};
    for (const day of activeData) {
      const shiftEntries = Object.entries(day.byShift) as [string, number][];
      for (const [shift, count] of shiftEntries) {
        totals[shift] = (totals[shift] || 0) + count;
      }
    }
    return totals;
  }, [activeData]);

  // Donut chart data - top 9 departments + Others
  const donutChartData = useMemo(() => {
    const entries = (Object.entries(departmentTotals) as [string, number][])
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
    
    const top9 = entries.slice(0, 9);
    const othersValue = entries.slice(9).reduce((sum, e) => sum + e.value, 0);
    
    if (othersValue > 0) {
      return [...top9, { name: 'Lainnya', value: othersValue }];
    }
    return top9;
  }, [departmentTotals]);

  // Bar chart trend data
  const trendChartData = useMemo(() => {
    return activeData.map(day => ({
      dateStr: day.date,
      formattedDate: day.formattedDate.replace(" 2020", ""),
      headcount: day.uniqueIn
    }));
  }, [activeData]);

  // Shift totals for chart - reorder for consistent display
  const shiftOrder = ['Office', 'Security Pagi', 'Security Malam'];
  const orderedShiftTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const shift of shiftOrder) {
      totals[shift] = (shiftTotals[shift] as number) || 0;
    }
    return totals;
  }, [shiftTotals]);

  const handleRefresh = () => {
    fetchData();
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans p-4 md:p-8 relative overflow-hidden">
      {/* Background Cyber Glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px] -z-10" />

      {/* HEADER BAR */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-900/40 border border-slate-800/80 p-6 md:p-8 rounded-[2rem] backdrop-blur-2xl mb-8 shadow-2xl relative overflow-hidden">
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
            <Calendar className="text-cyan-400 shrink-0 hidden xs:block" size={16} />
            <div className="flex items-center gap-1 sm:gap-2 text-xs">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-slate-300 focus:outline-none focus:text-cyan-400 uppercase font-mono font-bold w-[100px] sm:w-auto cursor-pointer"
              />
              <span className="text-slate-600 font-black">—</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-slate-300 focus:outline-none focus:text-cyan-400 uppercase font-mono font-bold w-[100px] sm:w-auto cursor-pointer"
              />
            </div>
          </div>

          {/* Grand Total IN Block */}
          <div className="bg-gradient-to-br from-slate-900 to-cyan-950/40 border-2 border-cyan-500/30 p-4 rounded-xl flex items-center gap-4 shadow-lg shadow-cyan-950/20 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Activity size={20} className="animate-pulse" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-cyan-400/80 tracking-widest leading-none mb-1">TOTAL MASUK (UNIK)</p>
              <p className="text-2xl md:text-3xl font-mono font-black text-white leading-none tracking-tight">
                {grandTotalIn.toLocaleString()} <span className="text-[10px] md:text-xs text-slate-500 font-sans font-bold uppercase">ORANG</span>
              </p>
            </div>
          </div>
          
          {/* Refresh Button */}
          <button 
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 md:px-5 py-2.5 md:py-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-400 rounded-xl font-semibold transition-all disabled:opacity-50 text-[10px] md:text-sm active:scale-95"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* DASHBOARD LAYOUT GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* PANEL KIRI: Filters and Department POB Table */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          
          {/* Tgl Kehadiran Filter Panel */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-[200px] lg:h-[280px]">
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
                      {item.uniqueIn}
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

          {/* Tabel Personel POB (by Department) */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col flex-1 shadow-xl">
            <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-4 shrink-0 flex items-center gap-2">
              <Building2 size={14} />
              Personel POB (Breakdown Departemen)
            </h2>

            <div className="overflow-y-auto flex-1 max-h-[240px] lg:max-h-[460px] pr-1 custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/80">
                    <th className="pb-3 font-bold">Departemen</th>
                    <th className="pb-3 text-right font-bold">Total Masuk (Unik)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {Object.entries(departmentTotals as Record<string, number>)
                    .sort(([,a], [,b]) => (b as number) - (a as number))
                    .map(([dept, count], idx) => (
                      <tr 
                        key={dept} 
                        className="hover:bg-slate-800/20 group transition-colors"
                      >
                        <td className="py-2.5 text-slate-300 group-hover:text-white font-medium flex items-center gap-2">
                          <span 
                            className="w-1.5 h-1.5 rounded-full shrink-0" 
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} 
                          />
                          {dept}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-200 group-hover:text-cyan-400">
                          {count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  <tr className="border-t-2 border-slate-700 bg-slate-950/40 font-black text-white">
                    <td className="py-3 pl-2 uppercase tracking-wider font-black">TOTAL MASUK UNIK</td>
                    <td className="py-3 text-right pr-2 font-mono text-cyan-400">
                      {grandTotalIn.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* PANELS TENGAH (ATAS: Real Map & Donut Pie Chart, BAWAH: Trend Attendance) */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          
          {/* MIDDLE TOP PANEL: Real Map & Donut Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. Real Interactive Map */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-[350px] lg:h-[400px]">
              <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-3 flex items-center gap-2 shrink-0">
                <MapPin size={14} className="text-red-500" />
                Lokasi Warehouse Elnusa BSD
              </h2>

              <div className="flex-1 relative">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <Activity size={32} className="animate-spin text-cyan-500" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Memuat peta...</p>
                    </div>
                  </div>
                )}
                <LeafletMap 
                  center={mapCenter} 
                  zoom={16} 
                  pob={realStats.pob}
                  label="Warehouse Elnusa BSD"
                  address="Jl. Tekno Widya No.21, Setu, Tangerang Selatan"
                />
              </div>
            </div>

            {/* 2. Donut Pie Chart: POB by Department */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-[350px] lg:h-[400px]">
              <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-2 flex items-center gap-2 shrink-0">
                <PieIcon size={14} />
                Total Masuk by Departemen (%)
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
                              fill={CHART_COLORS[index % CHART_COLORS.length]} 
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
                            `${value.toLocaleString()} Masuk (${((value / grandTotalIn) * 100).toFixed(1)}%)`, 
                            name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Inner Stats overlay */}
                    <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest">DEPARTEMEN</span>
                      <span className="text-white text-2xl font-mono font-black">{donutChartData.length}</span>
                      <span className="text-cyan-400 text-[8px] font-bold uppercase tracking-widest mt-0.5">TERDETEKSI</span>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* MIDDLE BOTTOM PANEL: Bar Chart - Trend Kehadiran */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl h-[300px] lg:h-[350px] flex flex-col shadow-2xl">
            <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-4 flex items-center gap-2 shrink-0">
              <TrendingUp size={14} />
              Trend Kehadiran Harian (Masuk Unik)
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
                      formatter={(value: any) => [`${value} Orang`, 'Masuk Unik']}
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

        {/* PANEL KANAN: POB by Kelompok & Real-time Summary */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          
          {/* POB by Kelompok/Shift Panel */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-[300px] lg:h-[380px] shadow-2xl">
            <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-4 flex items-center gap-2 shrink-0">
              <Layers size={14} />
              POB by Kelompok / Shift
            </h2>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {Object.entries(orderedShiftTotals as Record<string, number>).map(([shift, count]) => {
                const pct = grandTotalIn > 0 ? (count / grandTotalIn) * 100 : 0;
                
                const barColors = {
                  'Office': "from-cyan-500 to-cyan-600",
                  'Security Pagi': "from-emerald-500 to-emerald-600",
                  'Security Malam': "from-purple-500 to-purple-600",
                };
                const barColor = barColors[shift as keyof typeof barColors] || "from-cyan-500 to-cyan-600";
                
                const icons = {
                  'Office': <Building2 size={14} className="text-cyan-400" />,
                  'Security Pagi': <Activity size={14} className="text-emerald-400" />,
                  'Security Malam': <Moon size={14} className="text-purple-400" />,
                };

                return (
                  <div key={shift} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-300 font-bold group-hover:text-white transition-colors">
                        {icons[shift as keyof typeof icons] || <Layers size={14} className="text-cyan-400" />}
                        {shift}
                      </span>
                      <span className="font-mono font-bold text-slate-400 group-hover:text-cyan-400">
                        {count.toLocaleString()} <span className="text-[10px] text-slate-500">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    
                    <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-900 p-0.5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full bg-gradient-to-r ${barColors[shift as keyof typeof barColors] || "from-cyan-500 to-cyan-600"} rounded-full relative overflow-hidden`}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                      </motion.div>
                    </div>
                  </div>
                );
              })}
              
              {grandTotalIn === 0 && (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 font-bold uppercase">
                  Tidak ada data aktif
                </div>
              )}
            </div>
            
            {/* Legend / Info Footer */}
            <div className="pt-3 border-t border-slate-800/80 mt-2 shrink-0 text-[10px] text-slate-500 flex items-center gap-2">
              <Info size={12} className="text-cyan-500" />
              <span>Shift otomatis dari jam scan: Office 06-10 | Security Pagi 07-15 | Security Malam 16-06</span>
            </div>
          </div>

          {/* Real-time Summary Panel (replaces API suggestions) */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex flex-col flex-1 shadow-2xl relative overflow-hidden">
            <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-4 flex items-center gap-2 shrink-0">
              <Activity size={14} className="text-cyan-500" />
              Ringkasan Real-time Hari Ini
            </h2>
            
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/60 border border-slate-800/60 p-4 rounded-xl">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">POB SAAT INI</p>
                  <p className="text-3xl font-mono font-black text-cyan-400">{realStats.pob}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 p-4 rounded-xl">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">MASUK HARI INI</p>
                  <p className="text-3xl font-mono font-black text-green-400">{dashboardData?.todayStats.masuk ?? 0}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 p-4 rounded-xl">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">KELUAR HARI INI</p>
                  <p className="text-3xl font-mono font-black text-red-400">{dashboardData?.todayStats.keluar ?? 0}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 p-4 rounded-xl">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">VISITOR DI DALAM</p>
                  <p className="text-3xl font-mono font-black text-orange-400">{realStats.visitorIn}</p>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">MAN HOURS</p>
                  <span className="text-[10px] font-mono text-cyan-400">Kumulatif + Live</span>
                </div>
                <p className="text-4xl font-mono font-black text-white">
                  {dashboardData?.warehouseStats.totalManHours.toFixed(1) || 0} <span className="text-lg font-sans font-bold text-slate-500 ml-2">HRS</span>
                </p>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Selesai: {dashboardData?.warehouseStats.completedManHours.toFixed(1) || 0} hrs
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    Aktif: {dashboardData?.warehouseStats.activeManHours.toFixed(1) || 0} hrs
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">INFO SISTEM</p>
                <div className="space-y-1 text-[10px] text-slate-400">
                  <p>Range data: {dashboardData?.selectedDateRange.start} – {dashboardData?.selectedDateRange.end}</p>
                  <p>Tanggal dipilih: {selectedDates.size} hari</p>
                  <p className="text-cyan-400">Shift: Office (06-10) | Sec Pagi (07-15) | Sec Malam (16-06)</p>
                </div>
              </div>
            </div>
            
            <div className="pt-3 border-t border-slate-800/60 mt-3 shrink-0 flex items-center justify-between text-[9px] font-mono text-slate-600">
              <span>DATA: FIRESTORE REALTIME</span>
              <span>VER: 3.0.0</span>
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
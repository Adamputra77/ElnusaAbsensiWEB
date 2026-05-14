import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  Timestamp,
  writeBatch,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  addDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { PresenceLog, Employee, PresenceType } from '../types';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { 
  Filter, 
  Download, 
  RefreshCw, 
  Lock, 
  LogIn,
  LogOut,
  ChevronRight,
  Database,
  Search,
  Edit2,
  Trash2,
  Barcode as BarcodeIcon,
  Printer,
  X,
  Hammer,
  AlertTriangle
} from 'lucide-react';
import { SEED_EMPLOYEES } from '../seedData';

import { UserRole } from '../types';

interface AdminDashboardProps {
  userRole?: UserRole | null;
}

export default function AdminDashboard({ userRole }: AdminDashboardProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDept, setSelectedDept] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showAddModal, setShowAddModal] = useState<'EMPLOYEE' | 'VISITOR' | null>(null);
  const [newPerson, setNewPerson] = useState({ id: '', name: '', department: '', nik: '' });

  const [activeTab, setActiveTab] = useState<'LOGS' | 'EMPLOYEES'>('LOGS');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [editingPerson, setEditingPerson] = useState<Employee | null>(null);
  const [barcodePerson, setBarcodePerson] = useState<Employee | null>(null);
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsLoading(true);
    
    // 1. Employee Listener
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      const empData: Record<string, Employee> = {};
      snap.forEach(d => {
        empData[d.id] = { id: d.id, ...d.data() } as Employee;
      });
      setEmployees(empData);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'employees');
      setIsLoading(false);
    });

    // 2. Logs Listener
    const logsRef = collection(db, 'presence_logs');
    const qLogs = query(
      logsRef, 
      where('date', '==', selectedDate)
    );
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const logList = snap.docs
        .map(d => ({ 
          id: d.id, 
          ...d.data(),
          timestamp: (d.data().timestamp as Timestamp)?.toDate()
        }))
        .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0)); // Descending
      setLogs(logList);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'presence_logs');
    });

    return () => {
      unsubEmployees();
      unsubLogs();
    };
  }, [selectedDate, selectedDept]);

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPerson.id || !newPerson.name) {
      alert("ID dan Nama wajib diisi");
      return;
    }

    try {
      const docRef = doc(db, 'employees', newPerson.id);
      await setDoc(docRef, {
        ...newPerson,
        nik: newPerson.nik || newPerson.id, // Fallback to id if nik not provided
        isVisitor: showAddModal === 'VISITOR',
        createdAt: Timestamp.now()
      });
      
      alert(`${showAddModal === 'VISITOR' ? 'Visitor' : 'Employee'} berhasil ditambahkan!`);
      setShowAddModal(null);
      setNewPerson({ id: '', name: '', department: '', nik: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'employees');
      alert("Gagal menambahkan data: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleUpdatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;

    try {
      const docRef = doc(db, 'employees', editingPerson.id);
      await setDoc(docRef, {
        ...editingPerson,
        updatedAt: Timestamp.now()
      }, { merge: true });
      
      alert(`Data berhasil diperbarui!`);
      setEditingPerson(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'employees');
      alert("Gagal memperbarui data: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeletePerson = async (id: string, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      const docRef = doc(db, 'employees', id);
      await deleteDoc(docRef);
      alert(`Data "${name}" berhasil dihapus.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'employees');
      alert("Gagal menghapus data: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handlePrintBarcode = () => {
    const printContent = document.getElementById('barcode-to-print');
    if (!printContent) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;

    printWindow.document.write('<html><head><title>Print Attendance Code</title>');
    printWindow.document.write('<style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;} .code-container{display:flex;flex-direction:column;align-items:center;gap:20px;} @media print {.no-print{display:none;}}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write('<script>window.onload = function() { window.print(); window.close(); }</script>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
  };

  const filteredPersonnelList = React.useMemo(() => {
    return (Object.values(employees) as Employee[])
      .filter(emp => 
        emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) || 
        emp.id.toLowerCase().includes(employeeSearch.toLowerCase())
      );
  }, [employees, employeeSearch]);

  const handlePrintAllBarcodes = () => {
    if (selectedPersonnel.size === 0) {
      alert("Pilih minimal satu karyawan untuk dicetak barcodenya.");
      return;
    }
    // Briefly delay to ensure any state updates for the print container are flushed
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const toggleSelectAll = () => {
    if (selectedPersonnel.size === filteredPersonnelList.length) {
      setSelectedPersonnel(new Set());
    } else {
      setSelectedPersonnel(new Set(filteredPersonnelList.map(e => e.id)));
    }
  };

  const toggleSelectPerson = (id: string) => {
    const next = new Set(selectedPersonnel);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPersonnel(next);
  };

  const [seedStep, setSeedStep] = useState<'idle' | 'confirming' | 'seeding' | 'success'>('idle');
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isRefreshingMaintenance, setIsRefreshingMaintenance] = useState(false);

  useEffect(() => {
    // Listen to maintenance mode for admin toggle state
    const unsub = onSnapshot(doc(db, 'system_config', 'main'), (doc) => {
      if (doc.exists()) {
        setIsMaintenanceMode(!!doc.data().maintenanceMode);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system_config/main');
    });
    return () => unsub();
  }, []);

  const toggleMaintenance = async () => {
    setIsRefreshingMaintenance(true);
    try {
      const configRef = doc(db, 'system_config', 'main');
      await setDoc(configRef, {
        maintenanceMode: !isMaintenanceMode,
        updatedAt: serverTimestamp(),
        message: 'Sistem sedang dalam pemeliharaan rutin. Mohon tunggu beberapa saat.'
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'system_config/main');
    } finally {
      setIsRefreshingMaintenance(false);
    }
  };

  const handleSeed = async () => {
    if (seedStep === 'idle') {
      setSeedStep('confirming');
      return;
    }
    
    if (seedStep === 'confirming') {
      setSeedStep('seeding');
      setIsSeeding(true);
      try {
        console.log("Starting seeding process...");
        const batch = writeBatch(db);
        
        // Use a for loop for better control if needed, but batch is fine for 90 records
        SEED_EMPLOYEES.forEach(emp => {
          const docRef = doc(db, 'employees', emp.id);
          batch.set(docRef, {
            ...emp,
            createdAt: Timestamp.now()
          });
        });
        
        await batch.commit();
        console.log("Seeding committed successfully.");
        setSeedStep('success');
        setTimeout(() => setSeedStep('idle'), 3000);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'employees (seeding)');
        setSeedStep('idle');
        alert('Gagal melakukan seed: ' + (err instanceof Error ? err.message : String(err)));
      }
      setIsSeeding(false);
    }
  };

  const handleExport = () => {
    const doc = new jsPDF();
    
    // Add header
    doc.setFontSize(22);
    doc.setTextColor(2, 6, 23); // Slate 950
    doc.text('Laporan Kehadiran Warehouse', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Warehouse ELNUSA BSD - ${format(new Date(selectedDate), 'dd MMMM yyyy')}`, 14, 28);
    doc.text(`Departemen: ${selectedDept}`, 14, 34);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 14, 40);

    const tableData = filteredLogs.map(log => [
      employees[log.employeeId]?.name || 'Unknown',
      log.employeeId,
      employees[log.employeeId]?.department || 'N/A',
      log.timestamp ? format(log.timestamp, 'HH:mm:ss') : 'N/A',
      log.type
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['Nama Karyawan', 'NIK/ID', 'Departemen', 'Waktu', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [37, 99, 235], // Blue 600
        textColor: 255, 
        fontSize: 10, 
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 4
      },
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.cell.section === 'body') {
          if (data.cell.raw === 'IN') {
            data.cell.styles.textColor = [22, 163, 74]; // Green 600
          } else {
            data.cell.styles.textColor = [220, 38, 38]; // Red 600
          }
        }
      }
    });

    doc.save(`Warehouse_Attendance_${selectedDate}.pdf`);
  };

  const filteredLogs = logs.filter(log => {
    const emp = employees[log.employeeId];
    if (selectedDept !== 'All' && emp?.department !== selectedDept) return false;
    return true;
  });

  const departments = ['All', ...new Set(Object.values(employees).map((e: Employee) => e.department))];

  // Logic for IN and OUT status
  const currentStates: Record<string, PresenceType> = {};
  logs.slice().reverse().forEach(log => {
    currentStates[log.employeeId] = log.type;
  });

  const inList = Object.keys(employees).filter(id => currentStates[id] === PresenceType.IN);
  const outList = Object.keys(employees).filter(id => currentStates[id] === PresenceType.OUT);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-4 md:p-10 font-sans">
      <div id="main-layout-container" className="no-print">
        {/* Modal Add Person */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(null)}
              className="absolute inset-0 bg-[#020617]/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md relative z-10"
            >
              <h2 className="text-2xl font-bold text-white mb-6 uppercase tracking-tight">
                Register {showAddModal === 'VISITOR' ? 'New Visitor' : 'New Employee'}
              </h2>
              <form onSubmit={handleAddPerson} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    {showAddModal === 'VISITOR' ? 'ID Card / KTP Number' : 'NIK (Nomor Induk Karyawan)'}
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Enter NIK..."
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none transition-all"
                    value={newPerson.nik}
                    onChange={(e) => setNewPerson({...newPerson, nik: e.target.value, id: newPerson.id || e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    Internal System ID (Auto-fills from NIK)
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Enter ID..."
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none transition-all"
                    value={newPerson.id}
                    onChange={(e) => setNewPerson({...newPerson, id: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                  <input
                    required
                    type="text"
                    placeholder="Enter name..."
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none transition-all"
                    value={newPerson.name}
                    onChange={(e) => setNewPerson({...newPerson, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Department / Purpose</label>
                  <input
                    type="text"
                    placeholder={showAddModal === 'VISITOR' ? 'e.g. Kurir / Meeting' : 'e.g. IT Support'}
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none transition-all"
                    value={newPerson.department}
                    onChange={(e) => setNewPerson({...newPerson, department: e.target.value})}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(null)}
                    className="flex-1 h-12 bg-slate-800 text-slate-300 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] h-12 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
                  >
                    Save Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Edit Person */}
      <AnimatePresence>
        {editingPerson && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPerson(null)}
              className="absolute inset-0 bg-[#020617]/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md relative z-10"
            >
              <h2 className="text-2xl font-bold text-white mb-6 uppercase tracking-tight">
                Edit Data {(editingPerson as any).isVisitor ? 'Visitor' : 'Karyawan'}
              </h2>
              <form onSubmit={handleUpdatePerson} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">NIK (Nomor Induk Karyawan)</label>
                  <input
                    required
                    type="text"
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none transition-all"
                    value={editingPerson.nik || editingPerson.id}
                    onChange={(e) => setEditingPerson({...editingPerson, nik: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">System ID (Immutable)</label>
                  <input
                    disabled
                    type="text"
                    className="w-full h-12 px-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed transition-all opacity-50"
                    value={editingPerson.id}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                  <input
                    required
                    type="text"
                    placeholder="Enter name..."
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none transition-all"
                    value={editingPerson.name}
                    onChange={(e) => setEditingPerson({...editingPerson, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Department / Purpose</label>
                  <input
                    type="text"
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none transition-all"
                    value={editingPerson.department}
                    onChange={(e) => setEditingPerson({...editingPerson, department: e.target.value})}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingPerson(null)}
                    className="flex-1 h-12 bg-slate-800 text-slate-300 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] h-12 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
                  >
                    Update Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Barcode Modal */}
      <AnimatePresence>
        {barcodePerson && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBarcodePerson(null)}
              className="absolute inset-0 bg-[#020617]/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white border border-slate-200 p-8 md:p-12 rounded-[3rem] shadow-2xl w-full max-w-md relative z-10 text-slate-900 overflow-hidden"
            >
              <button 
                onClick={() => setBarcodePerson(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>

              <div id="barcode-to-print" className="flex flex-col items-center">
                <div className="mb-8 text-center">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white mb-4 mx-auto shadow-lg shadow-blue-600/20">E</div>
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-1 leading-none">Warehouse ELNUSA BSD</h3>
                  <p className="text-[10px] uppercase font-bold text-slate-300 tracking-widest">Attendance Identity Pass</p>
                </div>

                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 mb-8 w-full flex flex-col items-center shadow-inner gap-8">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                    <QRCode 
                      value={barcodePerson.nik || barcodePerson.id} 
                      size={160}
                      level="H"
                    />
                  </div>
                  
                  <div className="flex flex-col items-center gap-4">
                    <Barcode 
                      value={barcodePerson.nik || barcodePerson.id} 
                      width={1.8}
                      height={50}
                      fontSize={14}
                      background="#f8fafc"
                    />
                    <div className="text-center mt-2">
                      <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-tight mb-1">{barcodePerson.name}</h2>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{barcodePerson.department}</p>
                      <p className="text-[10px] font-mono font-bold text-slate-400 mt-2">NIK: {barcodePerson.nik || barcodePerson.id}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handlePrintBarcode}
                  className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 transition-all active:scale-95"
                >
                  <Printer size={18} />
                  Cetak Identity Pass
                </button>
              </div>
              
              <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-6 opacity-30">
                Official Systems Virtual • 2026
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8 mb-8 md:mb-12">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-lg md:text-2xl shadow-lg shadow-blue-600/20 text-white shrink-0">E</div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-3xl font-black text-white tracking-tighter uppercase italic truncate">DASHBOARD {userRole === UserRole.ADMIN ? 'ADMIN' : 'SECURITY'}</h1>
              <p className="text-slate-500 text-[8px] md:text-xs uppercase tracking-[0.3em] mt-1 font-medium">{userRole === UserRole.ADMIN ? 'Full System Access' : 'Gate Monitoring Terminal'}</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch lg:items-center gap-3 md:gap-4 shrink-0">
            {isMaintenanceMode && (
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/50 rounded-xl text-orange-500 animate-pulse">
                <AlertTriangle size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Public Maintenance Active</span>
              </div>
            )}
            <div className="grid grid-cols-2 lg:flex items-center gap-2">
              <button 
                onClick={() => setShowAddModal('EMPLOYEE')}
                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 md:py-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl font-bold transition-all text-[9px] md:text-[10px] uppercase tracking-wider"
              >
                + Karyawan
              </button>
              <button 
                onClick={() => setShowAddModal('VISITOR')}
                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 md:py-3 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded-xl font-bold transition-all text-[9px] md:text-[10px] uppercase tracking-wider"
              >
                + Visitor
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:flex items-center gap-2 md:gap-3">
              {userRole === UserRole.ADMIN && (
                <button 
                  onClick={toggleMaintenance}
                  disabled={isRefreshingMaintenance}
                  className={`flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-semibold transition-all disabled:opacity-50 text-[10px] md:text-sm active:scale-95 border ${
                    isMaintenanceMode 
                      ? 'bg-orange-600 border-orange-500 text-white' 
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {isMaintenanceMode ? <Hammer size={16} /> : <Hammer size={16} className="text-orange-400" />}
                  <span className="truncate">
                    {isMaintenanceMode ? 'Maintenance: ON' : 'Maint. Mode'}
                  </span>
                </button>
              )}

              {userRole === UserRole.ADMIN && (
                <button 
                  onClick={handleSeed}
                  disabled={isSeeding}
                  className={`flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-semibold transition-all disabled:opacity-50 text-[10px] md:text-sm active:scale-95 border ${
                    seedStep === 'confirming' 
                      ? 'bg-orange-600 border-orange-500 text-white animate-pulse' 
                      : seedStep === 'success'
                      ? 'bg-green-600 border-green-500 text-white'
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <Database size={16} className={seedStep === 'success' ? 'text-white' : 'text-blue-400'} />
                  <span className="truncate">
                    {seedStep === 'idle' && 'Seed Data'}
                    {seedStep === 'confirming' && 'Lanjut?'}
                    {seedStep === 'seeding' && '...'}
                    {seedStep === 'success' && 'OK'}
                  </span>
                </button>
              )}

              <button 
                onClick={handleExport}
                className="col-span-2 sm:col-auto flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-600/20 uppercase tracking-widest text-[10px] md:text-sm active:scale-95"
              >
                <Download size={18} />
                <span className="truncate">Export PDF</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex flex-col sm:flex-row items-stretch bg-slate-900 rounded-2xl border border-slate-800 p-1 md:p-1.5 shadow-inner grow">
            <div className="flex items-center grow">
              <div className="p-3 text-slate-500 shrink-0">
                <Filter size={18} />
              </div>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent p-3 focus:outline-none text-sm text-slate-200 grow min-w-[120px]"
              />
            </div>
            <div className="hidden sm:block w-[1px] h-8 bg-slate-800 mx-2 self-center"></div>
            <div className="sm:hidden w-full h-[1px] bg-slate-800 mb-1"></div>
            <select 
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-transparent p-3 focus:outline-none text-sm text-slate-200 pr-6 grow truncate appearance-none cursor-pointer"
            >
              {departments.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
            </select>
          </div>

          {activeTab === 'EMPLOYEES' && (
            <div className="relative grow md:max-w-xs xl:max-w-md">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Cari Nama atau NIK..."
                className="w-full h-14 bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none transition-all shadow-inner"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-full sm:w-fit mb-4">
              <button 
                onClick={() => setActiveTab('LOGS')}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-[10px] md:text-xs font-bold transition-all uppercase tracking-widest ${
                  activeTab === 'LOGS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Attendance Log
              </button>
              <button 
                onClick={() => setActiveTab('EMPLOYEES')}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-[10px] md:text-xs font-bold transition-all uppercase tracking-widest ${
                  activeTab === 'EMPLOYEES' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Karyawan ({Object.keys(employees).length})
              </button>
            </div>

            {/* Removed the extra search div that used to be here as I consolidated it above */}

            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl shadow-xl overflow-hidden backdrop-blur-sm">
              <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/50 gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-slate-400 uppercase tracking-widest text-sm">
                    {activeTab === 'LOGS' ? 'Attendance Log' : 'Employee Database'}
                  </h3>
                  <button 
                    onClick={() => {}} // Data is live
                    className="p-1.5 text-slate-600 hover:text-blue-400 transition-colors"
                  >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-400/10 border border-blue-400/20 px-3 py-1.5 rounded-lg">
                  {activeTab === 'LOGS' ? `${filteredLogs.length} Entries` : `${Object.keys(employees).length} Personnel`}
                </span>
                {activeTab === 'EMPLOYEES' && (
                  <button 
                    onClick={handlePrintAllBarcodes}
                    disabled={selectedPersonnel.size === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all text-[10px] uppercase tracking-wider shadow-lg shadow-blue-600/20 active:scale-95"
                  >
                    <Printer size={14} />
                    Cetak Identity Pass ({selectedPersonnel.size})
                  </button>
                )}
              </div>
              <div className="overflow-x-auto text-white">
                {activeTab === 'LOGS' ? (
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-[#020617]/50 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800">
                      <tr>
                        <th className="px-5 md:px-8 py-5">Personnel</th>
                        <th className="hidden sm:table-cell px-6 md:px-8 py-5">Department</th>
                        <th className="hidden xs:table-cell px-5 md:px-8 py-5">Time</th>
                        <th className="px-5 md:px-8 py-5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-24 text-center">
                            <div className="flex flex-col items-center gap-4 opacity-20">
                              <Database size={48} />
                              <p className="text-xl font-light uppercase tracking-widest">No Logs Today</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-800/30 transition-colors group text-sm md:text-base">
                            <td className="px-5 md:px-8 py-5">
                              <div className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors capitalize text-xs md:text-base truncate max-w-[120px] md:max-w-none">
                                {employees[log.employeeId]?.name || 'Unknown'}
                              </div>
                              <div className="text-[9px] text-slate-600 font-mono mt-0.5">NIK: {employees[log.employeeId]?.nik || log.employeeId}</div>
                              <div className="xs:hidden text-[9px] text-slate-400 mt-1">
                                {log.timestamp ? format(log.timestamp, 'HH:mm') : '--:--'}
                              </div>
                            </td>
                            <td className="hidden sm:table-cell px-6 md:px-8 py-5">
                              <span className="text-xs text-slate-400 border border-slate-800 px-2.5 py-1 rounded-md bg-slate-900">
                                {employees[log.employeeId]?.department || 'N/A'}
                              </span>
                            </td>
                            <td className="hidden xs:table-cell px-5 md:px-8 py-5 font-mono text-slate-400 text-[10px] md:text-sm">
                              {log.timestamp ? format(log.timestamp, 'HH:mm:ss') : '--:--'}
                            </td>
                            <td className="px-5 md:px-8 py-5">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest border transition-all ${
                                log.type === PresenceType.IN 
                                  ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                {log.type === PresenceType.IN ? <LogIn size={10} /> : <LogOut size={10} />}
                                {log.type}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-[#020617]/50 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800">
                      <tr>
                        <th className="px-5 md:px-8 py-5 w-10">
                          <div 
                            className="flex items-center justify-center cursor-pointer"
                            onClick={toggleSelectAll}
                          >
                            <input 
                              type="checkbox" 
                              readOnly
                              className="w-5 h-5 rounded border-slate-700 bg-slate-900 accent-blue-600 cursor-pointer"
                              checked={filteredPersonnelList.length > 0 && selectedPersonnel.size === filteredPersonnelList.length}
                            />
                          </div>
                        </th>
                        <th className="px-2 py-5 w-8 text-center">No.</th>
                        <th className="px-5 md:px-8 py-5">Personnel</th>
                        <th className="hidden sm:table-cell px-5 md:px-8 py-5">Status</th>
                        <th className="px-5 md:px-8 py-5 text-right w-20 md:w-32">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredPersonnelList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-8 py-24 text-center opacity-20 text-xs">
                            Database Kosong. Silahkan Seed Data.
                          </td>
                        </tr>
                      ) : (
                        filteredPersonnelList.map((emp, idx) => (
                          <tr key={emp.id} className={`hover:bg-slate-800/30 transition-colors group text-[11px] md:text-base ${selectedPersonnel.has(emp.id) ? 'bg-blue-600/5' : ''}`}>
                            <td className="px-5 md:px-8 py-4">
                              <div 
                                className="flex items-center justify-center cursor-pointer"
                                onClick={() => toggleSelectPerson(emp.id)}
                              >
                                <input 
                                  type="checkbox" 
                                  readOnly
                                  className="w-5 h-5 rounded border-slate-700 bg-slate-900 accent-blue-600 cursor-pointer"
                                  checked={selectedPersonnel.has(emp.id)}
                                />
                              </div>
                            </td>
                            <td className="px-2 py-4 text-center text-[10px] text-slate-600 font-mono">
                              {idx + 1}
                            </td>
                            <td className="px-5 md:px-8 py-4">
                              <div className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors truncate max-w-[140px] md:max-w-none">
                                {emp.name}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-blue-500/60 text-[9px] md:text-xs">NIK: {emp.nik || emp.id}</span>
                                <span className="text-[9px] text-slate-600 font-bold uppercase truncate max-w-[80px] md:max-w-none">
                                  {emp.department}
                                </span>
                              </div>
                              <div className="sm:hidden mt-2">
                                <span className={`inline-flex items-center gap-1 text-[8px] font-bold ${
                                  currentStates[emp.id] === PresenceType.IN ? 'text-green-400' : 'text-slate-500'
                                }`}>
                                  <div className={`w-1 h-1 rounded-full ${
                                    currentStates[emp.id] === PresenceType.IN ? 'bg-green-500' : 'bg-slate-700'
                                  }`}></div>
                                  {currentStates[emp.id] || 'OUT'}
                                </span>
                              </div>
                            </td>
                            <td className="hidden sm:table-cell px-5 md:px-8 py-4">
                              <span className={`inline-flex items-center gap-2 px-2 py-1 rounded text-[9px] md:text-[10px] font-bold ${
                                currentStates[emp.id] === PresenceType.IN ? 'text-green-400' : 'text-slate-500'
                              }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  currentStates[emp.id] === PresenceType.IN ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-700'
                                }`}></div>
                                {currentStates[emp.id] || 'OUT'}
                              </span>
                            </td>
                            <td className="px-5 md:px-8 py-4 text-right">
                              <div className="flex items-center justify-end gap-1 md:gap-2">
                                <button 
                                  onClick={() => setBarcodePerson(emp)}
                                  className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                  title="Show Barcode"
                                >
                                  <BarcodeIcon size={12} />
                                </button>
                                <button 
                                  onClick={() => setEditingPerson(emp)}
                                  className="p-2 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  onClick={() => handleDeletePerson(emp.id, emp.name)}
                                  className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                  title="Delete"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Panels */}
          <div className="space-y-8">
            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">IN</span>
                <span className="text-2xl md:text-3xl font-mono text-green-400">{inList.length}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">OUT</span>
                <span className="text-2xl md:text-3xl font-mono text-red-400">{outList.length}</span>
              </div>
            </div>

            {/* List Panels */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-slate-800/50 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <ChevronRight size={14} className="text-blue-500" />
                  Presence Status
                </h3>
              </div>
              <div className="max-h-[400px] lg:max-h-[600px] overflow-y-auto">
                <div className="p-2 space-y-1">
                  {Object.keys(employees).map(id => {
                    const status = currentStates[id];
                    if (!status) return null;
                    return (
                      <div key={id} className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/50 flex items-center justify-between group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`w-1.5 h-1.5 rounded-full shadow-sm shrink-0 ${
                            status === PresenceType.IN ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50'
                          }`}></div>
                          <div className="overflow-hidden">
                            <div className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors truncate">{employees[id]?.name}</div>
                            <div className="text-[9px] text-slate-600 uppercase font-mono truncate">{employees[id]?.department}</div>
                          </div>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ml-2 shrink-0 ${
                          status === PresenceType.IN ? 'text-green-500 border-green-500/20' : 'text-red-500 border-red-500/20'
                        }`}>
                          {status}
                        </span>
                      </div>
                    );
                  })}
                  {Object.keys(currentStates).length === 0 && (
                    <div className="p-8 text-center text-slate-600 text-xs uppercase tracking-widest">No Active Data</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Hidden Print-Only Container for All Barcodes */}
      <div id="print-all-container" className="hidden print:block bg-white p-6">
        <div className="grid grid-cols-2 gap-x-12 gap-y-16">
          {(Object.values(employees) as Employee[])
            .filter(emp => selectedPersonnel.has(emp.id))
            .map((emp) => (
            <div key={emp.id} className="border-2 border-slate-200 rounded-[2.5rem] p-10 flex flex-col items-center page-break-inside-avoid bg-white shadow-sm overflow-hidden relative">
              <div className="text-center mb-6">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white mb-3 mx-auto shadow-md">E</div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 leading-none mb-1">Warehouse ELNUSA BSD</h3>
                <p className="text-[8px] uppercase font-bold text-slate-300 tracking-widest">Attendance Identity Pass</p>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-6 w-full flex flex-col items-center gap-6">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <QRCode 
                    value={emp.nik || emp.id} 
                    size={130}
                    level="H"
                  />
                </div>

                <div className="flex flex-col items-center gap-3">
                  <Barcode 
                    value={emp.nik || emp.id} 
                    width={1.6}
                    height={45}
                    fontSize={12}
                    background="#f8fafc"
                  />
                  <div className="text-center mt-1">
                    <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 leading-tight mb-1">{emp.name}</h2>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{emp.department}</p>
                    <p className="text-[8px] font-mono font-bold text-slate-400 mt-1">NIK: {emp.nik || emp.id}</p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-4 text-center w-full">
                <p className="text-[6px] text-slate-300 font-bold uppercase tracking-widest opacity-50">
                  Official Systems Virtual • 2026
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

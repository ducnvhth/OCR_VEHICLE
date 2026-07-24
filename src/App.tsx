import React, { useState, useEffect, useMemo } from 'react';
import { ExtractionRecord, BatchProcessingProgress, ProcessingError } from './types';
import { groupRecordsByLicensePlate, calculateSystemStats, downloadXlsx } from './utils/dataHelpers';
import { Navbar } from './components/Navbar';
import { UploadZone } from './components/UploadZone';
import { VehicleGroupCard } from './components/VehicleGroupCard';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { DataTable } from './components/DataTable';
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { Layers, BarChart3, Table as TableIcon, Search, RefreshCw, Filter, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function App() {
  const [records, setRecords] = useState<ExtractionRecord[]>(() => {
    const saved = localStorage.getItem('license_plate_records');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse saved records', e);
      }
    }
    return [];
  });

  // Minimum photo threshold state (user can set e.g. 4 photos per plate)
  const [minPhotoThreshold, setMinPhotoThreshold] = useState<number>(() => {
    const savedThreshold = localStorage.getItem('min_photo_threshold');
    return savedThreshold ? parseInt(savedThreshold, 10) || 4 : 4;
  });

  const [activeTab, setActiveTab] = useState<'grouped' | 'analytics' | 'table'>('grouped');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ExtractionRecord | null>(null);
  const [selectedRecordGroupTotal, setSelectedRecordGroupTotal] = useState<number>(1);
  const [hasApiKey, setHasApiKey] = useState(true);

  // Batch upload state
  const [progress, setProgress] = useState<BatchProcessingProgress>({
    total: 0,
    completed: 0,
    currentFileName: '',
    isProcessing: false,
  });
  const [errors, setErrors] = useState<ProcessingError[]>([]);

  // Persist records & threshold to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('license_plate_records', JSON.stringify(records));
    } catch (err) {
      console.error("Không thể lưu dữ liệu vào trình duyệt (có thể do dung lượng ảnh quá lớn):", err);
    }
  }, [records]);

  useEffect(() => {
    localStorage.setItem('min_photo_threshold', minPhotoThreshold.toString());
  }, [minPhotoThreshold]);

  // Check health endpoint for API key
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(data.hasApiKey);
      })
      .catch(() => {
        setHasApiKey(false);
      });
  }, []);

  // Grouped vehicles by threshold
  const groupedVehicles = useMemo(() => {
    return groupRecordsByLicensePlate(records, minPhotoThreshold);
  }, [records, minPhotoThreshold]);

  // Filtered grouped vehicles
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groupedVehicles;

    const term = searchTerm.toLowerCase();
    return groupedVehicles.filter((group) => {
      const matchPlate = group.licensePlate.toLowerCase().includes(term);
      const matchRecords = group.records.some(
        (r) =>
          r.timestamp.toLowerCase().includes(term) ||
          r.fileName.toLowerCase().includes(term) ||
          (r.location && r.location.toLowerCase().includes(term))
      );
      return matchPlate || matchRecords;
    });
  }, [groupedVehicles, searchTerm]);

  // Stats calculation
  const stats = useMemo(() => calculateSystemStats(records, minPhotoThreshold), [records, minPhotoThreshold]);

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Process batch files
  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    setProgress({
      total: files.length,
      completed: 0,
      currentFileName: files[0].name,
      isProcessing: true,
    });
    setErrors([]);

    const newProcessedRecords: ExtractionRecord[] = [];

    const BATCH_SIZE = 4;
    const WAIT_TIME_MS = 62000; // 62 seconds

    for (let i = 0; i < files.length; i++) {
      if (i > 0 && i % BATCH_SIZE === 0) {
        setProgress((prev) => ({
          ...prev,
          currentFileName: `Đang đợi 60s để tránh giới hạn API (Đã xử lý ${i}/${files.length} ảnh)...`,
        }));
        // Wait to reset quota
        await new Promise((resolve) => setTimeout(resolve, WAIT_TIME_MS));
      }

      const file = files[i];
      setProgress((prev) => ({
        ...prev,
        completed: i,
        currentFileName: file.name,
      }));

      try {
        const base64 = await fileToBase64(file);

        // Call backend API
        const response = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
            fileName: file.name,
          }),
        });

        const data = await response.json();

        if (data.success && data.record) {
          const recordWithSrc: ExtractionRecord = {
            ...data.record,
            imageSrc: base64,
          };
          newProcessedRecords.push(recordWithSrc);
        } else {
          // If server fails or returns error, throw to show it in UI
          throw new Error(data.error || "Lỗi không xác định từ AI Server");
        }
      } catch (err: any) {
        console.error('Lỗi khi xử lý file:', file.name, err);
        setErrors((prev) => [...prev, { fileName: file.name, error: err?.message || 'Không thể đọc file' }]);
      }
    }

    setProgress({
      total: files.length,
      completed: files.length,
      currentFileName: '',
      isProcessing: false,
    });

    if (newProcessedRecords.length > 0) {
      setRecords((prev) => [...newProcessedRecords, ...prev]);
    }
  };


  const handleClearAll = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu trích xuất?')) {
      setRecords([]);
      localStorage.removeItem('license_plate_records');
    }
  };

  const handleExportExcel = () => {
    downloadXlsx(records, minPhotoThreshold);
  };

  const handleSaveRecord = (updated: ExtractionRecord) => {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedRecord(null);
  };

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDeleteGroup = (plate: string) => {
    if (window.confirm(`Bạn có chắc muốn xóa tất cả ảnh của biển số ${plate}?`)) {
      setRecords((prev) => prev.filter((r) => r.licensePlate.trim().toUpperCase() !== plate.trim().toUpperCase()));
    }
  };

  const handleBatchDelete = (ids: string[]) => {
    setRecords((prev) => prev.filter((r) => !ids.includes(r.id)));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Navbar */}
      <Navbar
        totalRecords={stats.totalRecords}
        totalVehicles={stats.totalUniqueVehicles}
        warningCount={stats.warningPlatesCount}
        threshold={minPhotoThreshold}
        onUploadClick={() => {
          const area = document.getElementById('dropzone-area');
          area?.scrollIntoView({ behavior: 'smooth' });
          area?.click();
        }}
        onExportExcel={handleExportExcel}
        onClearAll={handleClearAll}
        hasApiKey={hasApiKey}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Upload & AI Zone */}
        <UploadZone
          onFilesSelected={handleFilesSelected}
          progress={progress}
          errors={errors}
          threshold={minPhotoThreshold}
        />

        {/* Control Bar: Tabs + Threshold Setting + Search */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
          
          {/* Tabs */}
          <div className="flex items-center space-x-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-full lg:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('grouped')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'grouped'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="tab-grouped"
            >
              <Layers className="w-4 h-4" />
              <span>Phân Nhóm Theo Biển Số ({groupedVehicles.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="tab-analytics"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Báo Cáo & Cảnh Báo</span>
            </button>

            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'table'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="tab-table"
            >
              <TableIcon className="w-4 h-4" />
              <span>Tất Cả {records.length} Ảnh</span>
            </button>
          </div>

          {/* Threshold Adjuster & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto justify-end">
            
            {/* Warning Threshold Config Button */}
            <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs text-xs">
              <Filter className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold text-slate-700 whitespace-nowrap">Chỉ tiêu tối thiểu:</span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setMinPhotoThreshold(Math.max(1, minPhotoThreshold - 1))}
                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-800 flex items-center justify-center cursor-pointer"
                  title="Giảm chỉ tiêu"
                >
                  -
                </button>
                <span className="font-mono font-black text-blue-700 px-1.5 text-sm">
                  {minPhotoThreshold}
                </span>
                <button
                  onClick={() => setMinPhotoThreshold(minPhotoThreshold + 1)}
                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-800 flex items-center justify-center cursor-pointer"
                  title="Tăng chỉ tiêu"
                >
                  +
                </button>
              </div>
              <span className="text-slate-500 font-medium">ảnh / biển</span>
            </div>

            {/* Search Bar */}
            {activeTab === 'grouped' && (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm biển số xe..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
                />
              </div>
            )}

          </div>

        </div>

        {/* Tab 1: Grouped Vehicles View */}
        {activeTab === 'grouped' && (
          <div className="space-y-4">
            
            {/* Warning summary alert bar if any plates fail threshold */}
            {stats.warningPlatesCount > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-950 shadow-xs">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    Hiện có <strong>{stats.warningPlatesCount} biển số xe</strong> có ít hơn chỉ tiêu <strong>{minPhotoThreshold} ảnh</strong>. Xem chi tiết các thẻ bị gắn cờ cảnh báo phía dưới.
                  </span>
                </div>
              </div>
            )}

            {filteredGroups.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-sm">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Layers className="w-6 h-6 text-slate-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Không tìm thấy biển số xe phù hợp</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Hãy thử tìm kiếm từ khóa khác để xem kết quả.
                </p>

              </div>
            ) : (
              <div className="space-y-5">
                {filteredGroups.map((group) => (
                  <VehicleGroupCard
                    key={group.licensePlate}
                    group={group}
                    onSelectRecord={(rec, total) => {
                      setSelectedRecord(rec);
                      setSelectedRecordGroupTotal(total);
                    }}
                    onDeleteRecord={handleDeleteRecord}
                    onDeleteGroup={handleDeleteGroup}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Analytics View */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            records={records}
            threshold={minPhotoThreshold}
            onThresholdChange={(val) => setMinPhotoThreshold(val)}
          />
        )}

        {/* Tab 3: Detailed Table View */}
        {activeTab === 'table' && (
          <DataTable
            records={records}
            onSelectRecord={(rec) => {
              const plate = rec.licensePlate.trim().toUpperCase();
              const group = groupedVehicles.find((g) => g.licensePlate.trim().toUpperCase() === plate);
              setSelectedRecord(rec);
              setSelectedRecordGroupTotal(group ? group.photoCount : 1);
            }}
            onEditRecord={(rec) => {
              const plate = rec.licensePlate.trim().toUpperCase();
              const group = groupedVehicles.find((g) => g.licensePlate.trim().toUpperCase() === plate);
              setSelectedRecord(rec);
              setSelectedRecordGroupTotal(group ? group.photoCount : 1);
            }}
            onDeleteRecord={handleDeleteRecord}
            onBatchDelete={handleBatchDelete}
            requiredCount={minPhotoThreshold}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Hệ Thống Quản Lý & Trích Xuất Thông Tin Ảnh Theo Biển Số Xe</span>
          <span className="text-slate-600 font-semibold">Gemini Vision AI • Zoom & Threshold Analytics</span>
        </div>
      </footer>

      {/* Detail Modal with Interactive Zoom */}
      {selectedRecord && (
        <VehicleDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onSave={handleSaveRecord}
        requiredCount={minPhotoThreshold}
        totalForPlate={selectedRecordGroupTotal}
        uniquePlates={Array.from(new Set(records.map(r => r.licensePlate).filter(Boolean)))}
      />
      )}

    </div>
  );
}

export default App;

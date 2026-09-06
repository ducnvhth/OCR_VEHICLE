import React, { useState, useEffect, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { ExtractionRecord, BatchProcessingProgress, ProcessingError } from './types';
import { groupRecordsByLicensePlate, calculateSystemStats, downloadXlsx, downloadImagesZip, exportJournalXlsx } from './utils/dataHelpers';
import { Navbar } from './components/Navbar';
import { UploadZone } from './components/UploadZone';
import { VehicleGroupCard } from './components/VehicleGroupCard';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { DataTable } from './components/DataTable';
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { JournalManager } from './components/JournalManager';
import { ManualEntryModal } from './components/ManualEntryModal';
import { Layers, BarChart3, Table as TableIcon, Search, RefreshCw, Filter, AlertTriangle, CheckCircle2, X, Database, ChevronDown } from 'lucide-react';

export function App() {
  const [records, setRecords] = useState<ExtractionRecord[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);

  // Tải dữ liệu cũ từ Database (backend) khi vừa vào trang
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/records').then(r => r.json()),
      fetch('/api/journal').then(r => r.json()),
    ]).then(async ([recordsData, journalData]) => {
      if (cancelled) return;
      const loadedRecords = (recordsData.success && recordsData.records) ? recordsData.records : [];
      const loadedJournal: any[] = (journalData.success && journalData.records) ? journalData.records : [];

      if (loadedRecords.length > 0) setRecords(loadedRecords);

      if (loadedJournal.length > 0) {
        // Nếu đã có journal, ta chỉ lưu vào state.
        // Việc đồng bộ nếu thiếu sẽ do useEffect tự động đảm nhiệm.
        if (!cancelled) setJournalEntries(loadedJournal);
      } else if (loadedRecords.length > 0) {
        // Nhật trình rỗng nhưng có records → việc tự đồng bộ sẽ do useEffect tự động đảm nhiệm.
        // Ta chỉ cần set rỗng ở đây.
        if (!cancelled) setJournalEntries([]);
      }
    }).catch(err => console.error('Lỗi khi tải dữ liệu từ DB:', err));
    return () => { cancelled = true; };
  }, []);

  // Minimum photo threshold state (user can set e.g. 4 photos per plate)
  const [minPhotoThreshold, setMinPhotoThreshold] = useState<number>(() => {
    const savedThreshold = localStorage.getItem('min_photo_threshold');
    return savedThreshold ? parseInt(savedThreshold, 10) || 4 : 4;
  });

  // Trip gap in minutes: images more than this apart are considered a new trip
  const [tripGapMinutes, setTripGapMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('trip_gap_minutes');
    return saved ? parseInt(saved, 10) || 60 : 60;
  });

  const [activeTab, setActiveTab] = useState<'grouped' | 'analytics' | 'table' | 'journal'>('grouped');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ExtractionRecord | null>(null);
  const [selectedRecordGroupTotal, setSelectedRecordGroupTotal] = useState<number>(1);
  const [modalContextRecords, setModalContextRecords] = useState<ExtractionRecord[]>([]);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [apiKeysCount, setApiKeysCount] = useState(1);

  // Batch upload state
  const [progress, setProgress] = useState<BatchProcessingProgress>({
    total: 0,
    completed: 0,
    currentFileName: '',
    isProcessing: false,
  });
  const [errors, setErrors] = useState<ProcessingError[]>([]);

  // Compute mapping from journalEntries
  const journalMapping = useMemo(() => {
    const mapping: Record<string, string[]> = {};
    journalEntries.forEach(entry => {
      if (!mapping[entry.licensePlate]) {
        mapping[entry.licensePlate] = [];
      }
      mapping[entry.licensePlate].push(entry.stt);
    });
    return mapping;
  }, [journalEntries]);

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

  useEffect(() => {
    localStorage.setItem('trip_gap_minutes', tripGapMinutes.toString());
  }, [tripGapMinutes]);

  // Check health endpoint for API key
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(data.hasApiKey);
        if (data.apiKeysCount) {
          setApiKeysCount(data.apiKeysCount);
        }
      })
      .catch(() => {
        setHasApiKey(false);
      });
  }, []);

  // Grouped vehicles by threshold
  const groupedVehicles = useMemo(() => {
    return groupRecordsByLicensePlate(records, minPhotoThreshold, tripGapMinutes);
  }, [records, minPhotoThreshold, tripGapMinutes]);


  // Filtered grouped vehicles
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groupedVehicles;

    const term = searchTerm.toLowerCase();
    const cleanTerm = term.replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric for flexible matching

    return groupedVehicles.filter((group) => {
      const cleanPlate = group.licensePlate.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchPlate = cleanPlate.includes(cleanTerm) || group.licensePlate.toLowerCase().includes(term);
      
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

  const autoAppendToJournal = async (plates: string[]) => {
    try {
      // Lấy danh sách nhật trình mới nhất từ server để tính STT chuẩn
      const res = await fetch('/api/journal');
      const data = await res.json();
      let currentMax = 0;
      if (data.success && Array.isArray(data.records) && data.records.length > 0) {
        currentMax = Math.max(0, ...data.records.map((e: any) => parseInt(e.stt, 10) || 0));
      }
      
      const newEntries = plates.map((plate) => {
        currentMax++;
        return {
          id: 'jrn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          stt: currentMax.toString(),
          licensePlate: plate
        };
      });

      // Gửi lên server từng cái
      for (const entry of newEntries) {
        await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
      }

      // Cập nhật state UI
      setJournalEntries(prev => {
        // Lọc trùng id (nếu có)
        const combined = [...prev, ...newEntries];
        const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        return unique;
      });
    } catch (err) {
      console.error('Lỗi khi tự động thêm nhật trình:', err);
    }
  };

  // Hàm xóa journal entries thừa cho 1 biển số cụ thể (dùng khi xóa lượt/ảnh)
  const removeExcessJournalEntries = (plate: string, remainingRecords: ExtractionRecord[]) => {
    const groups = groupRecordsByLicensePlate(remainingRecords, minPhotoThreshold, tripGapMinutes);
    const expectedTripCount = groups.filter(g => g.licensePlate === plate).length;
    
    const journalForPlate = journalEntries.filter(e => e.licensePlate === plate);
    
    if (journalForPlate.length > expectedTripCount) {
      // Xóa từ cuối lên (LIFO) — xóa các entry thừa
      const toDelete = journalForPlate.slice(expectedTripCount);
      toDelete.forEach(entry => {
        fetch(`/api/journal/${entry.id}`, { method: 'DELETE' }).catch(console.error);
      });
      setJournalEntries(prev => prev.filter(e => !toDelete.some(d => d.id === e.id)));
    }
  };

  // Tự động đồng bộ nhật trình với số lượt (trips) thực tế trên UI
  useEffect(() => {
    // Chỉ chạy khi đã load xong dữ liệu
    if (records.length === 0) return;

    // Tính toán số lượt thực tế của mỗi biển số
    const groups = groupRecordsByLicensePlate(records, minPhotoThreshold, tripGapMinutes);
    const validGroups = groups.filter(g => g.licensePlate && g.licensePlate !== 'CHƯA RÕ BIỂN SỐ');
    
    // Đếm số lượt kỳ vọng cho mỗi biển số
    const tripCounts: Record<string, number> = {};
    validGroups.forEach(g => {
      tripCounts[g.licensePlate] = (tripCounts[g.licensePlate] || 0) + 1;
    });

    // So sánh với journal hiện tại
    const missingPlates: string[] = [];
    const excessEntries: any[] = [];

    Object.keys(tripCounts).forEach(plate => {
      const expectedCount = tripCounts[plate];
      const actualCount = journalEntries.filter(e => e.licensePlate === plate).length;
      if (actualCount < expectedCount) {
        // Thêm các dòng còn thiếu
        for (let i = 0; i < expectedCount - actualCount; i++) {
          missingPlates.push(plate);
        }
      }
      if (actualCount > expectedCount) {
        // Xóa các dòng thừa (từ cuối)
        const entries = journalEntries.filter(e => e.licensePlate === plate);
        excessEntries.push(...entries.slice(expectedCount));
      }
    });

    // Xóa journal entries của biển số không còn tồn tại trong records
    const allPlatesInRecords = new Set(Object.keys(tripCounts));
    journalEntries.forEach(entry => {
      if (!allPlatesInRecords.has(entry.licensePlate)) {
        excessEntries.push(entry);
      }
    });

    if (missingPlates.length > 0) {
      autoAppendToJournal(missingPlates);
    }
    if (excessEntries.length > 0) {
      excessEntries.forEach(entry => {
        fetch(`/api/journal/${entry.id}`, { method: 'DELETE' }).catch(console.error);
      });
      setJournalEntries(prev => prev.filter(e => !excessEntries.some(d => d.id === e.id)));
    }
  }, [records, minPhotoThreshold, tripGapMinutes, journalEntries.length]);

  const handleFilesSelected = async (files: FileList | File[]) => {
    if (files.length === 0) return;

    // Lọc ra các file chưa tồn tại trong records dựa vào fileName
    const existingFileNames = new Set(records.map(r => r.fileName));
    const filesToProcess = Array.from(files).filter(file => !existingFileNames.has(file.name));

    if (filesToProcess.length === 0) {
      alert("Tất cả các ảnh bạn chọn đã được xử lý trước đó (trùng tên file). Không có ảnh mới nào được tải lên.");
      return;
    }

    const skippedCount = files.length - filesToProcess.length;
    const initialErrors = skippedCount > 0 
      ? [{ fileName: `Đã bỏ qua ${skippedCount} ảnh`, error: 'Do trùng tên với các ảnh đã có trong hệ thống.' }] 
      : [];

    setProgress({
      total: filesToProcess.length,
      completed: 0,
      currentFileName: filesToProcess[0].name,
      isProcessing: true,
    });
    setErrors(initialErrors);

    const newProcessedRecords: ExtractionRecord[] = [];

    // Each key handles ~15 RPM. Use 14 for safety.
    const BATCH_SIZE = Math.max(4, apiKeysCount * 14);
    const WAIT_TIME_MS = 62000; // 62 seconds

    for (let i = 0; i < filesToProcess.length; i++) {
      if (i > 0 && i % BATCH_SIZE === 0) {
        setProgress((prev) => ({
          ...prev,
          currentFileName: `Đang đợi 60s để tránh giới hạn API (Đã xử lý ${i}/${filesToProcess.length} ảnh)...`,
        }));
        // Wait to reset quota
        await new Promise((resolve) => setTimeout(resolve, WAIT_TIME_MS));
      }

      const file = filesToProcess[i];
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
            // Sử dụng đường dẫn file (URL) từ server trả về để lưu, thay vì lưu chuỗi base64 khổng lồ
            imageSrc: data.record.imageUrl || base64,
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
      total: filesToProcess.length,
      completed: filesToProcess.length,
      currentFileName: '',
      isProcessing: false,
    });

    if (newProcessedRecords.length > 0) {
      setRecords((prev) => [...newProcessedRecords, ...prev]);
      // Việc thêm vào nhật trình sẽ được useEffect tự động xử lý
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu trích xuất và nhật trình?')) {
      // Xóa records
      fetch('/api/records', { method: 'DELETE' })
        .then(() => {
          setRecords([]);
          localStorage.removeItem('license_plate_records');
        })
        .catch(err => console.error("Lỗi xóa DB:", err));

      // Xóa nhật trình
      fetch('/api/journal', { method: 'DELETE' })
        .then(() => {
          setJournalEntries([]);
        })
        .catch(err => console.error("Lỗi xóa nhật trình:", err));
    }
  };

  const handleExportExcel = () => {
    downloadXlsx(records, minPhotoThreshold, tripGapMinutes);
  };

  const handleExportImages = () => {
    downloadImagesZip(records, journalMapping, tripGapMinutes);
  };

  const handleExportJournal = (sortedEntries?: any[]) => {
    const entriesToExport = sortedEntries && sortedEntries.length > 0 ? sortedEntries : journalEntries;
    exportJournalXlsx(entriesToExport, records, tripGapMinutes);
  };

  const handleUploadJournal = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        alert('File Excel không có dữ liệu (Sheet trống).');
        return;
      }

      const newMapping: Record<string, string> = {};
      let count = 0;
      let sttCol = -1;
      let plateCol = -1;

      worksheet.eachRow((row, rowNumber) => {
        const getCellValue = (cell: any) => {
          if (!cell || cell.value === null || cell.value === undefined) return '';
          if (typeof cell.value === 'object' && cell.value.richText) {
            return cell.value.richText.map((rt: any) => rt.text).join('').trim();
          }
          return cell.value.toString().trim();
        };

        // Try to find headers if not found yet
        if (sttCol === -1 || plateCol === -1) {
          row.eachCell((cell, colNumber) => {
            const val = getCellValue(cell).toUpperCase();
            if (val === 'STT') sttCol = colNumber;
            if (val.includes('BIỂN SỐ') || val.includes('BIEN SO')) plateCol = colNumber;
          });
          return; // skip the header row
        }

        const stt = getCellValue(row.getCell(sttCol));
        const plate = getCellValue(row.getCell(plateCol)).toUpperCase();

        if (stt && plate) {
          // Normalize plate string slightly (remove dashes if any, but keep alphanumeric)
          const normalizedPlate = plate.replace(/[\[\]*?:\/\\]/g, '').trim();
          newMapping[normalizedPlate] = stt;
          count++;
        }
      });

      // Send to backend batch API
      const res = await fetch('/api/journal/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping: newMapping }),
      });
      const data = await res.json();
      if (data.success) {
        setJournalEntries(data.records);
        alert(`Đã nạp thành công nhật trình với ${count} biển số!`);
      } else {
        alert('Có lỗi khi lưu nhật trình vào DB.');
      }
    } catch (err) {
      console.error('Error parsing journal:', err);
      alert('Có lỗi xảy ra khi đọc file Excel. Vui lòng kiểm tra lại định dạng.');
    }
  };

  const handleAddJournal = async (entry: any) => {
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: "jrn_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        ...entry
      }),
    });
    const data = await res.json();
    if (data.success) {
      setJournalEntries([...journalEntries, data.record]);
    }
  };

  const handleUpdateJournal = async (id: string, entry: any) => {
    const res = await fetch(`/api/journal/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    if (data.success) {
      setJournalEntries(journalEntries.map(e => e.id === id ? data.record : e));
    }
  };

  const handleDeleteJournal = async (id: string) => {
    const res = await fetch(`/api/journal/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.success) {
      setJournalEntries(journalEntries.filter(e => e.id !== id));
    }
  };

  const handleDeleteAllJournal = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu nhật trình không? Hành động này không thể hoàn tác.")) {
      const res = await fetch('/api/journal', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setJournalEntries([]);
      }
    }
  };

  const handleSaveRecord = (updated: ExtractionRecord) => {
    fetch(`/api/records/${updated.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
      .then(res => res.json())
      .then(data => {
        const finalRecord = (data.success && data.record) ? data.record : { ...updated, isEdited: true };
        setRecords((prev) => prev.map((r) => (r.id === updated.id ? finalRecord : r)));
        setModalContextRecords((prev) => prev.map((r) => (r.id === updated.id ? finalRecord : r)));
        setSelectedRecord(null);
      })
      .catch(err => {
        console.error("Lỗi cập nhật DB:", err);
        const finalRecord = { ...updated, isEdited: true };
        setRecords((prev) => prev.map((r) => (r.id === updated.id ? finalRecord : r)));
        setModalContextRecords((prev) => prev.map((r) => (r.id === updated.id ? finalRecord : r)));
        setSelectedRecord(null);
      });
  };

  const handleManualEntry = (newRecords: any[]) => {
    setRecords((prev) => [...newRecords, ...prev]);
    setShowManualEntry(false);
    // Việc thêm vào nhật trình sẽ được useEffect tự động xử lý
  };

  const handleDeleteRecord = (id: string) => {
    fetch(`/api/records/${id}`, { method: 'DELETE' }).catch(console.error);
    // Tìm biển số của record bị xóa để đồng bộ journal
    const deletedRecord = records.find(r => r.id === id);
    const newRecords = records.filter((r) => r.id !== id);
    setRecords(newRecords);
    if (deletedRecord) {
      removeExcessJournalEntries(deletedRecord.licensePlate.trim().toUpperCase(), newRecords);
    }
  };

  const handleDeleteGroup = (recordIds: string[], plate: string, tripIdx: number) => {
    if (window.confirm(`Bạn có chắc muốn xóa lượt ${tripIdx} của biển số ${plate}?`)) {
      recordIds.forEach(id => fetch(`/api/records/${id}`, { method: 'DELETE' }).catch(console.error));
      const newRecords = records.filter((r) => !recordIds.includes(r.id));
      setRecords(newRecords);
      // Đồng bộ journal: xóa entry thừa cho biển số này
      removeExcessJournalEntries(plate, newRecords);
    }
  };

  const handleBatchDelete = (ids: string[]) => {
    ids.forEach(id => fetch(`/api/records/${id}`, { method: 'DELETE' }).catch(console.error));
    setRecords((prev) => prev.filter((r) => !ids.includes(r.id)));
  };

  // Thêm ảnh vào lượt đã có sẵn của 1 biển số (Bỏ qua AI, thêm trực tiếp vào cùng thời gian)
  const handleAddImagesToGroup = async (files: File[], plate: string, tripRecords: ExtractionRecord[]) => {
    if (files.length === 0 || tripRecords.length === 0) return;

    // Lấy mốc thời gian của ảnh đầu tiên trong lượt này làm gốc
    const baseRecord = tripRecords[0];

    // Lọc file trùng tên
    const existingFileNames = new Set(records.map(r => r.fileName));
    const filesToProcess = files.filter(f => !existingFileNames.has(f.name));
    if (filesToProcess.length === 0) {
      alert("Tất cả các ảnh bạn chọn đã được xử lý trước đó (trùng tên file).");
      return;
    }

    setProgress({
      total: filesToProcess.length,
      completed: 0,
      currentFileName: filesToProcess[0].name,
      isProcessing: true,
    });
    setErrors([]);

    const newProcessedRecords: ExtractionRecord[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      setProgress((prev) => ({
        ...prev,
        completed: i,
        currentFileName: `Đang thêm vào ${plate}: ${file.name}`,
      }));

      try {
        const base64 = await fileToBase64(file);

        const response = await fetch('/api/records/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
            fileName: file.name,
            licensePlate: plate,
            formattedTime: baseRecord.formattedTime,
            formattedDate: baseRecord.formattedDate,
            parsedDateISO: baseRecord.parsedDateISO,
            location: baseRecord.location,
            notes: "Bổ sung ảnh thủ công vào lượt",
          }),
        });

        const data = await response.json();

        if (data.success && data.record) {
          newProcessedRecords.push(data.record);
        } else {
          throw new Error(data.error || "Lỗi lưu file");
        }
      } catch (err: any) {
        console.error('Lỗi khi xử lý file:', file.name, err);
        setErrors((prev) => [...prev, { fileName: file.name, error: err?.message || 'Không thể đọc file' }]);
      }
    }

    setProgress({
      total: filesToProcess.length,
      completed: filesToProcess.length,
      currentFileName: '',
      isProcessing: false,
    });

    if (newProcessedRecords.length > 0) {
      setRecords((prev) => [...newProcessedRecords, ...prev]);
    }
  };

  const warningPlatesList = useMemo(() => {
    return Array.from(new Set(groupedVehicles.filter(g => g.isWarning).map(g => g.licensePlate)));
  }, [groupedVehicles]);

  const smartSuggestions = useMemo(() => {
    if (!selectedRecord) return [];
    
    // Convert current record time to timestamp
    const targetTime = new Date(selectedRecord.parsedDateISO).getTime();
    if (isNaN(targetTime)) return [];

    const suggestionsMap = new Map<string, string>();
    
    records.forEach(r => {
      if (r.id === selectedRecord.id) return;
      if (!r.licensePlate || r.licensePlate.includes('CHƯA RÕ')) return;
      
      const rTime = new Date(r.parsedDateISO).getTime();
      if (isNaN(rTime)) return;
      
      // If within 2 minutes (120,000 ms)
      const diff = Math.abs(rTime - targetTime);
      if (diff <= 120000) {
        if (!suggestionsMap.has(r.licensePlate)) {
          suggestionsMap.set(r.licensePlate, r.imageSrc);
        }
      }
    });
    
    return Array.from(suggestionsMap.entries()).map(([plate, imageSrc]) => ({ plate, imageSrc }));
  }, [selectedRecord, records]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Navbar */}
      <Navbar
        totalRecords={stats.totalRecords}
        totalVehicles={stats.totalUniqueVehicles}
        warningCount={stats.warningPlatesCount}
        threshold={minPhotoThreshold}
        onUploadClick={() => {
          document.getElementById('upload-input')?.click();
        }}
        onUploadJournal={handleUploadJournal}
        onExportExcel={handleExportExcel}
        onExportImages={handleExportImages}
        onClearAll={handleClearAll}
        hasApiKey={hasApiKey}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Upload & AI Zone */}
        <UploadZone
          onFilesSelected={handleFilesSelected}
          onManualEntry={() => setShowManualEntry(true)}
          progress={progress}
          errors={errors}
          threshold={minPhotoThreshold}
        />

        {/* Control Bar: Tabs + Settings + Dropdown */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 w-full">
          
          {/* Row 1: Tabs & Configs */}
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
              <button
                onClick={() => setActiveTab('grouped')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
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
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
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
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  activeTab === 'table'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                id="tab-table"
              >
                <TableIcon className="w-4 h-4" />
                <span>Tất Cả {records.length} Ảnh</span>
              </button>

              <button
                onClick={() => setActiveTab('journal')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  activeTab === 'journal'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                id="tab-journal"
              >
                <Database className="w-4 h-4" />
                <span>Nhật Trình</span>
              </button>
            </div>

            {/* Threshold Adjuster & Trip Gap Config */}
            <div className="flex flex-wrap items-center gap-3 ml-auto">
              
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

              {/* Trip Gap Config */}
              <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs text-xs">
                <span className="text-base">🔄</span>
                <span className="font-semibold text-slate-700 whitespace-nowrap">Tách lượt sau:</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setTripGapMinutes(Math.max(15, tripGapMinutes - 15))}
                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-800 flex items-center justify-center cursor-pointer"
                    title="Giảm ngưỡng tách lượt"
                  >
                    -
                  </button>
                  <span className="font-mono font-black text-violet-700 px-1.5 text-sm">
                    {tripGapMinutes}
                  </span>
                  <button
                    onClick={() => setTripGapMinutes(tripGapMinutes + 15)}
                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-800 flex items-center justify-center cursor-pointer"
                    title="Tăng ngưỡng tách lượt"
                  >
                    +
                  </button>
                </div>
                <span className="text-slate-500 font-medium">phút</span>
              </div>
            </div>
          </div>

          {/* Row 2: Search Dropdown */}
          {activeTab === 'grouped' && (
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-200 w-full sm:w-80 ml-auto shadow-sm">
              <span className="text-sm font-semibold text-slate-700 px-2 shrink-0">Lọc biển số:</span>
              <div className="relative flex-1 group">
                {(() => {
                  const uniquePlates = Array.from(new Set(groupedVehicles.map(g => g.licensePlate))).sort();
                  return (
                    <>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={`Tìm biển số... (${uniquePlates.length})`}
                        list="search-plate-list"
                        className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-sm font-mono text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs transition"
                      />
                      <datalist id="search-plate-list">
                        {uniquePlates.map(plate => (
                          <option key={plate} value={plate} />
                        ))}
                      </datalist>
                    </>
                  );
                })()}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" />
                </div>
              </div>
              
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="ml-2 w-7 h-7 flex items-center justify-center text-rose-500 hover:text-white bg-white hover:bg-rose-500 border border-slate-200 hover:border-rose-500 rounded-lg transition shadow-sm shrink-0"
                  title="Xóa bộ lọc"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab 1: Grouped Vehicles View */}
        {activeTab === 'grouped' && (
          <div className="space-y-4">
            
            {/* Warning summary alert bar if any plates fail threshold */}
            {stats.warningPlatesCount > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between text-xs text-rose-950 shadow-xs gap-3 md:gap-0">
                <div className="flex items-start md:items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 md:mt-0" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>
                      Hiện có <strong>{stats.warningPlatesCount} biển số xe</strong> có ít hơn chỉ tiêu <strong>{minPhotoThreshold} ảnh</strong>:
                    </span>
                    {warningPlatesList.map(plate => (
                      <button
                        key={plate}
                        onClick={() => setSearchTerm(plate)}
                        className="px-2 py-0.5 bg-rose-100 hover:bg-rose-600 hover:text-white text-rose-700 font-mono rounded border border-rose-200 transition cursor-pointer"
                        title={`Lọc xem chi tiết biển ${plate}`}
                      >
                        {plate}
                      </button>
                    ))}
                    <span>(Xem chi tiết bên dưới)</span>
                  </div>
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
                    key={`${group.licensePlate}_trip${group.tripIndex}`}
                    group={group}
                    onSelectRecord={(rec, total, contextList) => {
                      setSelectedRecord(rec);
                      setSelectedRecordGroupTotal(total);
                      setModalContextRecords(contextList || records);
                    }}
                    onDeleteRecord={handleDeleteRecord}
                    onDeleteGroup={(ids, plate, tripIdx) => handleDeleteGroup(ids, plate, tripIdx)}
                    onAddImages={handleAddImagesToGroup}
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
            onSelectRecord={(rec, contextList) => {
              const plate = rec.licensePlate.trim().toUpperCase();
              const group = groupedVehicles.find((g) => g.licensePlate.trim().toUpperCase() === plate);
              setSelectedRecord(rec);
              setSelectedRecordGroupTotal(group ? group.photoCount : 1);
              setModalContextRecords(contextList || records);
            }}
            onEditRecord={(rec, contextList) => {
              const plate = rec.licensePlate.trim().toUpperCase();
              const group = groupedVehicles.find((g) => g.licensePlate.trim().toUpperCase() === plate);
              setSelectedRecord(rec);
              setSelectedRecordGroupTotal(group ? group.photoCount : 1);
              setModalContextRecords(contextList || records);
            }}
            onDeleteRecord={handleDeleteRecord}
            onBatchDelete={handleBatchDelete}
            requiredCount={minPhotoThreshold}
          />
        )}
        {/* Tab 4: Journal Manager */}
        {activeTab === 'journal' && (
          <JournalManager
            journalEntries={journalEntries}
            onAdd={handleAddJournal}
            onUpdate={handleUpdateJournal}
            onDelete={handleDeleteJournal}
            onDeleteAll={handleDeleteAllJournal}
            onExport={() => exportJournalXlsx(journalEntries, records, tripGapMinutes)}
            groupedVehicles={groupedVehicles}
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

      {/* Manual Entry Modal */}
      {showManualEntry && (
        <ManualEntryModal
          onClose={() => setShowManualEntry(false)}
          onSaved={handleManualEntry}
          uniquePlates={Array.from(new Set(records.map(r => r.licensePlate).filter(Boolean)))}
        />
      )}

      {/* Modals */}
      {selectedRecord && (
        <VehicleDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onSave={handleSaveRecord}
          allRecords={modalContextRecords.length > 0 ? modalContextRecords : records}
          onNavigate={(rec) => {
            const plate = rec.licensePlate.trim().toUpperCase();
            const group = groupedVehicles.find((g) => g.licensePlate.trim().toUpperCase() === plate);
            setSelectedRecord(rec);
            setSelectedRecordGroupTotal(group ? group.photoCount : 1);
          }}
          requiredCount={minPhotoThreshold}
          totalForPlate={selectedRecordGroupTotal}
          uniquePlates={Array.from(new Set(records.map(r => r.licensePlate).filter(Boolean)))}
          smartSuggestions={smartSuggestions}
        />
      )}
    </div>
  );
}

export default App;

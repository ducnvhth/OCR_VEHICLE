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
import { ProfileManagerModal } from './components/ProfileManagerModal';
import { Layers, BarChart3, Table as TableIcon, Search, RefreshCw, Filter, AlertTriangle, CheckCircle2, X, Database, ChevronDown, Download, ArrowUpCircle } from 'lucide-react';
import packageJson from '../package.json';

const CURRENT_VERSION = packageJson.version || '1.0.0';

export interface Profile {
  id: string;
  name: string;
  minPhotoThreshold: number;
}

export function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('default');

  const [records, setRecords] = useState<ExtractionRecord[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [minPhotoThreshold, setMinPhotoThreshold] = useState<number>(4);

  // Fetch profiles on mount
  useEffect(() => {
    fetch('/api/profiles')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.profiles && data.profiles.length > 0) {
          setProfiles(data.profiles);
          // Set to default or the first one if default doesn't exist
          const defaultProf = data.profiles.find((p: Profile) => p.id === 'default') || data.profiles[0];
          if (defaultProf) {
            setActiveProfileId(defaultProf.id);
            setMinPhotoThreshold(defaultProf.minPhotoThreshold || 4);
          }
        }
      })
      .catch(err => console.error("Error fetching profiles:", err));
  }, []);

  // Tải dữ liệu cũ từ Database (backend) khi đổi profile
  useEffect(() => {
    if (!activeProfileId) return;
    
    let cancelled = false;
    Promise.all([
      fetch(`/api/records?profileId=${activeProfileId}`).then(r => r.json()),
      fetch(`/api/journal?profileId=${activeProfileId}`).then(r => r.json()),
    ]).then(async ([recordsData, journalData]) => {
      if (cancelled) return;
      const loadedRecords = (recordsData.success && recordsData.records) ? recordsData.records : [];
      const loadedJournal: any[] = (journalData.success && journalData.records) ? journalData.records : [];

      if (loadedRecords.length > 0) setRecords(loadedRecords);
      else setRecords([]);

      if (loadedJournal.length > 0) {
        if (!cancelled) setJournalEntries(loadedJournal);
      } else if (loadedRecords.length > 0) {
        if (!cancelled) setJournalEntries([]);
      } else {
        setJournalEntries([]);
      }
    }).catch(err => console.error('Lỗi khi tải dữ liệu từ DB:', err));
    return () => { cancelled = true; };
  }, [activeProfileId]);

  const [activeTab, setActiveTab] = useState<'grouped' | 'analytics' | 'table' | 'journal'>('grouped');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sttSearchTerm, setSttSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ExtractionRecord | null>(null);
  const [selectedRecordGroupTotal, setSelectedRecordGroupTotal] = useState<number>(1);
  const [modalContextRecords, setModalContextRecords] = useState<ExtractionRecord[]>([]);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [apiKeysCount, setApiKeysCount] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Auto Update State
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean, url: string, version: string, notes: string } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch GitHub Releases for updates
  // Fetch updates check from backend
  useEffect(() => {
    fetch(`/api/update/check?currentVersion=${CURRENT_VERSION}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.hasUpdate) {
          setUpdateInfo({
            available: true,
            url: data.downloadUrl,
            // Bỏ ký tự 'v' đứng đầu để tránh hiển thị 'vv1.1.1'
            version: (data.latestVersion || '').replace(/^v/i, ''),
            notes: data.notes || 'Cập nhật phiên bản mới giúp cải thiện hiệu năng và vá lỗi.'
          });
        }
      })
      .catch(console.error);
  }, []);

  const handleDoUpdate = async () => {
    if (!updateInfo) return;
    setIsUpdating(true);
    try {
      const res = await fetch('/api/update/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadUrl: updateInfo.url })
      });
      const data = await res.json();
      if (!data.success) {
        alert('Lỗi cập nhật: ' + data.error);
        setIsUpdating(false);
      } else if (data.message && data.message.includes("Dev Mode")) {
        // Xử lý riêng cho lúc Test ở chế độ Dev
        alert(data.message);
        setIsUpdating(false);
        setShowUpdateModal(false);
      }
      // If success (Production), backend will restart the exe. Just keep loading.
    } catch(e) {
      console.error(e);
      // Connection will drop when backend restarts
    }
  };

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
    
    const sortedEntries = [...journalEntries].sort((a, b) => {
      const aStt = parseInt(a.stt, 10) || 0;
      const bStt = parseInt(b.stt, 10) || 0;
      return aStt - bStt;
    });

    sortedEntries.forEach(entry => {
      if (!mapping[entry.licensePlate]) {
        mapping[entry.licensePlate] = [];
      }
      mapping[entry.licensePlate].push(entry.stt);
    });
    return mapping;
  }, [journalEntries]);

  // Persist records to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('license_plate_records', JSON.stringify(records));
    } catch (err) {
      console.error("Không thể lưu dữ liệu vào trình duyệt (có thể do dung lượng ảnh quá lớn):", err);
    }
  }, [records]);

  // Update profile threshold when minPhotoThreshold changes
  useEffect(() => {
    if (activeProfileId) {
      const activeProfile = profiles.find(p => p.id === activeProfileId);
      if (activeProfile && activeProfile.minPhotoThreshold !== minPhotoThreshold) {
        fetch(`/api/profiles/${activeProfileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ minPhotoThreshold })
        }).catch(err => console.error("Error saving threshold:", err));
        
        // Update local profiles list
        setProfiles(prev => prev.map(p => 
          p.id === activeProfileId ? { ...p, minPhotoThreshold } : p
        ));
      }
    }
  }, [minPhotoThreshold, activeProfileId]);

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

  // Profile Handlers
  const handleAddProfile = async (profileData: Omit<Profile, 'id'>) => {
    const newId = "prof_" + Date.now().toString(36);
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newId, ...profileData })
      });
      const data = await res.json();
      if (data.success) {
        setProfiles(prev => [...prev, data.profile]);
        setActiveProfileId(data.profile.id);
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi thêm nhà xe');
    }
  };

  const handleUpdateProfile = async (id: string, updates: Partial<Profile>) => {
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        setProfiles(prev => prev.map(p => p.id === id ? data.profile : p));
        if (activeProfileId === id && updates.minPhotoThreshold) {
          setMinPhotoThreshold(updates.minPhotoThreshold);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi cập nhật nhà xe');
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setProfiles(prev => prev.filter(p => p.id !== id));
        if (activeProfileId === id) {
          setActiveProfileId('default');
        }
      } else {
        alert(data.error || 'Lỗi xóa nhà xe');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi xóa nhà xe');
    }
  };

  // Grouped vehicles by threshold
  const groupedVehicles = useMemo(() => {
    return groupRecordsByLicensePlate(records, minPhotoThreshold);
  }, [records, minPhotoThreshold]);

  // Filtered grouped vehicles
  const filteredGroups = useMemo(() => {
    let result = groupedVehicles;
    
    // Filter by STT
    if (sttSearchTerm.trim()) {
      const term = sttSearchTerm.trim().toLowerCase();
      result = result.filter(group => {
        const sttsForPlate = journalMapping[group.licensePlate];
        const stt = sttsForPlate ? sttsForPlate[group.tripIndex - 1] : null;
        if (!stt) return false;
        // Exact match or prefix match (e.g. 106 matches 106.1)
        return stt.toLowerCase() === term || stt.toLowerCase().startsWith(term + '.');
      });
    }

    if (!searchTerm.trim()) return result;

    const term = searchTerm.toLowerCase();
    const cleanTerm = term.replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric for flexible matching

    return result.filter((group) => {
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
  }, [groupedVehicles, searchTerm, sttSearchTerm, journalMapping]);

  // Stats calculation
  const stats = useMemo(() => {
    return calculateSystemStats(records, minPhotoThreshold);
  }, [records, minPhotoThreshold]);

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
      const res = await fetch(`/api/journal?profileId=${activeProfileId}`);
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
        await fetch(`/api/journal?profileId=${activeProfileId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...entry, profileId: activeProfileId }),
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
    const groups = groupRecordsByLicensePlate(remainingRecords, minPhotoThreshold);
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
    const groups = groupRecordsByLicensePlate(records, minPhotoThreshold);
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
  }, [records, minPhotoThreshold, journalEntries.length]);

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
        const response = await fetch(`/api/analyze-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
            fileName: file.name,
            profileId: activeProfileId
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
      fetch(`/api/records?profileId=${activeProfileId}`, { method: 'DELETE' })
        .then(() => {
          setRecords([]);
          localStorage.removeItem('license_plate_records');
        })
        .catch(err => console.error("Lỗi xóa DB:", err));

      // Xóa nhật trình
      fetch(`/api/journal?profileId=${activeProfileId}`, { method: 'DELETE' })
        .then(() => {
          setJournalEntries([]);
        })
        .catch(err => console.error("Lỗi xóa nhật trình:", err));
    }
  };

  const handleExportExcel = () => {
    const profile = profiles.find(p => p.id === activeProfileId);
    downloadXlsx(records, minPhotoThreshold, profile?.name);
  };

  const handleExportImages = async () => {
    setIsExporting(true);
    try {
      const profile = profiles.find(p => p.id === activeProfileId);
      await downloadImagesZip(records, journalMapping, 60, profile?.name);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xuất folder ảnh.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJournal = (sortedEntries?: any[]) => {
    const entriesToExport = sortedEntries && sortedEntries.length > 0 ? sortedEntries : journalEntries;
    const profile = profiles.find(p => p.id === activeProfileId);
    exportJournalXlsx(entriesToExport, records, 60, profile?.name);
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

      const newMapping: Record<string, string[]> = {};
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
          if (!newMapping[normalizedPlate]) newMapping[normalizedPlate] = [];
          newMapping[normalizedPlate].push(stt);
          count++;
        }
      });

      // Send to backend batch API
      const res = await fetch(`/api/journal/batch?profileId=${activeProfileId}`, {
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
    const res = await fetch(`/api/journal?profileId=${activeProfileId}`, {
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
    // Lưu lại biển số cũ trước khi sửa
    const oldEntry = journalEntries.find(e => e.id === id);
    const oldPlate = oldEntry ? oldEntry.licensePlate : '';

    const res = await fetch(`/api/journal/${id}?profileId=${activeProfileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    if (data.success) {
      setJournalEntries(journalEntries.map(e => e.id === id ? data.record : e));

      // Đồng bộ: Nếu đổi biển số, đổi luôn biển số của các ảnh đang khớp với biển cũ
      if (oldPlate && oldPlate !== entry.licensePlate) {
        const recordsToUpdate = records.filter(r => r.licensePlate === oldPlate);
        if (recordsToUpdate.length > 0) {
          recordsToUpdate.forEach(r => {
            fetch(`/api/records/${r.id}?profileId=${activeProfileId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...r, licensePlate: entry.licensePlate }),
            }).catch(console.error);
          });
          // Cập nhật state nội bộ để giao diện đổi ngay lập tức
          setRecords(prev => prev.map(r => r.licensePlate === oldPlate ? { ...r, licensePlate: entry.licensePlate } : r));
        }
      }
    }
  };

  const handleDeleteJournal = async (id: string) => {
    const res = await fetch(`/api/journal/${id}?profileId=${activeProfileId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.success) {
      setJournalEntries(journalEntries.filter(e => e.id !== id));
    }
  };

  const handleDeleteAllJournal = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu nhật trình không? Hành động này không thể hoàn tác.")) {
      const res = await fetch(`/api/journal?profileId=${activeProfileId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setJournalEntries([]);
      }
    }
  };

  const handleBatchUpdateStt = async (updates: { id: string; stt: string }[]) => {
    try {
      // Update each entry's STT on the backend
      const promises = updates.map(({ id, stt }) =>
        fetch(`/api/journal/${id}?profileId=${activeProfileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stt }),
        }).then(res => res.json())
      );
      const results = await Promise.all(promises);
      
      // Build a map of updated records from server responses
      const updatedMap = new Map<string, any>();
      results.forEach((data) => {
        if (data.success && data.record) {
          updatedMap.set(data.record.id, data.record);
        }
      });

      // Update local state and sort by STT
      setJournalEntries(prev => {
        const updated = prev.map(entry => updatedMap.has(entry.id) ? updatedMap.get(entry.id) : entry);
        return updated.sort((a, b) => {
          const aStt = parseInt(a.stt, 10) || 0;
          const bStt = parseInt(b.stt, 10) || 0;
          return aStt - bStt;
        });
      });
    } catch (err) {
      console.error('L\u1ed7i khi c\u1eadp nh\u1eadt STT h\u00e0ng lo\u1ea1t:', err);
      alert('C\u00f3 l\u1ed7i x\u1ea3y ra khi c\u1eadp nh\u1eadt STT. Vui l\u00f2ng th\u1eed l\u1ea1i.');
    }
  };

  const handleSaveRecord = (updated: ExtractionRecord) => {
    fetch(`/api/records/${updated.id}?profileId=${activeProfileId}`, {
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
    fetch(`/api/records/${id}?profileId=${activeProfileId}`, { method: 'DELETE' }).catch(console.error);
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
      recordIds.forEach(id => fetch(`/api/records/${id}?profileId=${activeProfileId}`, { method: 'DELETE' }).catch(console.error));
      const newRecords = records.filter((r) => !recordIds.includes(r.id));
      setRecords(newRecords);
      // Đồng bộ journal: xóa entry thừa cho biển số này
      removeExcessJournalEntries(plate.trim().toUpperCase(), newRecords);
    }
  };

  const handleEditGroup = (recordIds: string[], updates: { licensePlate: string, formattedTime: string, formattedDate: string }) => {
    // build iso date
    let isoDate = new Date().toISOString();
    try {
      const [day, month, year] = updates.formattedDate.split('/');
      const [hour, minute] = updates.formattedTime.split(':');
      const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10));
      if (!isNaN(dateObj.getTime())) {
        isoDate = dateObj.toISOString();
      }
    } catch (e) {}

    const fullUpdates = {
      ...updates,
      licensePlate: updates.licensePlate.trim().toUpperCase(),
      rawLicensePlate: updates.licensePlate.trim().toUpperCase(),
      timestamp: `${updates.formattedTime} ${updates.formattedDate}`,
      parsedDateISO: isoDate,
    };

    recordIds.forEach(id => {
      fetch(`/api/records/${id}?profileId=${activeProfileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullUpdates),
      }).catch(console.error);
    });

    setRecords(prev => prev.map(r => {
      if (recordIds.includes(r.id)) {
        return { ...r, ...fullUpdates, isEdited: true };
      }
      return r;
    }));
  };

  const handleBatchDelete = (ids: string[]) => {
    ids.forEach(id => fetch(`/api/records/${id}?profileId=${activeProfileId}`, { method: 'DELETE' }).catch(console.error));
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
            location: baseRecord.location || '',
            notes: "Cập nhật qua kéo thả ảnh bổ sung",
            profileId: activeProfileId
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

  const handleReorderRecords = (reorderedList: ExtractionRecord[]) => {
    // Cập nhật lên server
    reorderedList.forEach((r) => {
      fetch(`/api/records/${r.id}?profileId=${activeProfileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customOrder: r.customOrder }),
      }).catch(console.error);
    });

    // Cập nhật UI
    setRecords((prev) => {
      const updated = [...prev];
      reorderedList.forEach((r) => {
        const idx = updated.findIndex((u) => u.id === r.id);
        if (idx !== -1) {
          updated[idx] = r;
        }
      });
      return updated;
    });
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
        isExporting={isExporting}
        updateInfo={updateInfo}
        onShowUpdate={() => setShowUpdateModal(true)}
        currentVersion={CURRENT_VERSION}
        profiles={profiles}
        activeProfileId={activeProfileId}
        setActiveProfileId={(id) => {
          setActiveProfileId(id);
          const p = profiles.find(x => x.id === id);
          if (p) setMinPhotoThreshold(p.minPhotoThreshold || 4);
        }}
        onManageProfiles={() => setShowProfileManager(true)}
      />

      {/* Profile Manager Modal */}
      {showProfileManager && (
        <ProfileManagerModal
          profiles={profiles}
          onClose={() => setShowProfileManager(false)}
          onAdd={handleAddProfile}
          onUpdate={handleUpdateProfile}
          onDelete={handleDeleteProfile}
        />
      )}

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


            </div>
          </div>

          {/* Row 2: Search Filters */}
          {activeTab === 'grouped' && (
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200 ml-auto shadow-sm w-full sm:w-auto">
              
              {/* Filter by STT */}
              <div className="flex items-center flex-1 min-w-[120px]">
                <span className="text-sm font-semibold text-slate-700 px-2 shrink-0">STT:</span>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={sttSearchTerm}
                    onChange={(e) => setSttSearchTerm(e.target.value)}
                    placeholder="VD: 106"
                    className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-sm font-mono text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs transition"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Search className="w-4 h-4 text-slate-400" />
                  </div>
                  {sttSearchTerm && (
                    <button
                      onClick={() => setSttSearchTerm('')}
                      className="absolute right-8 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-rose-500 hover:text-white bg-white hover:bg-rose-500 border border-slate-200 hover:border-rose-500 rounded-lg transition shadow-sm"
                      title="Xóa bộ lọc"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter by Plate */}
              <div className="flex items-center flex-1 min-w-[200px]">
                <span className="text-sm font-semibold text-slate-700 px-2 shrink-0">Biển số:</span>
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
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-8 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-rose-500 hover:text-white bg-white hover:bg-rose-500 border border-slate-200 hover:border-rose-500 rounded-lg transition shadow-sm"
                      title="Xóa bộ lọc"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

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
                      Hiện có <strong>{stats.warningPlatesCount} biển số xe</strong> chưa đạt đúng chỉ tiêu <strong>{minPhotoThreshold} ảnh</strong> (thừa hoặc thiếu):
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
                {filteredGroups.map((group) => {
                  const plate = group.licensePlate.trim().toUpperCase();
                  const sttArray = journalMapping[plate];
                  const stt = sttArray ? (sttArray[group.tripIndex - 1] || sttArray[sttArray.length - 1]) : null;

                  return (
                    <VehicleGroupCard
                      key={`${group.licensePlate}_trip${group.tripIndex}`}
                      group={group}
                      journalStt={stt}
                      onSelectRecord={(rec, total, contextList) => {
                        setSelectedRecord(rec);
                        setSelectedRecordGroupTotal(total);
                        setModalContextRecords(contextList || records);
                      }}
                      onDeleteRecord={handleDeleteRecord}
                      onDeleteGroup={(ids, plate, tripIdx) => handleDeleteGroup(ids, plate, tripIdx)}
                      onAddImages={handleAddImagesToGroup}
                      onReorderRecords={handleReorderRecords}
                      onEditGroup={handleEditGroup}
                    />
                  );
                })}
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
            onExport={handleExportJournal}
            onBatchUpdateStt={handleBatchUpdateStt}
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
          activeProfileId={activeProfileId}
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

      {/* Auto-Update Modal */}
      {showUpdateModal && updateInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
              <div className="flex items-center space-x-2 text-blue-700">
                <ArrowUpCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Cập nhật phần mềm</h3>
              </div>
              {!isUpdating && (
                <button onClick={() => setShowUpdateModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {!isUpdating ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Phiên bản hiện tại</p>
                      <p className="text-lg font-mono font-bold text-slate-700">v{CURRENT_VERSION}</p>
                    </div>
                    <ArrowUpCircle className="w-8 h-8 text-blue-300" />
                    <div className="text-right">
                      <p className="text-sm text-blue-600 font-medium">Phiên bản mới</p>
                      <p className="text-lg font-mono font-black text-blue-700">v{updateInfo.version}</p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                    <p className="text-sm font-bold text-slate-800 mb-2">Chi tiết cập nhật:</p>
                    <div className="text-sm text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
                      {updateInfo.notes}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Đang tải bản cập nhật...</h3>
                    <p className="text-sm text-slate-500 mt-1">Phần mềm sẽ tự động khởi động lại sau khi tải xong.<br/>Vui lòng không tắt cửa sổ này.</p>
                  </div>
                </div>
              )}
            </div>
            
            {!isUpdating && (
              <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition"
                >
                  Để sau
                </button>
                <button
                  onClick={handleDoUpdate}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition flex items-center"
                >
                  <ArrowUpCircle className="w-4 h-4 mr-1.5" />
                  Cập nhật ngay
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isExporting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in duration-300">
            <div className="relative mb-6">
              <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Download className="w-6 h-6 text-blue-600 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Đang xuất dữ liệu</h3>
            <p className="text-sm text-slate-500">
              Vui lòng không tắt trình duyệt.<br/>
              Hệ thống đang tải và nén thư mục ảnh, quá trình này có thể mất một lúc tùy số lượng ảnh.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

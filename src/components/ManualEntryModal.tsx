import React, { useState, useRef, useCallback } from 'react';
import {
  X, Upload, PenLine, Calendar, Clock, MapPin, FileText, Car,
  CheckCircle2, Loader2, Images, AlertCircle, Trash2, Edit3
} from 'lucide-react';
import { formatLicensePlate } from '../utils/dataHelpers';
interface ImageItem {
  id: string;
  file: File;
  preview: string;
  plate: string; // override plate, empty = use global
}

interface ManualEntryModalProps {
  onClose: () => void;
  onSaved: (records: any[]) => void;
  uniquePlates?: string[];
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ onClose, onSaved, uniquePlates = [] }) => {
  const now = new Date();
  const todayDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Shared fields
  const [globalPlate, setGlobalPlate] = useState('');
  const [dateVal, setDateVal] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  );
  const [timeVal, setTimeVal] = useState(currentTime);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Image list
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [error, setError] = useState('');

  // Inline plate editing
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toFormattedDate = (val: string): string => {
    if (!val) return todayDate;
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  };

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    arr.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages(prev => [
          ...prev,
          {
            id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            file,
            preview: reader.result as string,
            plate: '',
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, []);

  const removeImage = (id: string) => setImages(prev => prev.filter(img => img.id !== id));
  const updatePlate = (id: string, plate: string) =>
    setImages(prev => prev.map(img => img.id === id ? { ...img, plate: plate.toUpperCase() } : img));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!globalPlate.trim() && images.every(img => !img.plate.trim())) {
      setError('Vui lòng nhập biển số xe (chung hoặc riêng cho từng ảnh).');
      return;
    }
    if (!dateVal || !timeVal) { setError('Vui lòng chọn ngày và giờ.'); return; }

    // If no images: save 1 record without image
    const hasImages = images.length > 0;
    const itemsToProcess = hasImages ? images : [null];

    setIsSubmitting(true);
    setSubmitProgress(0);

    const savedRecords: any[] = [];

    for (let i = 0; i < itemsToProcess.length; i++) {
      const imgItem = itemsToProcess[i];
      const plate = (imgItem?.plate?.trim() || globalPlate.trim()).toUpperCase();

      if (!plate) {
        // skip images that have no plate and no global plate
        setSubmitProgress(Math.round(((i + 1) / itemsToProcess.length) * 100));
        continue;
      }

      const payload: any = {
        licensePlate: plate,
        formattedDate: toFormattedDate(dateVal),
        formattedTime: timeVal,
        location: location.trim(),
        notes: notes.trim(),
      };

      if (imgItem) {
        payload.imageBase64 = imgItem.preview; // already base64
        payload.mimeType = imgItem.file.type || 'image/jpeg';
        payload.fileName = imgItem.file.name;
      }

      try {
        const res = await fetch('/api/records/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success && data.record) {
          savedRecords.push(data.record);
        }
      } catch (err) {
        console.error('Loi luu record:', err);
      }

      setSubmitProgress(Math.round(((i + 1) / itemsToProcess.length) * 100));
    }

    setIsSubmitting(false);

    if (savedRecords.length > 0) {
      onSaved(savedRecords);
    } else {
      setError('Không có bản ghi nào được lưu thành công. Vui lòng kiểm tra lại.');
    }
  };

  const totalToSave = images.length > 0 ? images.length : 1;
  const needsPlate = images.some(img => !img.plate.trim()) && !globalPlate.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <PenLine className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Nhập Thủ Công Hàng Loạt</h2>
              <p className="text-xs text-slate-500">
                Chọn nhiều ảnh cùng lúc, điền thông tin chung, ghi đè biển số riêng từng ảnh nếu cần
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

            {/* === SHARED FIELDS === */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin chung (áp dụng cho tất cả ảnh)</p>

              {/* Global plate */}
              <div>
                <label htmlFor="global-plate" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Car className="w-3.5 h-3.5 text-slate-400" />
                  Biển số xe chung&nbsp;
                  <span className="font-normal text-slate-400">(bỏ trống nếu mỗi ảnh khác nhau)</span>
                </label>
                <input
                  id="global-plate"
                  type="text"
                  value={globalPlate}
                  list="manual-unique-plates-list"
                  onChange={e => setGlobalPlate(e.target.value.toUpperCase())}
                  onBlur={e => setGlobalPlate(formatLicensePlate(e.target.value))}
                  placeholder="VD: 38A-755.25 — để trống nếu mỗi ảnh có biển số riêng"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition uppercase"
                  autoFocus
                />
                <datalist id="manual-unique-plates-list">
                  {uniquePlates.map((plate) => (
                    <React.Fragment key={plate}>
                      <option value={plate} />
                      <option value={plate.replace(/[^A-Z0-9]/ig, '')} />
                    </React.Fragment>
                  ))}
                </datalist>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="manual-date" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Ngày&nbsp;<span className="text-rose-500">*</span>
                  </label>
                  <input id="manual-date" type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition bg-white" />
                </div>
                <div>
                  <label htmlFor="manual-time" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Giờ:Phút&nbsp;<span className="text-rose-500">*</span>
                  </label>
                  <input id="manual-time" type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition bg-white" />
                </div>
              </div>

              {/* Location + Notes in a row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="manual-location" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Địa điểm&nbsp;<span className="font-normal text-slate-400">(tùy chọn)</span>
                  </label>
                  <input id="manual-location" type="text" value={location} onChange={e => setLocation(e.target.value)}
                    placeholder="VD: Hà Tĩnh, P. Vũng Áng"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition bg-white" />
                </div>
                <div>
                  <label htmlFor="manual-notes" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Ghi chú&nbsp;<span className="font-normal text-slate-400">(tùy chọn)</span>
                  </label>
                  <input id="manual-notes" type="text" value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Ghi chú chung..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition bg-white" />
                </div>
              </div>
            </div>

            {/* === IMAGE UPLOAD ZONE === */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Images className="w-3.5 h-3.5 text-slate-400" />
                  Ảnh đính kèm&nbsp;
                  <span className="font-normal text-slate-400">(tùy chọn — có thể chọn nhiều)</span>
                </label>
                {images.length > 0 && (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {images.length} ảnh
                  </span>
                )}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl cursor-pointer transition-all py-5 ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50/70 hover:border-blue-300 hover:bg-blue-50/40'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
                />
                <Upload className="w-5 h-5 text-slate-400" />
                <p className="text-xs text-slate-500 text-center">
                  Kéo nhiều ảnh vào đây hoặc <span className="text-blue-600 font-semibold underline">bấm để chọn</span>
                </p>
              </div>

              {/* Image grid */}
              {images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2.5">
                  {images.map(img => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={img.preview} alt={img.file.name} className="w-full h-24 object-cover" />

                      {/* Overlay actions */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(editingId === img.id ? null : img.id)}
                          className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition"
                          title="Đặt biển số riêng"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="w-7 h-7 bg-rose-600 rounded-full flex items-center justify-center text-white hover:bg-rose-700 transition"
                          title="Xóa ảnh"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Custom plate badge */}
                      {img.plate && (
                        <div className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none">
                          {img.plate}
                        </div>
                      )}

                      {/* Plate input when editing */}
                      {editingId === img.id && (
                        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-1.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={img.plate}
                            autoFocus
                            list="manual-unique-plates-list"
                            onChange={e => updatePlate(img.id, e.target.value.toUpperCase())}
                            onBlur={() => {
                              updatePlate(img.id, formatLicensePlate(img.plate));
                              setEditingId(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                updatePlate(img.id, formatLicensePlate(img.plate));
                                setEditingId(null);
                              }
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            placeholder={globalPlate || 'Biển số riêng'}
                            className="w-full border border-blue-300 rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-slate-800 uppercase focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hint about per-image plate */}
            {images.length > 1 && !globalPlate && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <span>Chưa có biển số chung. Hover vào từng ảnh và bấm <strong>✏️</strong> để nhập biển số riêng cho mỗi ảnh.</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">{error}</div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-white">
            <span className="text-xs text-slate-500">
              Sẽ lưu <strong className="text-slate-800">{totalToSave} bản ghi</strong>
              {images.length > 0 && globalPlate && <span className="text-slate-400"> • Biển số: <strong className="text-emerald-700">{globalPlate}</strong></span>}
            </span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} disabled={isSubmitting}
                className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50">
                Hủy
              </button>
              <button type="submit" disabled={isSubmitting} id="manual-entry-submit-btn"
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang lưu {submitProgress}%...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Lưu {totalToSave} Bản Ghi
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

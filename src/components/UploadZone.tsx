import React, { useRef, useState } from 'react';
import { Upload, Loader2, Sparkles, AlertCircle, PenLine, Bot, Edit3 } from 'lucide-react';
import { BatchProcessingProgress } from '../types';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onManualEntry: () => void;
  progress: BatchProcessingProgress;
  errors: Array<{ fileName: string; error: string }>;
  threshold?: number;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelected,
  onManualEntry,
  progress,
  errors,
  threshold = 4,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const allFiles = Array.from(e.dataTransfer.files);
      const validFiles = allFiles.filter((file: File) =>
        file.type.startsWith('image/')
      );
      if (validFiles.length < allFiles.length) {
        alert(`Đã bỏ qua ${allFiles.length - validFiles.length} file vì không phải là định dạng ảnh.`);
      }
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allFiles = Array.from(e.target.files);
      const validFiles = allFiles.filter((file: File) =>
        file.type.startsWith('image/')
      );
      if (validFiles.length < allFiles.length) {
        alert(`Đã bỏ qua ${allFiles.length - validFiles.length} file vì không phải là định dạng ảnh.`);
      }
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  return (
    <div className="mb-6 space-y-3 text-slate-800">
      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT: AI Upload Panel */}
        <div className="bg-white border border-blue-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-blue-900">Nhận Diện Tự Động (AI)</h2>
              <p className="text-[11px] text-blue-600 mt-0.5">
                AI tự trích xuất <strong>Biển Số</strong> &amp; <strong>Thời Gian</strong> từ ảnh • Cảnh báo nếu thiếu {threshold} ảnh/biển
              </p>
            </div>
          </div>

          {/* Drop Zone */}
          <div className="p-4 flex-1">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all h-full min-h-[120px] flex flex-col items-center justify-center ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                  : 'border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
              id="dropzone-area"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-3">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Kéo thả hàng loạt ảnh vào đây, hoặc <span className="text-blue-600 underline font-bold">bấm để chọn từ máy tính</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Trích xuất chính xác: Biển Kiểm Soát &amp; Mốc Thời Gian Timemark • Tự động cảnh báo biển số chưa đủ số ảnh
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: Manual Entry Panel */}
        <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm shrink-0">
              <Edit3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-emerald-900">Nhập Thủ Công</h2>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Tự tay điền Biển Số, Giờ, Ngày cho từng ảnh • Phù hợp khi AI nhận diện sai hoặc ảnh không rõ
              </p>
            </div>
          </div>

          {/* CTA Area - toàn bộ vùng có thể click */}
          <div
            onClick={onManualEntry}
            className="p-4 flex-1 flex flex-col items-center justify-center gap-4 min-h-[152px] cursor-pointer hover:bg-emerald-50/50 transition-colors"
          >
            <div className="text-center space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200">Bước 1</span>
                <span>Điền biển số &amp; thời gian</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200">Bước 2</span>
                <span>Tải ảnh lên (tuỳ chọn)</span>
              </div>
              <p className="text-xs text-slate-400">Hệ thống sẽ lưu ngay vào danh sách phân nhóm</p>
            </div>

            <button
              type="button"
              id="manual-entry-open-btn"
              className="flex items-center gap-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 py-3 text-sm font-black text-white transition shadow-sm hover:shadow-md pointer-events-none"
            >
              <PenLine className="w-5 h-5" />
              Mở Form Nhập Thủ Công
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar & Batch Status */}
      {progress.isProcessing && (
        <div className="p-4 bg-slate-900 text-white border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <div className="flex items-center text-blue-400 space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang xử lý AI: {progress.currentFileName}</span>
            </div>
            <span className="text-slate-300">
              {progress.completed} / {progress.total} ảnh ({Math.round((progress.completed / progress.total) * 100)}%)
            </span>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 rounded-full"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Errors list if any */}
      {errors.length > 0 && (
        <div className="p-3 bg-rose-950/50 border border-rose-800/50 rounded-xl">
          <div className="flex items-center space-x-2 text-rose-300 text-xs font-bold mb-1">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>Có {errors.length} file xảy ra lỗi khi nhận diện:</span>
          </div>
          <ul className="text-xs text-rose-200 list-disc list-inside space-y-0.5">
            {errors.map((err, idx) => (
              <li key={idx}>
                <span className="font-semibold">{err.fileName}:</span> {err.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

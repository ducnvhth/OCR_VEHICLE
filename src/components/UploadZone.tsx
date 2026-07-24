import React, { useRef, useState } from 'react';
import { Upload, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { BatchProcessingProgress } from '../types';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  progress: BatchProcessingProgress;
  errors: Array<{ fileName: string; error: string }>;
  threshold?: number;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelected,
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
      const validFiles = Array.from(e.dataTransfer.files).filter((file: File) =>
        file.type.startsWith('image/')
      );
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = Array.from(e.target.files).filter((file: File) =>
        file.type.startsWith('image/')
      );
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm mb-6 text-slate-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Tải Ảnh Nhận Diện AI & Thống Kê Theo Biển Số Xe
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            AI tự động trích xuất <strong>Biển Số Xe</strong> & <strong>Thời Gian</strong> từ từng ảnh, đếm tổng số ảnh của cùng một biển số và phát cảnh báo nếu chưa đủ chỉ tiêu (Mặc định: <strong>{threshold} ảnh</strong>).
          </p>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
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

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800">
              Kéo thả hàng loạt ảnh vào đây, hoặc <span className="text-blue-600 underline font-bold">bấm để chọn từ máy tính</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Trích xuất chính xác: Biển Kiểm Soát & Mốc Thời Gian Timemark • Tự động cảnh báo biển số chưa đủ số ảnh
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar & Batch Status */}
      {progress.isProcessing && (
        <div className="mt-4 p-4 bg-slate-900 text-white border border-slate-800 rounded-xl">
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
        <div className="mt-3 p-3 bg-rose-950/50 border border-rose-800/50 rounded-xl">
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

import React from 'react';
import { Truck, UploadCloud, Database, Download, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  totalRecords: number;
  totalVehicles: number;
  warningCount: number;
  threshold: number;
  onUploadClick: () => void;
  onUploadJournal: (file: File) => void;
  onExportExcel: () => void;
  onExportImages: () => void;
  onClearAll: () => void;
  hasApiKey: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalRecords,
  totalVehicles,
  warningCount,
  threshold,
  onUploadClick,
  onUploadJournal,
  onExportExcel,
  onExportImages,
  onClearAll,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleJournalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadJournal(e.target.files[0]);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between py-3 gap-3">
          
          {/* Brand & Logo */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-md shadow-blue-500/20">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base sm:text-lg font-black text-white tracking-tight uppercase">
                    THỐNG KÊ ẢNH THEO BIỂN SỐ XE
                  </h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Gemini AI
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Trích xuất Biển kiểm soát & Mốc thời gian • Cảnh báo số lượng ảnh theo chỉ tiêu ({threshold} ảnh)
                </p>
              </div>
            </div>

            {/* Status indicators */}
            <div className="hidden lg:flex items-center space-x-5 pl-6 border-l border-slate-800">
              <div className="text-center">
                <div className="text-[11px] font-medium text-slate-400">Tổng số ảnh</div>
                <div className="text-sm font-bold text-blue-400 font-mono">{totalRecords} ảnh</div>
              </div>
              <div className="text-center">
                <div className="text-[11px] font-medium text-slate-400">Số biển kiểm soát</div>
                <div className="text-sm font-bold text-emerald-400 font-mono">{totalVehicles} biển</div>
              </div>
              <div className="text-center">
                <div className="text-[11px] font-medium text-slate-400">Trạng thái cảnh báo</div>
                {warningCount > 0 ? (
                  <div className="text-xs font-bold text-rose-400 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {warningCount} biển thiếu ảnh
                  </div>
                ) : (
                  <div className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tất cả đã đạt
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center space-x-2 w-full md:w-auto justify-end overflow-visible pb-1 md:pb-0 shrink-0">
            <button
              onClick={onUploadClick}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm cursor-pointer shrink-0"
              id="btn-upload-nav"
            >
              <UploadCloud className="w-4 h-4 mr-1.5" />
              Tải Ảnh Lên
            </button>

            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleJournalChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm cursor-pointer shrink-0"
              id="btn-upload-journal"
              title="Upload file Nhật trình (Cột A: STT, Cột B: Biển số xe)"
            >
              <Database className="w-4 h-4 mr-1.5" />
              Tải Nhật Trình
            </button>

            {totalRecords > 0 && (
              <>
                <button
                  onClick={onExportExcel}
                  className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition cursor-pointer shrink-0"
                  id="btn-export-csv"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Xuất Báo Cáo Excel
                </button>

                <button
                  onClick={onExportImages}
                  className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition cursor-pointer shrink-0"
                  id="btn-export-images"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Xuất Folder Ảnh
                </button>

                <button
                  onClick={onClearAll}
                  className="inline-flex items-center px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-700 transition cursor-pointer shrink-0"
                  title="Xóa tất cả dữ liệu"
                  id="btn-clear-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

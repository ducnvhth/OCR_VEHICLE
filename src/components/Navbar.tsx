import React from 'react';
import { Truck, UploadCloud, Database, Download, Trash2, AlertTriangle, CheckCircle2, ArrowUpCircle } from 'lucide-react';

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
  isExporting?: boolean;
  updateInfo?: { available: boolean, url: string, version: string, notes: string } | null;
  onShowUpdate?: () => void;
  currentVersion?: string;
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
  isExporting = false,
  updateInfo = null,
  onShowUpdate,
  currentVersion,
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
              <div>
                <div className="flex items-center space-x-2 relative">
                  <h1 className="text-base sm:text-lg font-black text-white tracking-tight uppercase">
                    THỐNG KÊ SỐ LƯỢNG ẢNH THEO BIỂN SỐ XE
                  </h1>
                  {currentVersion && (
                    <span className="hidden sm:inline-block px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-mono font-bold rounded">
                      v{currentVersion}
                    </span>
                  )}
                  {updateInfo?.available && (
                    <button
                      onClick={onShowUpdate}
                      className="absolute -right-32 sm:-right-36 inline-flex items-center space-x-1 px-2 py-0.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/50 rounded-full text-[10px] font-bold transition animate-pulse cursor-pointer"
                      title="Có phiên bản mới"
                    >
                      <ArrowUpCircle className="w-3 h-3" />
                      <span>Cập nhật (v{updateInfo.version})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status indicators */}
            <div className="hidden lg:flex items-center space-x-5 pl-6 border-l border-slate-800">
              <div className="text-center">
                <div className="text-[11px] font-medium text-slate-400">Tổng số ảnh</div>
                <div className="text-sm font-bold text-blue-400 font-mono">{totalRecords}</div>
              </div>
              <div className="text-center">
                <div className="text-[11px] font-medium text-slate-400">Số biển kiểm soát</div>
                <div className="text-sm font-bold text-emerald-400 font-mono">{totalVehicles}</div>
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
                  disabled={isExporting}
                  className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  id="btn-export-images"
                >
                  {isExporting ? (
                    <>
                      <Download className="w-4 h-4 mr-1.5 animate-spin" />
                      Đang nén file...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1.5" />
                      Xuất Folder Ảnh
                    </>
                  )}
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

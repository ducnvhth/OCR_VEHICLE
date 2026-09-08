import React from 'react';
import { Download, Trash2, AlertTriangle, CheckCircle2, ArrowUpCircle, Image, Layers } from 'lucide-react';

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
  onExportExcel,
  onExportImages,
  onClearAll,
  isExporting = false,
  updateInfo = null,
  onShowUpdate,
  currentVersion,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#0d1117] border-b border-slate-800/80 text-slate-100 shadow-xl">
      <div className="max-w-[1600px] mx-auto px-5">
        <div className="flex items-center justify-between h-14 gap-4">

          {/* LEFT: Brand */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Icon Mark */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
              <Layers className="w-4 h-4 text-white" />
            </div>

            <div className="flex flex-col">
              <span className="text-[13px] font-black text-white tracking-wide uppercase leading-tight">
                Thống kê ảnh biển số xe
              </span>
              <div className="flex items-center gap-2">
                {currentVersion && (
                  <span className="text-[10px] font-mono font-semibold text-slate-500">
                    v{currentVersion}
                  </span>
                )}
                {updateInfo?.available && (
                  <button
                    onClick={onShowUpdate}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/40 rounded text-[9px] font-bold transition-all animate-pulse cursor-pointer"
                    title="Có phiên bản mới"
                  >
                    <ArrowUpCircle className="w-2.5 h-2.5" />
                    Cập nhật v{updateInfo.version}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* CENTER: Stats */}
          <div className="flex items-center gap-1 flex-1 justify-center">
            {/* Total Images */}
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Image className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-0.5">Tổng Ảnh</p>
                <p className="text-base font-black text-blue-400 font-mono leading-none">{totalRecords}</p>
              </div>
            </div>

            <div className="w-px h-8 bg-slate-700/50" />

            {/* Total Plates */}
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-0.5">Số Biển</p>
                <p className="text-base font-black text-emerald-400 font-mono leading-none">{totalVehicles}</p>
              </div>
            </div>

            <div className="w-px h-8 bg-slate-700/50" />

            {/* Warning Status */}
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              {warningCount > 0 ? (
                <>
                  <div className="w-6 h-6 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-0.5">Cảnh Báo</p>
                    <p className="text-base font-black text-rose-400 font-mono leading-none">{warningCount} biển</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-0.5">Trạng Thái</p>
                    <p className="text-[11px] font-black text-emerald-400 leading-none">Đạt tiêu chuẩn</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: Actions */}
          {totalRecords > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-600/30 hover:border-emerald-600 transition-all cursor-pointer"
                id="btn-export-csv"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất Excel
              </button>

              <button
                onClick={onExportImages}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/30 hover:border-blue-600 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                id="btn-export-images"
              >
                {isExporting ? (
                  <>
                    <Download className="w-3.5 h-3.5 animate-bounce" />
                    Đang nén...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Xuất Ảnh
                  </>
                )}
              </button>

              <div className="w-px h-6 bg-slate-700/60" />

              <button
                onClick={onClearAll}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                title="Xóa tất cả dữ liệu"
                id="btn-clear-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

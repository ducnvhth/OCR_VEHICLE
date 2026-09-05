import React from 'react';
import { GroupedVehicle, ExtractionRecord } from '../types';
import { AlertTriangle, CheckCircle2, Clock, Maximize2, Trash2, Calendar, FileText, Edit3, Copy } from 'lucide-react';

interface VehicleGroupCardProps {
  group: GroupedVehicle;
  onSelectRecord: (record: ExtractionRecord, groupTotal: number, contextList?: ExtractionRecord[]) => void;
  onDeleteRecord?: (id: string) => void;
  onDeleteGroup?: (recordIds: string[], plate: string, tripIdx: number) => void;
}

export const VehicleGroupCard: React.FC<VehicleGroupCardProps> = ({
  group,
  onSelectRecord,
  onDeleteRecord,
  onDeleteGroup,
}) => {
  const { licensePlate, records, photoCount, isWarning, requiredCount, missingCount, latestTimestamp, earliestTimestamp, tripIndex, totalTrips } = group;

  const [isCopying, setIsCopying] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCopyImages = async () => {
    setIsCopying(true);
    try {
      const images = await Promise.all(records.map(rec => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = rec.imageSrc;
        });
      }));

      if (images.length === 0) {
        setIsCopying(false);
        return;
      }

      const gap = 10;
      const maxWidth = Math.max(...images.map(img => img.width));
      const totalHeight = images.reduce((acc, img) => acc + img.height, 0) + gap * (images.length - 1);

      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("No context");

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let currentY = 0;
      images.forEach(img => {
        const x = (maxWidth - img.width) / 2;
        ctx.drawImage(img, x, currentY);
        currentY += img.height + gap;
      });

      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            const item = new ClipboardItem({ "image/png": blob });
            await navigator.clipboard.write([item]);
            showToast("Đã copy ảnh tổng hợp vào Clipboard!");
          } catch (err) {
            console.error("Lỗi clipboard:", err);
            showToast("Trình duyệt không hỗ trợ hoặc chưa cấp quyền!");
          }
        }
        setIsCopying(false);
      }, 'image/png');

    } catch (error) {
      console.error("Lỗi khi gộp ảnh:", error);
      showToast("Có lỗi xảy ra khi tạo ảnh tổng hợp.");
      setIsCopying(false);
    }
  };

  const handleCopyPlate = () => {
    navigator.clipboard.writeText(licensePlate).then(() => {
      showToast("Đã copy biển số: " + licensePlate);
    }).catch(err => console.error("Lỗi copy text:", err));
  };

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition hover:shadow-md ${
      isWarning ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
    }`}>
      {/* Group Header */}
      <div className={`p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isWarning ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center space-x-3">
          <div 
            className="bg-amber-400 text-slate-950 font-black font-mono text-xl sm:text-2xl px-3.5 py-1 rounded-xl border border-slate-900 shadow-sm shrink-0 cursor-pointer hover:bg-amber-300 transition"
            onClick={handleCopyPlate}
            title="Click để copy biển số"
          >
            {licensePlate}
          </div>
          <button 
            onClick={handleCopyImages} 
            disabled={isCopying}
            className="p-2 bg-white hover:bg-blue-50 text-blue-600 rounded-lg border border-slate-200 hover:border-blue-300 transition disabled:opacity-50 flex items-center justify-center shadow-sm shrink-0" 
            title="Gộp và copy tất cả ảnh vào Clipboard"
          >
            {isCopying ? <Clock className="w-5 h-5 animate-spin" /> : <Copy className="w-5 h-5" />}
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm sm:text-base">Biển kiểm soát</span>

              {/* Trip Badge */}
              {totalTrips > 1 && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black border flex items-center gap-1.5 shadow-xs ${
                    tripIndex === 1 ? 'bg-violet-100 text-violet-800 border-violet-300' :
                    tripIndex === 2 ? 'bg-sky-100 text-sky-800 border-sky-300' :
                    tripIndex === 3 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                    'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  🔄 LƯỢT {tripIndex} / {totalTrips} LƯỢT
                </span>
              )}

              {/* Alert / Compliance Badge */}
              {isWarning ? (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold border border-rose-300 flex items-center gap-1.5 shadow-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  CẢNH BÁO: Mới có {photoCount}/{requiredCount} ảnh (Thiếu {missingCount} ảnh)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ĐẠT CHỈ TIÊU ({photoCount}/{requiredCount} ảnh)
                </span>
              )}

              {/* Group Edited Badge */}
              {records.some(r => r.isEdited) && (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-300 flex items-center gap-1.5 shadow-xs" title="Nhóm này chứa ít nhất một ảnh đã được kiểm duyệt/sửa tay">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  ĐÃ CẬP NHẬT
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {earliestTimestamp !== latestTimestamp
                  ? <><strong>{earliestTimestamp}</strong> → <strong>{latestTimestamp}</strong></>
                  : <strong>{latestTimestamp}</strong>
                }
              </span>
            </p>
          </div>
        </div>

        {/* Group Quick Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Tổng số ảnh</span>
            <span className="font-mono font-black text-slate-900 text-lg">{photoCount} Ảnh</span>
          </div>

          {onDeleteGroup && (
            <button
              onClick={() => onDeleteGroup(records.map(r => r.id), licensePlate, tripIndex)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
              title={`Xóa lượt ${tripIndex} của biển số này`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Group Photos Grid / List */}
      <div className="p-4 sm:p-5">
        <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          Danh sách {photoCount} ảnh thuộc biển số {licensePlate}:
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {records.map((rec, idx) => (
            <div
              key={rec.id}
              onClick={() => onSelectRecord(rec, photoCount, records)}
              className="group relative bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-xl p-2.5 transition duration-200 cursor-pointer hover:shadow-md flex flex-col justify-between"
            >
              {/* Photo Thumbnail */}
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-900 border border-slate-200 mb-2">
                <img
                  src={rec.imageSrc}
                  alt={rec.licensePlate}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                
                {/* Index badge */}
                <span className="absolute top-1.5 left-1.5 bg-slate-900/80 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur">
                  #{idx + 1}
                </span>

                {/* Hover zoom icon */}
                <div className="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 text-white font-medium text-xs">
                  <Maximize2 className="w-4 h-4" />
                  <span>Zoom / Chi tiết</span>
                </div>
              </div>

              {/* Photo Details: Time & License Plate */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-900 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded text-[11px] flex items-center gap-1">
                    {rec.licensePlate}
                    {rec.isEdited && <Edit3 className="w-3 h-3 text-blue-600" title="Đã chỉnh sửa thủ công" />}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-600">
                    {rec.confidence}% AI
                  </span>
                </div>

                <div className="flex items-center gap-1 text-slate-700 font-semibold text-[11px]">
                  <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>{rec.timestamp}</span>
                </div>

                {rec.fileName && (
                  <p className="text-[10px] text-slate-400 truncate" title={rec.fileName}>
                    {rec.fileName}
                  </p>
                )}
              </div>

              {/* Delete single record */}
              {onDeleteRecord && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRecord(rec.id);
                  }}
                  className="absolute top-3 right-3 p-1.5 bg-white/90 hover:bg-rose-600 text-slate-600 hover:text-white rounded-lg shadow-sm transition opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Xóa ảnh này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 text-sm font-semibold border border-slate-700 transition-opacity duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          {toastMsg}
        </div>
      )}
    </div>
  );
}

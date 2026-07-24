import React from 'react';
import { GroupedVehicle, ExtractionRecord } from '../types';
import { AlertTriangle, CheckCircle2, Clock, Maximize2, Trash2, Calendar, FileText } from 'lucide-react';

interface VehicleGroupCardProps {
  group: GroupedVehicle;
  onSelectRecord: (record: ExtractionRecord, groupTotal: number) => void;
  onDeleteRecord?: (id: string) => void;
  onDeleteGroup?: (plate: string) => void;
}

export const VehicleGroupCard: React.FC<VehicleGroupCardProps> = ({
  group,
  onSelectRecord,
  onDeleteRecord,
  onDeleteGroup,
}) => {
  const { licensePlate, records, photoCount, isWarning, requiredCount, missingCount, latestTimestamp } = group;

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition hover:shadow-md ${
      isWarning ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
    }`}>
      {/* Group Header */}
      <div className={`p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isWarning ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center space-x-3">
          <div className="bg-amber-400 text-slate-950 font-black font-mono text-xl sm:text-2xl px-3.5 py-1 rounded-xl border border-slate-900 shadow-sm shrink-0">
            {licensePlate}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm sm:text-base">Biển kiểm soát</span>
              
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
            </div>
            
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Ảnh mới nhất: <strong>{latestTimestamp}</strong>
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
              onClick={() => onDeleteGroup(licensePlate)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
              title="Xóa tất cả ảnh của biển số này"
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
              onClick={() => onSelectRecord(rec, photoCount)}
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
                  <span className="font-mono font-bold text-amber-900 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded text-[11px]">
                    {rec.licensePlate}
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
    </div>
  );
}

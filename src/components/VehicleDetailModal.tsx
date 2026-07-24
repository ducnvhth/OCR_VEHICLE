import React, { useState, useRef, useEffect } from 'react';
import { ExtractionRecord } from '../types';
import { X, ZoomIn, ZoomOut, RotateCcw, Clock, Truck, MapPin, FileText, CheckCircle2, AlertTriangle, Edit2, Save } from 'lucide-react';

interface VehicleDetailModalProps {
  record: ExtractionRecord | null;
  onClose: () => void;
  onSave?: (updated: ExtractionRecord) => void;
  requiredCount?: number;
  totalForPlate?: number;
  uniquePlates?: string[];
}

export function VehicleDetailModal({ record, onClose, onSave, requiredCount = 4, totalForPlate = 1, uniquePlates = [] }: VehicleDetailModalProps) {
  if (!record) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ExtractionRecord>({ ...record });

  // Zoom and Pan states
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFormData({ ...record });
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  }, [record]);

  // Handle Mouse Wheel Zooming
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 0.25;
    let newZoom = zoomLevel;

    if (e.deltaY < 0) {
      // Zoom in
      newZoom = Math.min(zoomLevel + zoomFactor, 5);
    } else {
      // Zoom out
      newZoom = Math.max(zoomLevel - zoomFactor, 1);
    }

    setZoomLevel(newZoom);
    if (newZoom === 1) {
      setPanPosition({ x: 0, y: 0 });
    }
  };

  // Handle Dragging for Pan
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || zoomLevel <= 1) return;
    setPanPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      onSave({ ...formData, isEdited: true });
    }
    setIsEditing(false);
  };

  const isWarning = totalForPlate < requiredCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col text-slate-800">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-400 text-slate-950 font-black font-mono text-lg px-3 py-1 rounded-lg border border-slate-950 shadow-sm">
              {formData.licensePlate}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Chi Tiết Trích Xuất Ảnh</h3>
                {isWarning ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    Mới có {totalForPlate}/{requiredCount} ảnh
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Đạt chỉ tiêu ({totalForPlate}/{requiredCount} ảnh)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                File: {formData.fileName} • Độ tin cậy AI: <span className="text-blue-600 font-bold">{formData.confidence}%</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-600 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Sửa thông tin
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
              >
                Hủy sửa
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          
          {/* Left: Image Container with Mouse-Wheel Zoom */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 px-1">
              <span className="font-semibold flex items-center gap-1.5 text-blue-700">
                <ZoomIn className="w-4 h-4" />
                Lăn con trỏ chuột (Scroll Wheel) trên ảnh để Zoom
              </span>
              <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono font-bold text-slate-700">
                Tỷ lệ: {Math.round(zoomLevel * 100)}%
              </span>
            </div>

            {/* Interactive Zoom Viewport */}
            <div
              ref={imageContainerRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`relative rounded-xl overflow-hidden border border-slate-300 bg-slate-900 aspect-[4/3] flex items-center justify-center select-none ${
                zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'
              }`}
            >
              <div
                style={{
                  transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                  transformOrigin: 'center center',
                }}
                className="w-full h-full flex items-center justify-center"
              >
                <img
                  src={formData.imageSrc}
                  alt={formData.licensePlate}
                  className="max-w-full max-h-full object-contain pointer-events-none"
                />
              </div>

              {/* Watermark Tag */}
              <span className="absolute top-3 left-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-md text-xs font-mono font-bold text-amber-400 shadow-md">
                {formData.licensePlate}
              </span>

              {/* Zoom Controls Overlay Bar */}
              <div className="absolute bottom-3 right-3 flex items-center bg-slate-900/85 backdrop-blur border border-slate-700 rounded-xl p-1 shadow-lg space-x-1 text-white">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-40 rounded-lg text-slate-200 transition cursor-pointer"
                  title="Thu nhỏ (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 5}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-40 rounded-lg text-slate-200 transition cursor-pointer"
                  title="Phóng to (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="h-4 w-[1px] bg-slate-700 mx-1" />
                <button
                  onClick={handleResetZoom}
                  className="px-2 py-1 hover:bg-slate-800 rounded-lg text-[11px] font-mono font-bold text-amber-400 transition cursor-pointer flex items-center gap-1"
                  title="Khôi phục 100%"
                >
                  <RotateCcw className="w-3 h-3" />
                  100%
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center italic">
              💡 Mẹo: Lăn chuột để kiểm tra từng ký tự trên biển số xe và mốc thời gian hiển thị trên watermark.
            </p>
          </div>

          {/* Right: Extracted Data Fields */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            {!isEditing ? (
              <div className="space-y-4">
                
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                  
                  {/* License Plate Field */}
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                    <span className="text-slate-600 font-medium flex items-center gap-2 text-xs">
                      <Truck className="w-4 h-4 text-blue-600" />
                      Biển kiểm soát:
                    </span>
                    <span className="font-mono font-black text-slate-900 text-base bg-amber-300 px-2.5 py-0.5 rounded border border-slate-900 shadow-xs">
                      {formData.licensePlate}
                    </span>
                  </div>

                  {/* Timestamp Field */}
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                    <span className="text-slate-600 font-medium flex items-center gap-2 text-xs">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Thời gian trích xuất:
                    </span>
                    <span className="font-bold text-slate-800 text-sm">{formData.timestamp}</span>
                  </div>

                  {/* Location Field if available */}
                  {formData.location && (
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                      <span className="text-slate-600 font-medium flex items-center gap-2 text-xs">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        Vị trí / Địa điểm:
                      </span>
                      <span className="font-semibold text-slate-800 text-right">{formData.location}</span>
                    </div>
                  )}

                  {/* Total Photos for this plate */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium flex items-center gap-2 text-xs">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Tổng số ảnh của biển số này:
                    </span>
                    <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${isWarning ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                      {totalForPlate} / {requiredCount} ảnh
                    </span>
                  </div>

                </div>

                {/* Notes box */}
                {formData.notes && (
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-xs">
                    <span className="text-blue-900 font-bold block mb-1">Ghi chú AI:</span>
                    <p className="text-slate-700 leading-relaxed">{formData.notes}</p>
                  </div>
                )}

                {/* Alert explanation box */}
                {isWarning && (
                  <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-rose-700">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Cảnh Báo Chưa Đủ Số Lượng Ảnh!
                    </div>
                    <p className="text-rose-600 leading-relaxed">
                      Cấu hình thiết lập yêu cầu tối thiểu <strong>{requiredCount} ảnh</strong> cho mỗi biển số. Hiện tại biển số <strong>{formData.licensePlate}</strong> mới chỉ có <strong>{totalForPlate} ảnh</strong> (thiếu {requiredCount - totalForPlate} ảnh).
                    </p>
                  </div>
                )}

              </div>
            ) : (
              /* Editing Form */
              <form onSubmit={handleSubmit} className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-2 text-sm">Chỉnh Sửa Dữ Liệu Khớp Ảnh</h4>
                
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Biển Số Xe</label>
                  <input
                    type="text"
                    value={formData.licensePlate}
                    list="unique-plates-list"
                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                  <datalist id="unique-plates-list">
                    {uniquePlates.map((plate) => (
                      <option key={plate} value={plate} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Giờ (HH:mm)</label>
                    <input
                      type="text"
                      value={formData.formattedTime}
                      onChange={(e) => {
                        const newTime = e.target.value;
                        setFormData({
                          ...formData,
                          formattedTime: newTime,
                          timestamp: `${newTime} ${formData.formattedDate}`,
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Ngày (DD/MM/YYYY)</label>
                    <input
                      type="text"
                      value={formData.formattedDate}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setFormData({
                          ...formData,
                          formattedDate: newDate,
                          timestamp: `${formData.formattedTime} ${newDate}`,
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vị Trí / Địa Điểm</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Ghi Chú</label>
                  <textarea
                    rows={2}
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    Lưu Thay Đổi
                  </button>
                </div>
              </form>
            )}

            <div className="pt-4 border-t border-slate-200 mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Đã xử lý lúc: {formData.processedAt}</span>
              {formData.isEdited && <span className="text-amber-600 font-semibold">Đã chỉnh sửa thủ công</span>}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

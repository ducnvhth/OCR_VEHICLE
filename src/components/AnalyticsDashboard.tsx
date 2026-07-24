import React from 'react';
import { calculateSystemStats } from '../utils/dataHelpers';
import { ExtractionRecord } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
} from 'recharts';
import { FileImage, Truck, AlertTriangle, CheckCircle2, ShieldCheck, Filter } from 'lucide-react';

interface AnalyticsDashboardProps {
  records: ExtractionRecord[];
  threshold: number;
  onThresholdChange: (val: number) => void;
}

export function AnalyticsDashboard({ records, threshold, onThresholdChange }: AnalyticsDashboardProps) {
  const stats = calculateSystemStats(records, threshold);

  return (
    <div className="space-y-6">
      
      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Photos */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Số Ảnh</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{stats.totalRecords}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Ảnh đã trích xuất dữ liệu</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <FileImage className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Total Unique License Plates */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Số Biển Kiểm Soát</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{stats.totalUniqueVehicles}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Các biển số khác nhau</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Compliant Plates */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đạt Chỉ Tiêu (≥{threshold} ảnh)</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1 font-mono">{stats.compliantPlatesCount}</h3>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Biển số có đủ số lượng ảnh</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Warning Plates */}
        <div className={`bg-white border rounded-2xl p-5 shadow-sm flex items-center justify-between ${
          stats.warningPlatesCount > 0 ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
        }`}>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cảnh Báo Thiếu Ảnh (&lt;{threshold} ảnh)</p>
            <h3 className={`text-2xl font-black mt-1 font-mono ${stats.warningPlatesCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {stats.warningPlatesCount}
            </h3>
            <p className="text-[11px] text-rose-500 font-medium mt-0.5">Biển số chưa đạt chỉ tiêu</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
            stats.warningPlatesCount > 0 ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Threshold Control Bar in Analytics */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Cấu Hình Ngưỡng Cảnh Báo Số Lượng Ảnh</h4>
            <p className="text-xs text-slate-500">Mỗi biển kiểm soát phải có tối thiểu bao nhiêu ảnh thì mới coi là đạt?</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
          <span className="text-xs font-bold text-slate-700">Chỉ tiêu tối thiểu:</span>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => onThresholdChange(Math.max(1, threshold - 1))}
              className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-bold text-slate-700 text-xs flex items-center justify-center cursor-pointer shadow-xs"
            >
              -
            </button>
            <span className="font-mono font-black text-slate-900 text-base px-2">
              {threshold}
            </span>
            <button
              onClick={() => onThresholdChange(threshold + 1)}
              className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-bold text-slate-700 text-xs flex items-center justify-center cursor-pointer shadow-xs"
            >
              +
            </button>
          </div>
          <span className="text-xs text-slate-500 font-medium">ảnh / biển số</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Photo counts per vehicle plate */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Biểu Đồ Số Lượng Ảnh Theo Biển Kiểm Soát</h4>
              <p className="text-xs text-slate-500">Đường đỏ thể hiện ngưỡng chỉ tiêu tối thiểu ({threshold} ảnh)</p>
            </div>
            <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-700">
              {stats.totalUniqueVehicles} biển số
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.photosPerVehicleChart} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} interval={0} angle={-25} textAnchor="end" />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px' }}
                />
                <ReferenceLine y={threshold} label={`Tối thiểu ${threshold}`} stroke="#f43f5e" strokeDasharray="4 4" strokeWidth={2} />
                <Bar dataKey="Số lượng ảnh" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Compliance Ratio */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="mb-2">
            <h4 className="text-sm font-bold text-slate-900">Tỷ Lệ Đạt Cảnh Báo</h4>
            <p className="text-xs text-slate-500">Thống kê biển số đạt vs thiếu ảnh</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {stats.complianceDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.complianceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {stats.complianceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">Chưa có dữ liệu</p>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 mt-2">
            <div className="flex justify-between items-center mb-1">
              <span>Biển số đạt chỉ tiêu:</span>
              <strong className="text-emerald-600 font-mono">{stats.compliantPlatesCount}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span>Biển số cần bổ sung ảnh:</span>
              <strong className="text-rose-600 font-mono">{stats.warningPlatesCount}</strong>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

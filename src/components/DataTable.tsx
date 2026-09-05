import React, { useState, useMemo } from 'react';
import { ExtractionRecord } from '../types';
import { Search, Trash2, Edit3, Maximize2, AlertTriangle, CheckCircle2, Clock, Truck, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

type SortField = 'licensePlate' | 'timestamp' | 'fileName' | 'confidence' | 'count';
type SortDirection = 'asc' | 'desc';

interface DataTableProps {
  records: ExtractionRecord[];
  onSelectRecord: (record: ExtractionRecord, contextList?: ExtractionRecord[]) => void;
  onEditRecord: (record: ExtractionRecord, contextList?: ExtractionRecord[]) => void;
  onDeleteRecord: (id: string) => void;
  onBatchDelete: (ids: string[]) => void;
  requiredCount?: number;
}

export function DataTable({
  records,
  onSelectRecord,
  onEditRecord,
  onDeleteRecord,
  onBatchDelete,
  requiredCount = 4,
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Count photos for each plate
  const plateCounts = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const plate = r.licensePlate.trim().toUpperCase() || 'CHƯA RÕ BIỂN SỐ';
      map.set(plate, (map.get(plate) || 0) + 1);
    });
    return map;
  }, [records]);

  // Filter & Sort records
  const filteredRecords = useMemo(() => {
    let result = records.filter((r) => {
      const plate = r.licensePlate.trim().toUpperCase();
      const count = plateCounts.get(plate) || 0;
      const isWarning = count < requiredCount;

      if (selectedStatus === 'warning' && !isWarning) return false;
      if (selectedStatus === 'compliant' && isWarning) return false;

      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      return (
        r.licensePlate.toLowerCase().includes(term) ||
        r.timestamp.toLowerCase().includes(term) ||
        r.fileName.toLowerCase().includes(term) ||
        (r.location && r.location.toLowerCase().includes(term))
      );
    });

    result = result.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'count') {
        aValue = plateCounts.get(a.licensePlate.trim().toUpperCase()) || 0;
        bValue = plateCounts.get(b.licensePlate.trim().toUpperCase()) || 0;
      } else if (sortField === 'timestamp') {
        aValue = new Date(a.parsedDateISO).getTime() || 0;
        bValue = new Date(b.parsedDateISO).getTime() || 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [records, searchTerm, selectedStatus, plateCounts, requiredCount, sortField, sortDirection]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredRecords.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600 ml-1" /> : <ArrowDown className="w-3 h-3 text-blue-600 ml-1" />;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      
      {/* Table Filters & Header */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Search & Filter */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo biển số, thời gian, tên file..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shrink-0"
          >
            <option value="all">Tất cả ảnh</option>
            <option value="warning">⚠️ Cảnh báo: Biển số chưa đủ {requiredCount} ảnh</option>
            <option value="compliant">✅ Đạt chỉ tiêu: Đã đủ {requiredCount} ảnh</option>
          </select>
        </div>

        {/* Batch Actions & Count */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                onBatchDelete(selectedIds);
                setSelectedIds([]);
              }}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa ({selectedIds.length})</span>
            </button>
          )}

          <span className="text-xs text-slate-500">
            Hiển thị <strong>{filteredRecords.length}</strong> / {records.length} bản ghi
          </span>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === filteredRecords.length}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-200 select-none transition" onClick={() => handleSort('licensePlate')}>
                <div className="flex items-center">Biển kiểm soát {renderSortIcon('licensePlate')}</div>
              </th>
              <th className="p-3">Ảnh thu nhỏ</th>
              <th className="p-3 cursor-pointer hover:bg-slate-200 select-none transition" onClick={() => handleSort('timestamp')}>
                <div className="flex items-center">Thời gian {renderSortIcon('timestamp')}</div>
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-200 select-none transition" onClick={() => handleSort('fileName')}>
                <div className="flex items-center">Tên File {renderSortIcon('fileName')}</div>
              </th>
              <th className="p-3 text-center cursor-pointer hover:bg-slate-200 select-none transition" onClick={() => handleSort('count')}>
                <div className="flex items-center justify-center">Tổng ảnh {renderSortIcon('count')}</div>
              </th>
              <th className="p-3 text-center">Trạng thái Cảnh báo</th>
              <th className="p-3 text-center cursor-pointer hover:bg-slate-200 select-none transition" onClick={() => handleSort('confidence')}>
                <div className="flex items-center justify-center">Độ tin cậy AI {renderSortIcon('confidence')}</div>
              </th>
              <th className="p-3 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                  Không tìm thấy bản ghi nào phù hợp
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => {
                const plate = rec.licensePlate.trim().toUpperCase();
                const count = plateCounts.get(plate) || 1;
                const isWarning = count < requiredCount;

                return (
                  <tr key={rec.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(rec.id)}
                        onChange={() => handleSelectOne(rec.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>

                    <td className="p-3 font-mono font-bold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-amber-400 text-slate-950 font-black px-2.5 py-0.5 rounded text-xs border border-slate-900 shadow-xs">
                          {rec.licensePlate}
                        </span>
                        {rec.isEdited && (
                          <span className="bg-blue-100 text-blue-700 p-0.5 rounded shadow-sm border border-blue-200" title="Đã chỉnh sửa thủ công">
                            <Edit3 className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <div
                        onClick={() => onSelectRecord(rec, filteredRecords)}
                        className="w-14 h-11 bg-slate-100 border border-slate-200 rounded overflow-hidden cursor-pointer hover:opacity-80 transition relative group"
                        title="Click để phóng to ảnh"
                      >
                        <img src={rec.imageSrc} alt={rec.licensePlate} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-blue-600/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        {rec.timestamp}
                      </div>
                    </td>

                    <td className="p-3 max-w-[180px] truncate text-slate-600 font-mono text-[11px]" title={rec.fileName}>
                      {rec.fileName}
                    </td>

                    <td className="p-3 text-center font-mono font-bold text-slate-800">
                      {count} ảnh
                    </td>

                    <td className="p-3 text-center">
                      {isWarning ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Mới có {count}/{requiredCount} ảnh
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Đạt chỉ tiêu
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <span className="font-mono font-bold text-blue-600">
                        {rec.confidence}%
                      </span>
                    </td>

                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => onSelectRecord(rec, filteredRecords)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition cursor-pointer"
                          title="Xem phóng to & zoom"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEditRecord(rec, filteredRecords)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition cursor-pointer"
                          title="Chỉnh sửa thủ công"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteRecord(rec.id)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-rose-600 transition cursor-pointer"
                          title="Xóa ảnh này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

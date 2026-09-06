import React, { useState, useMemo } from 'react';
import { JournalEntry } from '../types';
import { Plus, Trash2, Edit2, Save, X, Database, Download, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { formatLicensePlate } from '../utils/dataHelpers';

interface JournalManagerProps {
  journalEntries: JournalEntry[];
  onAdd: (entry: Partial<JournalEntry>) => void;
  onUpdate: (id: string, entry: Partial<JournalEntry>) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onExport: (sortedEntries?: any[]) => void;
  onBatchUpdateStt: (updates: { id: string; stt: string }[]) => void;
  groupedVehicles?: any[];
}

export const JournalManager: React.FC<JournalManagerProps> = ({
  journalEntries,
  onAdd,
  onUpdate,
  onDelete,
  onDeleteAll,
  onExport,
  onBatchUpdateStt,
  groupedVehicles = [],
}) => {
  type SortKey = 'stt' | 'licensePlate' | 'date' | 'time' | 'photoCount';
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ stt: string; licensePlate: string }>({ stt: '', licensePlate: '' });
  
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<{ stt: string; licensePlate: string }>({ stt: '', licensePlate: '' });

  const handleStartAdding = () => {
    let nextStt = 1;
    if (journalEntries.length > 0) {
      const maxStt = Math.max(...journalEntries.map(e => parseInt(e.stt, 10) || 0));
      nextStt = maxStt + 1;
    }
    setAddForm({ stt: nextStt.toString(), licensePlate: '' });
    setIsAdding(true);
  };

  const enrichedEntries = useMemo(() => {
    return journalEntries.map((entry) => {
      const tripsForPlate = groupedVehicles.filter(g => g.licensePlate === entry.licensePlate);
      const allEntriesForPlate = journalEntries.filter(e => e.licensePlate === entry.licensePlate);
      const entryIndex = allEntriesForPlate.findIndex(e => e.id === entry.id);

      let dateStr = '-';
      let timeStr = '-';
      let parsedDateISO = '';
      let photoCount = 0;
      let requiredCount = 0;
      let isWarning = false;

      if (entryIndex >= 0 && entryIndex < tripsForPlate.length) {
        const trip = tripsForPlate[entryIndex];
        const earliestRec = trip.records[trip.records.length - 1]; // newest-first sorting in dataHelpers
        if (earliestRec) {
          dateStr = earliestRec.formattedDate;
          timeStr = earliestRec.formattedTime;
          parsedDateISO = earliestRec.parsedDateISO;
        }
        photoCount = trip.photoCount;
        requiredCount = trip.requiredCount;
        isWarning = trip.isWarning;
      }

      return {
        ...entry,
        dateStr,
        timeStr,
        parsedDateISO,
        photoCount,
        requiredCount,
        isWarning
      };
    });
  }, [journalEntries, groupedVehicles]);

  const sortedEntries = useMemo(() => {
    const sortableItems = [...enrichedEntries];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'stt') {
          const aStt = parseInt(a.stt, 10) || 0;
          const bStt = parseInt(b.stt, 10) || 0;
          return sortConfig.direction === 'asc' ? aStt - bStt : bStt - aStt;
        }
        if (sortConfig.key === 'licensePlate') {
          const aVal = a.licensePlate;
          const bVal = b.licensePlate;
          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }
        if (sortConfig.key === 'date' || sortConfig.key === 'time') {
          const aTime = new Date(a.parsedDateISO || 0).getTime();
          const bTime = new Date(b.parsedDateISO || 0).getTime();
          return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
        }
        if (sortConfig.key === 'photoCount') {
          return sortConfig.direction === 'asc' ? a.photoCount - b.photoCount : b.photoCount - a.photoCount;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [enrichedEntries, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) return <ChevronUp className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-3 h-3 text-blue-600" />
      : <ChevronDown className="w-3 h-3 text-blue-600" />;
  };

  const handleEditClick = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setEditForm({ stt: entry.stt, licensePlate: entry.licensePlate });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.stt.trim() || !editForm.licensePlate.trim()) {
      alert("Vui lòng nhập đầy đủ STT và Biển số xe");
      return;
    }
    onUpdate(id, { stt: editForm.stt.trim(), licensePlate: editForm.licensePlate.trim().toUpperCase() });
    setEditingId(null);
  };

  const handleSaveAdd = () => {
    if (!addForm.stt.trim() || !addForm.licensePlate.trim()) {
      alert("Vui lòng nhập đầy đủ STT và Biển số xe");
      return;
    }
    onAdd({ stt: addForm.stt.trim(), licensePlate: addForm.licensePlate.trim().toUpperCase() });
    setIsAdding(false);
    setAddForm({ stt: '', licensePlate: '' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800">Quản lý Nhật trình ({journalEntries.length} dòng)</h2>
        </div>
        <div className="flex items-center space-x-3">
          {journalEntries.length > 0 && (
            <>
              {sortConfig && (
                <button
                  onClick={() => {
                    if (window.confirm('Cập nhật lại STT theo thứ tự đang hiển thị? Thao tác này sẽ đánh số lại toàn bộ STT từ 1.')) {
                      const updates = sortedEntries.map((entry, idx) => ({
                        id: entry.id,
                        stt: (idx + 1).toString(),
                      }));
                      onBatchUpdateStt(updates);
                      setSortConfig(null);
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 transition shadow-sm border border-amber-200"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Cập nhật STT
                </button>
              )}
              <button
                onClick={() => onExport(sortedEntries)}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition shadow-sm border border-emerald-200"
              >
                <Download className="w-4 h-4 mr-1" />
                Xuất Excel
              </button>
              <button
                onClick={onDeleteAll}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 transition shadow-sm border border-rose-200"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Xóa tất cả
              </button>
            </>
          )}
          <button
            onClick={handleStartAdding}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Thêm dòng mới
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs uppercase bg-slate-100 text-slate-500 font-semibold select-none">
            <tr>
              <th className="px-6 py-3 w-32 cursor-pointer hover:bg-slate-200 transition group" onClick={() => requestSort('stt')}>
                <div className="flex items-center space-x-1"><span>STT</span> {renderSortIcon('stt')}</div>
              </th>
              <th className="px-6 py-3 cursor-pointer hover:bg-slate-200 transition group" onClick={() => requestSort('licensePlate')}>
                <div className="flex items-center space-x-1"><span>Biển Số Xe</span> {renderSortIcon('licensePlate')}</div>
              </th>
              <th className="px-6 py-3 cursor-pointer hover:bg-slate-200 transition group" onClick={() => requestSort('date')}>
                <div className="flex items-center space-x-1"><span>Ngày</span> {renderSortIcon('date')}</div>
              </th>
              <th className="px-6 py-3 cursor-pointer hover:bg-slate-200 transition group" onClick={() => requestSort('time')}>
                <div className="flex items-center space-x-1"><span>Giờ</span> {renderSortIcon('time')}</div>
              </th>
              <th className="px-6 py-3 text-center cursor-pointer hover:bg-slate-200 transition group" onClick={() => requestSort('photoCount')}>
                <div className="flex items-center justify-center space-x-1"><span>Số lượng ảnh</span> {renderSortIcon('photoCount')}</div>
              </th>
              <th className="px-6 py-3 w-40 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isAdding && (
              <tr className="bg-blue-50/50">
                <td className="px-6 py-3">
                  <input
                    type="text"
                    value={addForm.stt}
                    disabled
                    className="w-full px-2 py-1 border border-slate-300 rounded bg-slate-100 text-slate-500 font-semibold text-sm cursor-not-allowed"
                  />
                </td>
                <td className="px-6 py-3">
                  <input
                    type="text"
                    value={addForm.licensePlate}
                    onChange={(e) => setAddForm({ ...addForm, licensePlate: e.target.value.toUpperCase() })}
                    onBlur={(e) => setAddForm({ ...addForm, licensePlate: formatLicensePlate(e.target.value) })}
                    placeholder="VD: 38A-123.45"
                    className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm uppercase"
                    autoFocus
                  />
                </td>
                <td className="px-6 py-3 text-slate-400 text-sm italic">
                  (Sẽ tự động điền)
                </td>
                <td className="px-6 py-3 text-slate-400 text-sm italic">
                  (Sẽ tự động điền)
                </td>
                <td className="px-6 py-3 text-center text-slate-400 text-sm italic">
                  -
                </td>
                <td className="px-6 py-3 text-right space-x-2">
                  <button onClick={handleSaveAdd} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition" title="Lưu">
                    <Save className="w-4 h-4" />
                  </button>
                  <button onClick={() => setIsAdding(false)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition" title="Hủy">
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            )}
            
            {journalEntries.length === 0 && !isAdding && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  Chưa có dữ liệu nhật trình. Bạn có thể thêm thủ công hoặc upload file Excel.
                </td>
              </tr>
            )}

            {sortedEntries.map((entry) => {
              return (
              <tr key={entry.id} className="hover:bg-slate-50/80 transition group">
                {editingId === entry.id ? (
                  <>
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={editForm.stt}
                        onChange={(e) => setEditForm({ ...editForm, stt: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={editForm.licensePlate}
                        onChange={(e) => setEditForm({ ...editForm, licensePlate: e.target.value.toUpperCase() })}
                        onBlur={(e) => setEditForm({ ...editForm, licensePlate: formatLicensePlate(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm uppercase"
                      />
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-sm">
                      {entry.dateStr}
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-sm">
                      {entry.timeStr}
                    </td>
                    <td className="px-6 py-3 text-center text-slate-500 text-sm font-medium">
                      {entry.photoCount > 0 ? `${entry.photoCount}/${entry.requiredCount}` : '-'}
                    </td>
                    <td className="px-6 py-3 text-right space-x-2">
                      <button onClick={() => handleSaveEdit(entry.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition" title="Lưu">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition" title="Hủy">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-3 font-semibold text-slate-700">{entry.stt}</td>
                    <td className="px-6 py-3 font-mono text-blue-600">{entry.licensePlate}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 font-medium">{entry.dateStr}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 font-medium">{entry.timeStr}</td>
                    <td className="px-6 py-3 text-center">
                      {entry.photoCount > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${entry.isWarning ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {entry.photoCount}/{entry.requiredCount}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right space-x-1">
                      <button onClick={() => handleEditClick(entry)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Sửa">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm(`Xóa biển số ${entry.licensePlate} khỏi nhật trình?`)) {
                            onDelete(entry.id);
                          }
                        }} 
                        className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition" 
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};

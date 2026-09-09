import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { Profile } from '../App';

interface ProfileManagerModalProps {
  profiles: Profile[];
  onClose: () => void;
  onAdd: (profile: Omit<Profile, 'id'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Profile>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const ProfileManagerModal: React.FC<ProfileManagerModalProps> = ({
  profiles,
  onClose,
  onAdd,
  onUpdate,
  onDelete
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newThreshold, setNewThreshold] = useState(4);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editThreshold, setEditThreshold] = useState(4);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await onAdd({ name: newName.trim(), minPhotoThreshold: newThreshold });
    setNewName('');
    setNewThreshold(4);
    setIsAdding(false);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await onUpdate(id, { name: editName.trim(), minPhotoThreshold: editThreshold });
    setEditingId(null);
  };

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditThreshold(p.minPhotoThreshold || 4);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-700 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/80">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            Quản lý Nhà Xe
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="space-y-3">
            {profiles.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                {editingId === p.id ? (
                  <div className="flex-1 flex gap-2 mr-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                      placeholder="Tên nhà xe"
                    />
                    <input
                      type="number"
                      value={editThreshold}
                      onChange={e => setEditThreshold(Number(e.target.value))}
                      className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                      title="Số ảnh tiêu chuẩn"
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="font-semibold text-slate-200">{p.name}</div>
                    <div className="text-xs text-slate-400">Tiêu chuẩn: {p.minPhotoThreshold || 4} ảnh</div>
                  </div>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  {editingId === p.id ? (
                    <button onClick={() => handleSaveEdit(p.id)} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded">
                      <Save className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => startEdit(p)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {p.id !== 'default' && (
                    <button 
                      onClick={() => {
                        if (window.confirm(`Xóa nhà xe "${p.name}" sẽ xóa toàn bộ ảnh và nhật trình của nhà xe này. Tiếp tục?`)) {
                          onDelete(p.id);
                        }
                      }}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isAdding ? (
            <div className="mt-4 p-3 bg-slate-900/80 rounded-lg border border-blue-500/30">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                  placeholder="Nhập tên nhà xe mới"
                  autoFocus
                />
                <input
                  type="number"
                  value={newThreshold}
                  onChange={e => setNewThreshold(Number(e.target.value))}
                  className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                  title="Số ảnh tiêu chuẩn"
                  min="1"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors">
                  Hủy
                </button>
                <button onClick={handleAdd} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded transition-colors">
                  Lưu
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAdding(true)}
              className="mt-4 w-full py-2.5 flex items-center justify-center gap-2 text-sm text-blue-400 border border-dashed border-blue-500/30 rounded-lg hover:bg-blue-500/10 hover:border-blue-500/50 transition-colors"
            >
              <Plus className="w-4 h-4" /> Thêm Nhà Xe
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

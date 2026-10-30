/**
 * AdminDbViewer.tsx
 * Full CRUD database inspection & management panel for Amar Haat admins.
 * Supports:
 * 1. CREATE: Insert modal to add new records into SQLite tables or JSON collections.
 * 2. READ: Paginated inspection, real-time search, and CSV export.
 * 3. UPDATE: Direct inline row editing with live Save button syncing to SQLite & db.json.
 * 4. DELETE: Row deletion with confirmation, refreshing view & decrementing counts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  RefreshCw,
  Table2,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Shield,
  Activity,
  Users,
  ShoppingCart,
  Sprout,
  Bell,
  MessageSquare,
  Link2,
  Phone,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pencil,
  Save,
  X,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { Language } from '../types';

interface AdminDbViewerProps {
  language: Language;
  adminPhone: string; // used as auth token (admin identifier)
}

interface TableInfo {
  name: string;
  count: number;
  columns?: Array<{ name: string; type: string }>;
}

interface DbStats {
  sqlite: {
    dbPath: string;
    tables: Record<string, number>;
  };
  jsonDb: {
    dbPath: string;
    stats: Record<string, any>;
  };
}

const TABLE_ICONS: Record<string, React.ReactNode> = {
  users: <Users className="w-4 h-4" />,
  products: <Sprout className="w-4 h-4" />,
  orders: <ShoppingCart className="w-4 h-4" />,
  order_items: <ShoppingCart className="w-4 h-4" />,
  market_prices: <Activity className="w-4 h-4" />,
  wholesaler_offers: <Link2 className="w-4 h-4" />,
  audit_logs: <FileText className="w-4 h-4" />,
  'json:users': <Users className="w-4 h-4" />,
  'json:messages': <MessageSquare className="w-4 h-4" />,
  'json:connections': <Link2 className="w-4 h-4" />,
  'json:notifications': <Bell className="w-4 h-4" />,
  'json:callLogs': <Phone className="w-4 h-4" />,
  'json:orders': <ShoppingCart className="w-4 h-4" />,
  'json:crops': <Sprout className="w-4 h-4" />,
  'json:auditLogs': <FileText className="w-4 h-4" />,
};

const NON_EDITABLE_COLUMNS = new Set([
  'id',
  'created_at',
  'createdAt',
  'password_hash',
  'passwordHash',
  'sessionToken',
  'securityPin',
]);

const PAGE_SIZE = 25;

export const AdminDbViewer: React.FC<AdminDbViewerProps> = ({ language, adminPhone }) => {
  const isBn = language === 'bn';

  const [stats, setStats] = useState<DbStats | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [jsonCollections, setJsonCollections] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Inline editing state (Update)
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  // Deletion state (Delete)
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Insert modal state (Create)
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [insertFormData, setInsertFormData] = useState<Record<string, any>>({});
  const [isInserting, setIsInserting] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminPhone}`,
  };

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/db/stats', { headers: authHeaders });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch stats');
      setStats(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStatsLoading(false);
    }
  }, [adminPhone]);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/db/tables', { headers: authHeaders });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch tables');
      setTables(data.tables || []);
      setJsonCollections(data.jsonCollections || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [adminPhone]);

  const fetchTableData = useCallback(async (tableName: string, pageNum: number) => {
    setLoading(true);
    setError(null);
    setEditingRowId(null);
    setEditFormData({});
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/admin/db/table/${tableName}?page=${pageNum}&limit=${PAGE_SIZE}`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch table data');
      setTableData(data.rows || []);
      setTotalRows(data.total || 0);

      if (data.rows && data.rows.length > 0) {
        setTableColumns(Object.keys(data.rows[0]));
      } else {
        const tableInfo = tables.find(t => t.name === tableName);
        if (tableInfo?.columns) {
          setTableColumns(tableInfo.columns.map(c => c.name));
        } else {
          setTableColumns([]);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [adminPhone, tables]);

  useEffect(() => {
    fetchStats();
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable, page);
    }
  }, [selectedTable, page]);

  const handleSelectTable = (name: string) => {
    setSelectedTable(name);
    setPage(1);
    setSearchTerm('');
    setEditingRowId(null);
    setEditFormData({});
    setConfirmDeleteId(null);
    setIsInsertModalOpen(false);
  };

  const handleRefresh = () => {
    fetchStats();
    fetchTables();
    if (selectedTable) {
      fetchTableData(selectedTable, page);
    }
  };

  // ── INLINE EDITING (UPDATE) ──────────────────────────────────────────────────
  const startEditingRow = (row: any) => {
    setEditingRowId(row.id);
    setEditFormData({ ...row });
    setConfirmDeleteId(null);
    setError(null);
  };

  const cancelEditingRow = () => {
    setEditingRowId(null);
    setEditFormData({});
  };

  const handleFieldChange = (col: string, val: any) => {
    setEditFormData(prev => ({
      ...prev,
      [col]: val,
    }));
  };

  const saveEditedRow = async (rowId: string) => {
    if (!selectedTable) return;
    setSavingRowId(rowId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/db/record/${selectedTable}/${encodeURIComponent(rowId)}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ updates: editFormData }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to save record updates');
      }

      // Update tableData immediately in local UI state
      setTableData(prev =>
        prev.map(item => (item.id === rowId ? { ...item, ...editFormData } : item))
      );

      setEditingRowId(null);
      setEditFormData({});
      setSuccessMsg(
        isBn
          ? 'সফলভাবে সংরক্ষিত হয়েছে! (db.json ও SQLite ডেটাবেজে আপডেট সম্পন্ন)'
          : 'Saved successfully! Changes persisted to SQLite & db.json.'
      );
      setTimeout(() => setSuccessMsg(null), 4000);

      fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to update record');
    } finally {
      setSavingRowId(null);
    }
  };

  // ── DELETE RECORD (DELETE) ───────────────────────────────────────────────────
  const handleDeleteRow = async (rowId: string) => {
    if (!selectedTable) return;
    setDeletingRowId(rowId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/db/record/${selectedTable}/${encodeURIComponent(rowId)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to delete record');
      }

      // Remove from tableData and decrement totalRows
      setTableData(prev => prev.filter(item => item.id !== rowId));
      setTotalRows(prev => Math.max(0, prev - 1));
      setConfirmDeleteId(null);

      setSuccessMsg(
        isBn
          ? 'রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে! (SQLite ও db.json থেকে অপসারিত)'
          : 'Record deleted successfully from SQLite & db.json.'
      );
      setTimeout(() => setSuccessMsg(null), 4000);

      fetchStats();
      fetchTables();
    } catch (err: any) {
      setError(err.message || 'Failed to delete record');
    } finally {
      setDeletingRowId(null);
    }
  };

  // ── INSERT RECORD (CREATE) ───────────────────────────────────────────────────
  const openInsertModal = () => {
    const initialForm: Record<string, any> = {};
    tableColumns.forEach(col => {
      if (col === 'role') initialForm[col] = 'farmer';
      else if (col === 'district') initialForm[col] = 'Bogura';
      else if (col === 'verified' || col === 'organic_certified') initialForm[col] = 1;
      else if (col === 'quality_grade') initialForm[col] = 'A';
      else if (col === 'harvest_status') initialForm[col] = 'Harvested Today';
      else if (col === 'available_date') initialForm[col] = 'In Stock';
      else if (col === 'category') initialForm[col] = 'Vegetables';
      else initialForm[col] = '';
    });
    setInsertFormData(initialForm);
    setIsInsertModalOpen(true);
    setError(null);
  };

  const handleInsertFieldChange = (col: string, val: any) => {
    setInsertFormData(prev => ({
      ...prev,
      [col]: val,
    }));
  };

  const handleInsertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    setIsInserting(true);
    setError(null);

    try {
      const payload: Record<string, any> = {};
      Object.entries(insertFormData).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) {
          payload[k] = v;
        }
      });

      const res = await fetch(`/api/admin/db/record/${selectedTable}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to insert record');
      }

      // Prepend to current view
      if (resData.record) {
        setTableData(prev => [resData.record, ...prev]);
        setTotalRows(prev => prev + 1);
      }

      setIsInsertModalOpen(false);
      setInsertFormData({});
      setSuccessMsg(
        isBn
          ? 'নতুন রেকর্ড সফলভাবে তৈরি ও সংরক্ষণ করা হয়েছে! (SQLite ও db.json)'
          : 'New record created and persisted successfully in SQLite & db.json!'
      );
      setTimeout(() => setSuccessMsg(null), 4000);

      fetchStats();
      fetchTables();
    } catch (err: any) {
      setError(err.message || 'Failed to insert new record');
    } finally {
      setIsInserting(false);
    }
  };

  const handleExportCSV = () => {
    if (!tableData.length) return;
    const headers = tableColumns.join(',');
    const rows = tableData.map(row =>
      tableColumns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}-page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter rows by search
  const filteredRows = searchTerm
    ? tableData.filter(row =>
        Object.values(row).some(v =>
          String(v).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : tableData;

  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  const formatCellValue = (val: any): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? '✓' : '✗';
    if (typeof val === 'object') return JSON.stringify(val).slice(0, 80);
    const s = String(val);
    return s.length > 100 ? s.slice(0, 97) + '…' : s;
  };

  const getCellColor = (col: string, val: any): string => {
    if (col === 'role') {
      const colors: Record<string, string> = {
        admin: 'bg-red-100 text-red-700',
        farmer: 'bg-green-100 text-green-700',
        wholesaler: 'bg-blue-100 text-blue-700',
        retailer: 'bg-purple-100 text-purple-700',
        consumer: 'bg-orange-100 text-orange-700',
      };
      return colors[String(val)] || 'bg-stone-100 text-stone-700';
    }
    if (col === 'verified' || col === 'organic_certified') {
      return Number(val) ? 'text-emerald-600 font-bold' : 'text-stone-400';
    }
    if (col.includes('price') || col.includes('bdt') || col.includes('total')) {
      return 'text-blue-700 font-semibold tabular-nums';
    }
    if (col.includes('_at') || col.includes('date')) {
      return 'text-stone-400 text-xs';
    }
    return 'text-stone-700';
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-700 rounded-lg">
            <Database className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">
              {isBn ? 'ডেটাবেজ কন্ট্রোল প্যানেল (Full CRUD)' : 'Database Control Panel (Full CRUD)'}
            </h2>
            <p className="text-slate-400 text-xs">
              {isBn
                ? 'রেকর্ড যোগ (Create), দেখা (Read), ইনলাইন এডিট (Update) ও মোছা (Delete) — SQLite ও db.json সিঙ্কড'
                : 'Create, Read, Inline Update & Delete records with persistent SQLite & db.json synchronization'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-900/60 border border-emerald-700 text-emerald-300 text-xs px-3 py-1.5 rounded-full">
            <Shield className="w-3 h-3" />
            <span>{isBn ? 'এডমিন অ্যাক্সেস' : 'Admin Access'}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || statsLoading ? 'animate-spin' : ''}`} />
            {isBn ? 'রিফ্রেশ' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="m-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="m-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg p-3 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="font-medium flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-stone-50 border-b border-stone-200">
          {Object.entries(stats.sqlite.tables).map(([table, count]) => (
            <button
              key={table}
              onClick={() => handleSelectTable(table)}
              className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                selectedTable === table
                  ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                  : 'bg-white border-stone-200 hover:border-emerald-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-1.5 text-stone-500 mb-1">
                {TABLE_ICONS[table] || <Table2 className="w-4 h-4" />}
                <span className="text-[11px] font-medium uppercase tracking-wide truncate">{table.replace(/_/g, ' ')}</span>
              </div>
              <span className="text-2xl font-black text-stone-900">{count.toLocaleString()}</span>
              <span className="text-[10px] text-stone-400 mt-0.5">SQLite</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-[500px]">
        {/* Sidebar: Table List */}
        <div className="w-full lg:w-56 xl:w-64 bg-stone-50 border-b lg:border-b-0 lg:border-r border-stone-200 shrink-0">
          <div className="p-3 border-b border-stone-200">
            <span className="text-xs font-semibold text-stone-500 uppercase">
              {isBn ? 'টেবিল / কালেকশন' : 'Tables / Collections'}
            </span>
          </div>
          <div className="overflow-y-auto max-h-64 lg:max-h-full">
            {statsLoading || loading ? (
              <div className="p-4 text-center text-stone-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              </div>
            ) : (
              <>
                {/* SQLite tables */}
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">SQLite (nativebazar.db)</span>
                </div>
                {tables.map(t => (
                  <button
                    key={t.name}
                    onClick={() => handleSelectTable(t.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors group ${
                      selectedTable === t.name
                        ? 'bg-emerald-100 text-emerald-800 font-semibold'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 opacity-60">{TABLE_ICONS[t.name] || <Table2 className="w-4 h-4" />}</span>
                      <span className="text-sm truncate">{t.name}</span>
                    </div>
                    <span className="text-xs font-mono bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded shrink-0">
                      {t.count}
                    </span>
                  </button>
                ))}

                {/* JSON collections */}
                <div className="px-3 pt-4 pb-1">
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">JSON DB (db.json)</span>
                </div>
                {jsonCollections.map(t => (
                  <button
                    key={t.name}
                    onClick={() => handleSelectTable(t.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors group ${
                      selectedTable === t.name
                        ? 'bg-orange-100 text-orange-800 font-semibold'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 opacity-60">{TABLE_ICONS[t.name] || <Table2 className="w-4 h-4" />}</span>
                      <span className="text-sm truncate">{t.name.replace('json:', '')}</span>
                    </div>
                    <span className="text-xs font-mono bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded shrink-0">
                      {t.count}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Main: Table Data */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!selectedTable ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-stone-400">
              <Database className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-semibold text-stone-500">
                {isBn ? 'একটি টেবিল বা কালেকশন বেছে নিন' : 'Select a table or collection'}
              </p>
              <p className="text-sm mt-1">
                {isBn ? 'বাম পাশ থেকে যেকোনো টেবিলে ক্লিক করে নতুন রেকর্ড যোগ, এডিট বা ডিলিট করুন' : 'Click any table on the left to create, edit, or delete its records'}
              </p>
            </div>
          ) : (
            <>
              {/* Table header toolbar */}
              <div className="p-3 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center gap-2 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{TABLE_ICONS[selectedTable] || <Table2 className="w-4 h-4 text-stone-500" />}</span>
                  <span className="font-bold text-stone-800 truncate">{selectedTable}</span>
                  <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full shrink-0">
                    {totalRows.toLocaleString()} {isBn ? 'রেকর্ড' : 'records'}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                  {/* CREATE ACTION: Add Record Button */}
                  <button
                    onClick={openInsertModal}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isBn ? 'নতুন রেকর্ড যোগ করুন' : 'Add Record'}</span>
                  </button>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={isBn ? 'খুঁজুন...' : 'Search...'}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-emerald-400 w-36 sm:w-40"
                    />
                  </div>

                  <button
                    onClick={handleExportCSV}
                    disabled={!tableData.length}
                    className="flex items-center gap-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                </div>
              </div>

              {/* Data table */}
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-48 text-stone-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span className="text-sm">{isBn ? 'লোড হচ্ছে...' : 'Loading...'}</span>
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-stone-400">
                    <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">{isBn ? 'কোনো রেকর্ড পাওয়া যায়নি' : 'No records found'}</p>
                    <button
                      onClick={openInsertModal}
                      className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:underline"
                    >
                      <Plus className="w-3 h-3" />
                      {isBn ? 'এই টেবিলে প্রথম রেকর্ড যোগ করুন' : 'Insert first record into this table'}
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-stone-100 border-b border-stone-200">
                          <th className="px-3 py-2 text-center text-stone-600 font-semibold uppercase tracking-wide w-36">
                            {isBn ? 'অ্যাকশন (CRUD)' : 'Actions'}
                          </th>
                          <th className="px-3 py-2 text-left text-stone-500 font-semibold uppercase tracking-wide w-8">#</th>
                          {tableColumns.map(col => (
                            <th key={col} className="px-3 py-2 text-left text-stone-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                              {col.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row, idx) => {
                          const isEditing = editingRowId === row.id;
                          const isSaving = savingRowId === row.id;
                          const isDeleting = deletingRowId === row.id;
                          const isConfirmingDelete = confirmDeleteId === row.id;

                          return (
                            <tr
                              key={row.id || idx}
                              className={`border-b transition-colors ${
                                isEditing
                                  ? 'bg-emerald-50/70 border-emerald-300'
                                  : isConfirmingDelete
                                  ? 'bg-rose-50/80 border-rose-300'
                                  : 'border-stone-100 hover:bg-stone-50'
                              }`}
                            >
                              {/* Row Actions: UPDATE & DELETE */}
                              <td className="px-2 py-2 text-center whitespace-nowrap">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => saveEditedRow(row.id)}
                                      disabled={isSaving}
                                      className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-2.5 py-1 rounded shadow-xs transition-colors disabled:opacity-50"
                                      title={isBn ? 'সংরক্ষণ করুন' : 'Save changes'}
                                    >
                                      {isSaving ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Save className="w-3.5 h-3.5" />
                                      )}
                                      <span>{isBn ? 'সেভ' : 'Save'}</span>
                                    </button>
                                    <button
                                      onClick={cancelEditingRow}
                                      disabled={isSaving}
                                      className="inline-flex items-center gap-1 bg-stone-200 hover:bg-stone-300 text-stone-700 font-medium text-[11px] px-2 py-1 rounded transition-colors"
                                      title={isBn ? 'বাতিল' : 'Cancel'}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : isConfirmingDelete ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="text-[10px] text-rose-700 font-bold mr-1">
                                      {isBn ? 'নিশ্চিত?' : 'Sure?'}
                                    </span>
                                    <button
                                      onClick={() => handleDeleteRow(row.id)}
                                      disabled={isDeleting}
                                      className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2 py-1 rounded shadow-xs disabled:opacity-50"
                                      title={isBn ? 'হ্যাঁ, মুছুন' : 'Confirm delete'}
                                    >
                                      {isDeleting ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <span>{isBn ? 'মুছুন' : 'Delete'}</span>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      disabled={isDeleting}
                                      className="px-1.5 py-1 bg-stone-200 hover:bg-stone-300 text-stone-600 rounded text-[10px]"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => startEditingRow(row)}
                                      className="inline-flex items-center gap-1 bg-stone-100 hover:bg-emerald-100 text-stone-700 hover:text-emerald-800 font-medium text-[11px] px-2 py-1 rounded border border-stone-200 hover:border-emerald-300 transition-colors"
                                      title={isBn ? 'ইনলাইন সম্পাদনা করুন' : 'Edit row inline'}
                                    >
                                      <Pencil className="w-3 h-3 text-stone-500 hover:text-emerald-700" />
                                      <span>{isBn ? 'এডিট' : 'Edit'}</span>
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(row.id)}
                                      className="inline-flex items-center gap-1 bg-stone-100 hover:bg-rose-100 text-stone-600 hover:text-rose-700 font-medium text-[11px] px-1.5 py-1 rounded border border-stone-200 hover:border-rose-300 transition-colors"
                                      title={isBn ? 'এই রেকর্ডটি মুছুন' : 'Delete this record'}
                                    >
                                      <Trash2 className="w-3 h-3 text-stone-400 hover:text-rose-600" />
                                    </button>
                                  </div>
                                )}
                              </td>

                              <td className="px-3 py-2 text-stone-400 tabular-nums">
                                {(page - 1) * PAGE_SIZE + idx + 1}
                              </td>

                              {tableColumns.map(col => {
                                const isLocked = NON_EDITABLE_COLUMNS.has(col);
                                const currentVal = isEditing ? editFormData[col] : row[col];

                                if (isEditing && !isLocked) {
                                  if (col === 'role') {
                                    return (
                                      <td key={col} className="px-2 py-1">
                                        <select
                                          value={String(currentVal || 'farmer')}
                                          onChange={e => handleFieldChange(col, e.target.value)}
                                          className="w-full bg-white border border-emerald-400 rounded px-2 py-1 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                                        >
                                          <option value="farmer">farmer</option>
                                          <option value="wholesaler">wholesaler</option>
                                          <option value="retailer">retailer</option>
                                          <option value="consumer">consumer</option>
                                          <option value="admin">admin</option>
                                        </select>
                                      </td>
                                    );
                                  }

                                  if (col === 'verified' || col === 'organic_certified') {
                                    return (
                                      <td key={col} className="px-2 py-1">
                                        <select
                                          value={Number(currentVal) ? '1' : '0'}
                                          onChange={e => handleFieldChange(col, Number(e.target.value))}
                                          className="bg-white border border-emerald-400 rounded px-2 py-1 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                                        >
                                          <option value="1">1 (Verified / True)</option>
                                          <option value="0">0 (False)</option>
                                        </select>
                                      </td>
                                    );
                                  }

                                  const isNumeric =
                                    typeof row[col] === 'number' ||
                                    col.includes('price') ||
                                    col.includes('kg') ||
                                    col.includes('acres') ||
                                    col.includes('bdt');

                                  return (
                                    <td key={col} className="px-2 py-1">
                                      <input
                                        type={isNumeric ? 'number' : 'text'}
                                        step={isNumeric ? 'any' : undefined}
                                        value={currentVal !== undefined && currentVal !== null ? currentVal : ''}
                                        onChange={e =>
                                          handleFieldChange(
                                            col,
                                            isNumeric ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value
                                          )
                                        }
                                        className="w-full min-w-[100px] bg-white border border-emerald-400 rounded px-2 py-1 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-normal"
                                      />
                                    </td>
                                  );
                                }

                                return (
                                  <td key={col} className={`px-3 py-2 max-w-xs truncate ${getCellColor(col, row[col])}`}>
                                    {isLocked && (
                                      <span className="inline-flex items-center gap-1 text-stone-400 text-[10px] mr-1" title={isBn ? 'এই ফিল্ড পরিবর্তনশীল নয়' : 'Read-only field'}>
                                        <Lock className="w-2.5 h-2.5 inline opacity-60" />
                                      </span>
                                    )}
                                    {col === 'role' ? (
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getCellColor(col, row[col])}`}>
                                        {formatCellValue(row[col])}
                                      </span>
                                    ) : (
                                      <span title={String(row[col] ?? '')}>
                                        {formatCellValue(row[col])}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && !searchTerm && (
                <div className="border-t border-stone-200 px-4 py-3 flex items-center justify-between bg-white">
                  <span className="text-xs text-stone-500">
                    {isBn
                      ? `পেজ ${page} / ${totalPages} (মোট ${totalRows.toLocaleString()} রেকর্ড)`
                      : `Page ${page} of ${totalPages} (${totalRows.toLocaleString()} total)`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.min(Math.max(page - 2, 1) + i, totalPages);
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-7 h-7 text-xs rounded-lg transition-colors ${
                            pageNum === page
                              ? 'bg-emerald-600 text-white font-semibold'
                              : 'hover:bg-stone-100 text-stone-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── CREATE RECORD MODAL ──────────────────────────────────────────────── */}
      {isInsertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-600 rounded-lg">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {isBn ? `নতুন রেকর্ড তৈরি করুন: ${selectedTable}` : `Insert New Record: ${selectedTable}`}
                  </h3>
                  <p className="text-slate-400 text-xs">
                    {isBn ? 'তথ্য দিয়ে ফর্মটি পূরণ করুন এবং সংরক্ষণ করুন' : 'Fill in the fields to save to SQLite & JSON storage'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInsertModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleInsertSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tableColumns.map(col => {
                  const isAuto = col === 'created_at' || col === 'updated_at' || col === 'createdAt' || col === 'last_login_at';
                  if (isAuto) return null;

                  if (col === 'role') {
                    return (
                      <div key={col} className="space-y-1">
                        <label className="text-xs font-semibold text-stone-700 uppercase">{col}</label>
                        <select
                          value={insertFormData[col] || 'farmer'}
                          onChange={e => handleInsertFieldChange(col, e.target.value)}
                          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="farmer">farmer</option>
                          <option value="wholesaler">wholesaler</option>
                          <option value="retailer">retailer</option>
                          <option value="consumer">consumer</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>
                    );
                  }

                  if (col === 'verified' || col === 'organic_certified') {
                    return (
                      <div key={col} className="space-y-1">
                        <label className="text-xs font-semibold text-stone-700 uppercase">{col}</label>
                        <select
                          value={insertFormData[col] !== undefined ? String(insertFormData[col]) : '1'}
                          onChange={e => handleInsertFieldChange(col, Number(e.target.value))}
                          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="1">1 (True / Verified)</option>
                          <option value="0">0 (False)</option>
                        </select>
                      </div>
                    );
                  }

                  const isNumeric = col.includes('price') || col.includes('kg') || col.includes('acres') || col.includes('bdt');

                  return (
                    <div key={col} className="space-y-1">
                      <label className="text-xs font-semibold text-stone-700 uppercase">
                        {col.replace(/_/g, ' ')}
                        {col === 'id' && <span className="text-[10px] text-stone-400 font-normal ml-1">(Optional)</span>}
                      </label>
                      <input
                        type={isNumeric ? 'number' : 'text'}
                        step={isNumeric ? 'any' : undefined}
                        placeholder={col === 'id' ? 'Auto-generated if left blank' : col}
                        value={insertFormData[col] !== undefined ? insertFormData[col] : ''}
                        onChange={e =>
                          handleInsertFieldChange(
                            col,
                            isNumeric ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
                          )
                        }
                        className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none text-stone-900"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInsertModalOpen(false)}
                  disabled={isInserting}
                  className="px-4 py-2 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isInserting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                >
                  {isInserting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isBn ? 'রেকর্ড সংরক্ষণ করুন' : 'Insert Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

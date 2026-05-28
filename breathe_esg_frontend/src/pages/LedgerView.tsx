import { useState, useEffect, useRef, Fragment } from 'react';
import type { FormEvent, DragEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, UploadCloud, RefreshCw, AlertCircle, 
  CheckCircle2, Building, Check, Lock, Edit3,
  FileText, X
} from 'lucide-react';

interface ActivityRecord {
  id: string;
  source_system: 'SAP' | 'UTILITY' | 'TRAVEL';
  scope_category: string;
  raw_payload: any;
  raw_value: number;
  raw_unit: string;
  normalized_value: number;
  normalized_unit: string;
  calculated_co2e_kg: number;
  period_start: string;
  period_end: string;
  plant_code: string;
  status: 'PENDING' | 'SUSPICIOUS' | 'FAILED' | 'APPROVED';
  status_reason: string;
  is_locked: boolean;
  approved_by_name?: string;
  approved_at?: string;
  history?: any[];
}

export default function LedgerView() {
  const { user, tenants, apiBase } = useAuth();
  
  // Scoped Tenant Switcher
  const allowedTenants = user?.role === 'ADMIN' 
    ? tenants 
    : (user?.role === 'ANALYST' ? (user.assigned_tenants || []) : []);
  
  const [selectedTenantId, setSelectedTenantId] = useState('');
  
  // Filters
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fileLabelFilter, setFileLabelFilter] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [sortBy, setSortBy] = useState('');

  // Dynamic filter options from backend
  const [availableFileLabels, setAvailableFileLabels] = useState<string[]>([]);
  const [availablePlants, setAvailablePlants] = useState<string[]>([]);
  
  // Records state
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadClient, setUploadClient] = useState('');
  const [uploadFileLabel, setUploadFileLabel] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Add new client state
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientDomain, setNewClientDomain] = useState('');
  const [addClientError, setAddClientError] = useState<string | null>(null);
  const [addClientSuccess, setAddClientSuccess] = useState(false);
  const [addingClient, setAddingClient] = useState(false);

  // Inline edit state
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Set initial selected tenant
  useEffect(() => {
    if (user?.role === 'CLIENT' && user.tenant) {
      setSelectedTenantId(user.tenant.id);
    } else if (allowedTenants.length > 0) {
      setSelectedTenantId(allowedTenants[0].id);
    }
  }, [user, tenants]);

  const fetchRecords = async () => {
    if (!selectedTenantId) return;
    setLoading(true);
    try {
      let url = `${apiBase}/records/?tenant_id=${selectedTenantId}`;
      if (sourceFilter) url += `&source_system=${sourceFilter}`;
      if (scopeFilter) url += `&scope_category=${scopeFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (fileLabelFilter) url += `&file_label=${encodeURIComponent(fileLabelFilter)}`;
      if (plantFilter) url += `&plant_code=${encodeURIComponent(plantFilter)}`;
      if (sortBy) url += `&sort_by=${sortBy}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      
      const res = await fetch(url);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    if (!selectedTenantId) return;
    try {
      const res = await fetch(`${apiBase}/records/filter_options/?tenant_id=${selectedTenantId}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableFileLabels(data.file_labels || []);
        setAvailablePlants(data.plant_codes || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedTenantId, sourceFilter, scopeFilter, statusFilter, fileLabelFilter, plantFilter, sortBy, search]);

  useEffect(() => {
    fetchFilterOptions();
  }, [selectedTenantId]);

  useEffect(() => {
    if (uploadFile) {
      if (user?.role === 'CLIENT' && user.tenant) {
        setUploadClient(user.tenant.id);
      } else if (allowedTenants.length > 0) {
        setUploadClient(allowedTenants[0].id);
      }
    }
  }, [uploadFile, user, allowedTenants]);

  const handleAddClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientDomain) return;
    setAddingClient(true);
    setAddClientError(null);
    setAddClientSuccess(false);
    
    try {
      const res = await fetch(`${apiBase}/onboard/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName, domain: newClientDomain })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to add client');
      }
      const newTenant = await res.json();
      
      // Update local state by forcing a refresh or just relying on user object re-fetch
      // For now, let's just trigger a full reload to get fresh context
      setAddClientSuccess(true);
      setNewClientName('');
      setNewClientDomain('');
      setIsAddingClient(false);
      setUploadClient(newTenant.id);
      setTimeout(() => setAddClientSuccess(false), 5000);
      
      // We ideally want to refresh the tenants list here. Since it's from context, 
      // we can do a window reload for prototype simplicity if needed, but the API response 
      // has the tenant so we can select it right away.
      window.location.reload(); 
    } catch (err: any) {
      setAddClientError(err.message);
    } finally {
      setAddingClient(false);
    }
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadClient) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('tenant_id', uploadClient);
    if (uploadFileLabel) {
      formData.append('file_label', uploadFileLabel);
    }

    try {
      const res = await fetch(`${apiBase}/records/upload/`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Upload failed');
      }
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      
      await fetchRecords();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setUploadFile(file);
      setUploadError(null);
      setUploadSuccess(false);
    } else {
      setUploadError('Please drop a .csv file');
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const clearFile = () => {
    setUploadFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/records/${id}/approve/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Approval failed');
      }
      await fetchRecords();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const startEdit = (rec: ActivityRecord) => {
    setEditingRecordId(rec.id);
    setEditValue(rec.normalized_value?.toString() || rec.raw_value?.toString() || '');
    setEditReason('');
    setActionError(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editReason.trim()) {
      setActionError('Please provide a reason for this change.');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/records/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          normalized_value: parseFloat(editValue),
          reason: editReason
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Update failed');
      }
      setEditingRecordId(null);
      await fetchRecords();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Calc summary metrics
  const totalCo2e = records
    .filter(r => r.status === 'APPROVED' || r.status === 'PENDING')
    .reduce((sum, r) => sum + (parseFloat(r.calculated_co2e_kg as any) || 0), 0) / 1000;

  const approvedCount = records.filter(r => r.status === 'APPROVED').length;
  const suspiciousCount = records.filter(r => r.status === 'SUSPICIOUS').length;
  const failedCount = records.filter(r => r.status === 'FAILED').length;

  return (
    <div className="flex flex-col gap-6">
      {/* Upper header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Compliance Ledger</h2>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-0.5">Activity Records & Review</p>
        </div>

        {/* Tenant selection context switcher (strictly scoped) */}
        {user?.role !== 'CLIENT' && allowedTenants.length > 0 && (
          <div className="relative inline-flex items-center">
            <Building className="w-4 h-4 text-[#005E43] absolute left-3 z-10" />
            <select
              value={selectedTenantId}
              onChange={e => setSelectedTenantId(e.target.value)}
              className="bg-white border border-[#DCE5DE] pl-9 pr-8 py-2 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:border-[#005E43] appearance-none shadow-sm cursor-pointer"
            >
              {allowedTenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Modern dark green theme premium cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#005E43] p-5 rounded-[28px] border border-white/10 shadow-lg text-white relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
            <Building className="w-32 h-32" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Total Carbon Footprint</span>
          <div className="text-3xl font-black mt-2 tracking-tight">{totalCo2e.toFixed(2)}</div>
          <span className="text-[10px] text-emerald-200 font-medium block mt-1">Metric Tons CO₂e (Approved + Pending)</span>
        </div>

        <div className="bg-white p-5 rounded-[28px] border border-[#EDF2ED] shadow-sm relative overflow-hidden">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Approved Entries</span>
          <div className="text-3xl font-black text-gray-800 mt-2 tracking-tight">
            {approvedCount} <span className="text-xs text-gray-400 font-bold">/ {records.length}</span>
          </div>
          <span className="text-[10px] text-[#005E43] font-bold block mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Locked & verified
          </span>
        </div>

        <div className="bg-white p-5 rounded-[28px] border border-[#EDF2ED] shadow-sm relative overflow-hidden">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Suspicious Flags</span>
          <div className="text-3xl font-black text-[#D84315] mt-2 tracking-tight">{suspiciousCount}</div>
          <span className="text-[10px] text-gray-400 font-medium block mt-1 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-[#D84315]" /> Outlier quantity alerts
          </span>
        </div>

        <div className="bg-white p-5 rounded-[28px] border border-[#EDF2ED] shadow-sm relative overflow-hidden">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ingest Rejections</span>
          <div className="text-3xl font-black text-red-700 mt-2 tracking-tight">{failedCount}</div>
          <span className="text-[10px] text-gray-400 font-medium block mt-1">Rows with parsing format errors</span>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white border border-[#EDF2ED] p-5 rounded-[28px]">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setUploadFile(f); setUploadError(null); setUploadSuccess(false); }
          }}
        />

        {!uploadFile ? (
          /* Step 1: Drop zone */
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
              dragOver
                ? 'border-[#005E43] bg-[#EAF5EF]'
                : 'border-[#DCE5DE] bg-[#FAFBFA] hover:border-[#005E43]/40 hover:bg-[#F3F6F4]'
            }`}
          >
            <UploadCloud className={`w-10 h-10 mb-3 transition-colors ${
              dragOver ? 'text-[#005E43]' : 'text-gray-300'
            }`} />
            <p className="text-sm font-bold text-gray-600">Drop your CSV file here</p>
            <p className="text-[11px] text-gray-400 mt-1">or click to browse</p>
          </div>
        ) : (
          /* Step 2: File picked → short form */
          <div className="flex flex-col gap-4">
            {/* File info bar */}
            <div className="flex items-center gap-3 bg-[#F3F6F4] rounded-2xl px-4 py-3">
              <FileText className="w-5 h-5 text-[#005E43] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{uploadFile.name}</p>
                <p className="text-[10px] text-gray-400">{formatFileSize(uploadFile.size)}</p>
              </div>
              <button type="button" onClick={clearFile}
                className="p-1.5 rounded-xl hover:bg-white/80 text-gray-400 hover:text-gray-600 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {addClientSuccess && (
              <div className="p-3 bg-[#EAF5EF] border border-[#D5EAE0] rounded-xl text-xs font-bold text-[#005E43] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Client onboarded successfully! You can now upload the file.
              </div>
            )}

            {isAddingClient ? (
              <form onSubmit={handleAddClient} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-gray-700">Onboard New Client</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    placeholder="Company Name (e.g., Acme Corp)"
                    className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:border-[#005E43]"
                  />
                  <input
                    type="text"
                    value={newClientDomain}
                    onChange={e => setNewClientDomain(e.target.value)}
                    placeholder="Domain (e.g., acme.com)"
                    className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:border-[#005E43]"
                  />
                </div>
                {addClientError && (
                  <p className="text-[10px] font-bold text-red-600">{addClientError}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="submit"
                    disabled={addingClient || !newClientName || !newClientDomain}
                    className="bg-[#005E43] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#004A34] disabled:opacity-50 transition-all"
                  >
                    {addingClient ? 'Adding...' : 'Add Client'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingClient(false)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Client</label>
                  <select
                    value={uploadClient}
                    onChange={e => {
                      if (e.target.value === 'ADD_NEW') {
                        setIsAddingClient(true);
                        setUploadClient('');
                      } else {
                        setUploadClient(e.target.value);
                      }
                    }}
                    className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:border-[#005E43]"
                  >
                    <option value="" disabled>Select a client...</option>
                    {allowedTenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                    <option value="ADD_NEW" className="font-bold text-[#005E43]">+ Add new client</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">File Name / Label (Optional)</label>
                  <input
                    type="text"
                    value={uploadFileLabel}
                    onChange={e => setUploadFileLabel(e.target.value)}
                    placeholder="e.g., Q1 Utility Bills"
                    className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:border-[#005E43]"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={uploading || !uploadClient}
                    className="w-full bg-[#005E43] text-white py-2.5 rounded-2xl text-xs font-bold hover:bg-[#004A34] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    <UploadCloud className="w-4 h-4" />
                    {uploading ? 'Processing...' : 'Upload & Process'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Success message */}
        {uploadSuccess && (
          <div className="mt-3 p-3 bg-[#EAF5EF] border border-[#D5EAE0] rounded-xl text-xs font-bold text-[#005E43] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> File uploaded and processed. Data auto-detected from headers.
          </div>
        )}

        {/* Error message */}
        {uploadError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">
            {uploadError}
          </div>
        )}
      </div>

      {/* Filter and search headers */}
      <div className="bg-[#F8FAF8] border border-[#EDF2ED] p-4 rounded-[24px] flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ledger entries..."
            className="w-full bg-white border border-[#DCE5DE] pl-9 pr-4 py-2 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#005E43]"
          />
        </div>

        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="bg-white border border-[#DCE5DE] px-3 py-2 rounded-xl text-xs font-bold text-gray-700 focus:outline-none"
        >
          <option value="">All Sources</option>
          <option value="SAP">SAP MM</option>
          <option value="UTILITY">Utility</option>
          <option value="TRAVEL">Travel</option>
        </select>

        <select
          value={scopeFilter}
          onChange={e => setScopeFilter(e.target.value)}
          className="bg-white border border-[#DCE5DE] px-3 py-2 rounded-xl text-xs font-bold text-gray-700 focus:outline-none"
        >
          <option value="">All GHG Scopes</option>
          <option value="Scope 1">Scope 1</option>
          <option value="Scope 2">Scope 2</option>
          <option value="Scope 3">Scope 3</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white border border-[#DCE5DE] px-3 py-2 rounded-xl text-xs font-bold text-gray-700 focus:outline-none"
        >
          <option value="">All States</option>
          <option value="PENDING">Pending Review</option>
          <option value="SUSPICIOUS">Suspicious</option>
          <option value="FAILED">Failed</option>
          <option value="APPROVED">Approved</option>
        </select>
        
        {/* New Filters */}
        <select
          value={fileLabelFilter}
          onChange={e => setFileLabelFilter(e.target.value)}
          className="bg-white border border-[#DCE5DE] px-3 py-2 rounded-xl text-xs font-bold text-gray-700 focus:outline-none max-w-[150px]"
        >
          <option value="">All File Labels</option>
          {availableFileLabels.map(label => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
        
        <select
          value={plantFilter}
          onChange={e => setPlantFilter(e.target.value)}
          className="bg-white border border-[#DCE5DE] px-3 py-2 rounded-xl text-xs font-bold text-gray-700 focus:outline-none max-w-[150px]"
        >
          <option value="">All Facilities</option>
          {availablePlants.map(plant => (
            <option key={plant} value={plant}>{plant}</option>
          ))}
        </select>
        
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="bg-white border border-[#DCE5DE] px-3 py-2 rounded-xl text-xs font-bold text-gray-700 focus:outline-none max-w-[150px]"
        >
          <option value="">Sort By: Default</option>
          <option value="emissions_desc">Emissions: High to Low</option>
          <option value="emissions_asc">Emissions: Low to High</option>
          <option value="date_desc">Date: Newest First</option>
          <option value="date_asc">Date: Oldest First</option>
        </select>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-[#EDF2ED] rounded-[32px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FAFBFA] text-gray-400 text-[10px] font-extrabold uppercase tracking-widest border-b border-[#EDF2ED]">
              <tr>
                <th className="px-5 py-4">Client</th>
                <th className="px-5 py-4">File Name / Label</th>
                <th className="px-5 py-4">Scope</th>
                <th className="px-5 py-4">Source</th>
                <th className="px-5 py-4">Facility / Plant</th>
                <th className="px-5 py-4">Raw Entry</th>
                <th className="px-5 py-4">Normalized</th>
                <th className="px-5 py-4 text-[#005E43]">Carbon (CO₂e)</th>
                <th className="px-5 py-4">Verification</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-xs font-bold text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#005E43]" /> Loading ledger registry...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-xs font-bold text-gray-400">
                    No compliance records found matching query filters.
                  </td>
                </tr>
              ) : (
                records.map(rec => {
                  const isEditing = editingRecordId === rec.id;
                  return (
                    <Fragment key={rec.id}>
                      <tr className="border-b border-[#F2F5F3] hover:bg-[#F9FAF9] transition-all">
                        <td className="px-5 py-4 text-xs font-bold text-gray-700">{(rec as any).tenant_name || '—'}</td>
                        <td className="px-5 py-4 text-xs font-bold text-gray-700 truncate max-w-[120px]">{(rec as any).file_label || '—'}</td>
                        <td className="px-5 py-4 text-xs font-black text-gray-800">
                          <span className="bg-[#EAF5EF] text-[#005E43] px-2 py-0.5 rounded-lg text-[9px] font-extrabold">
                            {rec.scope_category}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-gray-500">{rec.source_system}</td>
                        <td className="px-5 py-4 text-xs font-bold text-gray-700">{rec.plant_code || '—'}</td>
                        <td className="px-5 py-4 text-xs font-semibold text-gray-400">
                          {rec.raw_value ? `${parseFloat(rec.raw_value as any).toLocaleString()} ${rec.raw_unit}` : '—'}
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-gray-800">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              className="bg-white border border-[#DCE5DE] px-2 py-1 rounded-xl text-xs font-bold text-gray-800 w-24 focus:outline-none"
                            />
                          ) : rec.normalized_value ? (
                            `${parseFloat(rec.normalized_value as any).toLocaleString()} ${rec.normalized_unit}`
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs font-black text-[#005E43]">
                          {rec.calculated_co2e_kg ? `${(parseFloat(rec.calculated_co2e_kg as any) / 1000).toFixed(3)} t` : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold tracking-wider uppercase inline-flex items-center gap-1 ${
                            rec.status === 'APPROVED' ? 'bg-[#E2F6F0] text-[#00875A]' :
                            rec.status === 'SUSPICIOUS' ? 'bg-[#FFF0EC] text-[#D84315]' :
                            rec.status === 'FAILED' ? 'bg-[#FFEBEE] text-[#C62828]' : 'bg-[#E3F2FD] text-[#1565C0]'
                          }`}>
                            {rec.status === 'APPROVED' ? <Check className="w-2.5 h-2.5" /> : null}
                            {rec.status === 'SUSPICIOUS' ? 'OUTLIER FLAG' : rec.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {rec.is_locked ? (
                              <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                                <Lock className="w-3 h-3 text-emerald-600" /> Locked
                              </span>
                            ) : isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(rec.id)}
                                  className="bg-[#005E43] text-white p-1.5 rounded-xl hover:bg-[#004A34] transition-all"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingRecordId(null)}
                                  className="bg-gray-100 text-gray-500 p-1.5 rounded-xl hover:bg-gray-200 transition-all"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                {user?.role !== 'CLIENT' && (
                                  <button
                                    onClick={() => startEdit(rec)}
                                    className="bg-[#F3F6F4] text-gray-600 p-1.5 rounded-xl hover:bg-[#EDF2ED] transition-all"
                                    title="Manually Correct Value"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {user?.role === 'ADMIN' && rec.status !== 'APPROVED' && (
                                  <button
                                    onClick={() => handleApprove(rec.id)}
                                    className="bg-[#005E43] text-white px-3 py-1.5 rounded-xl text-[10px] font-bold hover:bg-[#004A34] transition-all"
                                  >
                                    Approve & Lock
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded manual audit comments / log justification */}
                      {isEditing && (
                        <tr className="bg-[#FAFBFB] border-b border-[#F2F5F3]">
                          <td colSpan={8} className="px-5 py-3">
                            <div className="flex flex-col gap-2">
                              <label className="text-[9px] font-extrabold text-[#005E43] uppercase tracking-wider">
                                Reason for change
                              </label>
                              <input
                                type="text"
                                value={editReason}
                                onChange={e => setEditReason(e.target.value)}
                                placeholder="Why is this value being changed?"
                                className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#005E43]"
                              />
                              {actionError && (
                                <p className="text-[10px] font-bold text-red-600">{actionError}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

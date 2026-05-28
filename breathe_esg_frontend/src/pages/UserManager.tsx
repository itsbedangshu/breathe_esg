import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserProfile } from '../context/AuthContext';
import { Trash2, PlusCircle, ShieldCheck, Building, Edit3, X, Check } from 'lucide-react';

export default function UserManager() {
  const { allUsers, tenants, apiBase, refreshUsers, refreshTenants } = useAuth();

  // Create user form
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ANALYST' | 'CLIENT'>('ANALYST');
  const [newHomeTenant, setNewHomeTenant] = useState('');
  const [newAllowed, setNewAllowed] = useState<string[]>([]);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editTenant, setEditTenant] = useState('');
  const [editAllowed, setEditAllowed] = useState<string[]>([]);

  // Onboard client form
  const [clientName, setClientName] = useState('');
  const [clientDomain, setClientDomain] = useState('');
  const [clientMsg, setClientMsg] = useState<string | null>(null);
  const [clientErr, setClientErr] = useState<string | null>(null);

  const analysts = allUsers.filter(u => u.role === 'ANALYST');
  const clients = allUsers.filter(u => u.role === 'CLIENT');

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setCreateMsg(null); setCreateErr(null);
    const username = newEmail.split('@')[0];
    try {
      const res = await fetch(`${apiBase}/admin/create-user/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username, email: newEmail, password: newPassword,
          role: newRole, tenant_id: newHomeTenant,
          assigned_tenant_ids: newRole === 'ANALYST' ? newAllowed : []
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const data = await res.json();
      setCreateMsg(`User "${data.username}" created as ${data.role}`);
      setNewEmail(''); setNewPassword(''); setNewAllowed([]); setShowCreate(false);
      refreshUsers();
    } catch (err: any) { setCreateErr(err.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user permanently?')) return;
    await fetch(`${apiBase}/admin/users/${id}/delete/`, { method: 'DELETE' });
    refreshUsers();
  };

  const startEdit = (u: UserProfile) => {
    setEditingId(u.id!);
    setEditRole(u.role);
    setEditTenant(u.tenant?.id || '');
    setEditAllowed(u.assigned_tenants?.map(t => t.id) || []);
  };

  const saveEdit = async (id: number) => {
    await fetch(`${apiBase}/admin/users/${id}/`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: editRole, tenant_id: editTenant, assigned_tenant_ids: editAllowed
      })
    });
    setEditingId(null);
    refreshUsers();
  };

  const toggleAllowed = (id: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  const handleOnboardClient = async (e: FormEvent) => {
    e.preventDefault(); setClientMsg(null); setClientErr(null);
    try {
      const res = await fetch(`${apiBase}/admin/onboard-client/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clientName, domain: clientDomain })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const data = await res.json();
      setClientMsg(`"${data.name}" onboarded successfully`);
      setClientName(''); setClientDomain('');
      refreshTenants();
    } catch (err: any) { setClientErr(err.message); }
  };

  const renderUserRow = (u: UserProfile) => {
    const isEditing = editingId === u.id;
    return (
      <tr key={u.id} className="border-b border-[#F2F5F3] hover:bg-[#F9FAF9] transition-all">
        <td className="px-5 py-4 text-xs font-bold text-gray-800">{u.email}</td>
        <td className="px-5 py-4">
          {isEditing ? (
            <select value={editRole} onChange={e => setEditRole(e.target.value)}
              className="bg-white border border-[#DCE5DE] px-2 py-1 rounded-xl text-[10px] font-bold">
              <option value="ANALYST">ANALYST</option>
              <option value="CLIENT">CLIENT</option>
            </select>
          ) : (
            <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold ${
              u.role === 'ANALYST' ? 'bg-[#E3F2FD] text-[#1565C0]' : 'bg-[#FFF8E1] text-[#F57F17]'
            }`}>{u.role}</span>
          )}
        </td>
        <td className="px-5 py-4 text-xs text-gray-600 font-semibold">
          {isEditing ? (
            <select value={editTenant} onChange={e => setEditTenant(e.target.value)}
              className="bg-white border border-[#DCE5DE] px-2 py-1 rounded-xl text-[10px] font-bold">
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (u.tenant?.name || '—')}
        </td>
        <td className="px-5 py-4">
          {isEditing ? (
            <div className="flex flex-wrap gap-1">
              {tenants.map(t => (
                <button key={t.id} type="button"
                  onClick={() => toggleAllowed(t.id, editAllowed, setEditAllowed)}
                  className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all ${
                    editAllowed.includes(t.id) ? 'bg-[#005E43] text-white border-[#005E43]' : 'bg-white text-gray-500 border-[#EDF2ED]'
                  }`}>{t.name}</button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {u.assigned_tenants?.map(t => (
                <span key={t.id} className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-[#EAF5EF] text-[#005E43]">{t.name}</span>
              ))}
              {(!u.assigned_tenants || u.assigned_tenants.length === 0) && <span className="text-[10px] text-gray-400">—</span>}
            </div>
          )}
        </td>
        <td className="px-5 py-4 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {isEditing ? (
              <>
                <button onClick={() => saveEdit(u.id!)} className="bg-[#005E43] text-white p-1.5 rounded-xl hover:bg-[#004A34]"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditingId(null)} className="bg-gray-100 text-gray-500 p-1.5 rounded-xl hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <button onClick={() => startEdit(u)} className="bg-[#F3F6F4] text-gray-600 p-1.5 rounded-xl hover:bg-[#EDF2ED]"><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(u.id!)} className="bg-[#FFEBEE] text-[#C62828] p-1.5 rounded-xl hover:bg-[#FFCDD2]"><Trash2 className="w-3.5 h-3.5" /></button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">User Management</h2>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-0.5">Manage analysts, clients & permissions</p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); setCreateMsg(null); setCreateErr(null); }}
          className="bg-[#005E43] text-white px-4 py-2.5 rounded-2xl text-xs font-bold hover:bg-[#004A34] transition-all flex items-center gap-2 shadow-sm">
          <PlusCircle className="w-4 h-4" /> Create User
        </button>
      </div>

      {createMsg && <div className="p-3 bg-[#EAF5EF] border border-[#D5EAE0] rounded-2xl text-xs font-bold text-[#005E43]">{createMsg}</div>}
      {createErr && <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600">{createErr}</div>}

      {/* Create User Form */}
      {showCreate && (
        <form onSubmit={handleCreateUser} className="bg-[#F8FAF8] border border-[#EDF2ED] p-6 rounded-3xl flex flex-col gap-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><PlusCircle className="w-4 h-4 text-[#005E43]" /> New User Account</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@breathe.com" required
                className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#005E43]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Password</label>
              <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="password123" required
                className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#005E43]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Role</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)}
                className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none">
                <option value="ANALYST">ANALYST</option>
                <option value="CLIENT">CLIENT</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Home Tenant</label>
            <select value={newHomeTenant} onChange={e => setNewHomeTenant(e.target.value)} required
              className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none">
              <option value="">— Select —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {newRole === 'ANALYST' && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Allowed Client Scopes</label>
              <div className="bg-white border border-[#DCE5DE] p-3 rounded-2xl flex flex-wrap gap-2">
                {tenants.map(t => (
                  <label key={t.id} className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={newAllowed.includes(t.id)} onChange={() => toggleAllowed(t.id, newAllowed, setNewAllowed)}
                      className="w-4 h-4 rounded text-[#005E43] focus:ring-[#005E43] border-gray-300" />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold">Cancel</button>
            <button type="submit" className="bg-[#005E43] text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-[#004A34]">Create Account</button>
          </div>
        </form>
      )}

      {/* Analysts Table */}
      <section className="bg-white rounded-3xl border border-[#EDF2ED] overflow-hidden">
        <div className="bg-[#F8FAF8] px-6 py-4 border-b border-[#EDF2ED] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1565C0]" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Analysts ({analysts.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FAFBFA] text-gray-400 text-[10px] font-extrabold uppercase tracking-widest border-b border-[#EDF2ED]">
              <tr>
                <th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Home Tenant</th><th className="px-5 py-3">Allowed Scopes</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>{analysts.length ? analysts.map(renderUserRow) : <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-gray-400">No analysts yet</td></tr>}</tbody>
          </table>
        </div>
      </section>

      {/* Clients Table */}
      <section className="bg-white rounded-3xl border border-[#EDF2ED] overflow-hidden">
        <div className="bg-[#F8FAF8] px-6 py-4 border-b border-[#EDF2ED] flex items-center gap-2">
          <Building className="w-4 h-4 text-[#F57F17]" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Clients ({clients.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FAFBFA] text-gray-400 text-[10px] font-extrabold uppercase tracking-widest border-b border-[#EDF2ED]">
              <tr>
                <th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Home Tenant</th><th className="px-5 py-3">Allowed Scopes</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>{clients.length ? clients.map(renderUserRow) : <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-gray-400">No clients yet</td></tr>}</tbody>
          </table>
        </div>
      </section>

      {/* Onboard Client Tenant */}
      <section className="bg-[#F8FAF8] border border-[#EDF2ED] p-6 rounded-3xl">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4"><Building className="w-4 h-4 text-[#005E43]" /> Onboard New Client Tenant</h3>
        <form onSubmit={handleOnboardClient} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Company Name</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Acme Corp" required
              className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#005E43]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Domain</label>
            <input value={clientDomain} onChange={e => setClientDomain(e.target.value)} placeholder="acme.com" required
              className="w-full bg-white border border-[#DCE5DE] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#005E43]" />
          </div>
          <button type="submit" className="bg-[#005E43] text-white py-2.5 rounded-2xl text-xs font-bold hover:bg-[#004A34] flex items-center justify-center gap-2">
            <PlusCircle className="w-4 h-4" /> Onboard
          </button>
        </form>
        {clientMsg && <div className="mt-3 p-3 bg-[#EAF5EF] border border-[#D5EAE0] rounded-2xl text-xs font-bold text-[#005E43]">{clientMsg}</div>}
        {clientErr && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600">{clientErr}</div>}
      </section>
    </div>
  );
}

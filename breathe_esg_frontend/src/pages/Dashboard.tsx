import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import LedgerView from './LedgerView';
import UserManager from './UserManager';
import { Database, FileText, Users, LogOut, ShieldAlert } from 'lucide-react';

type Tab = 'ledger' | 'users';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('ledger');

  return (
    <div className="min-h-screen bg-[#D6E2DB] flex p-4 gap-4 font-sans text-gray-800">
      
      {/* Premium left sidebar */}
      <aside className="w-64 bg-white rounded-[32px] border border-white/60 p-6 flex flex-col justify-between shadow-xl flex-shrink-0">
        <div className="flex flex-col gap-6">
          
          {/* Logo brand */}
          <div className="flex items-center gap-3 px-2">
            <div className="bg-[#005E43] p-2 rounded-2xl flex items-center justify-center shadow-md">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-gray-900 leading-none">Breathe ESG</h1>
              <span className="text-[8px] font-extrabold text-gray-400 tracking-wider uppercase">ESG Platform</span>
            </div>
          </div>

          {/* Active User Card */}
          <div className="bg-[#F8FAF8] border border-[#EDF2ED] p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-800 uppercase tracking-widest bg-[#EAF5EF] px-2 py-0.5 rounded-lg w-fit">
              <ShieldAlert className="w-3 h-3 text-[#005E43]" /> {user?.role} Scope
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-gray-800 truncate">{user?.email}</span>
              <span className="text-[10px] font-semibold text-gray-400 mt-0.5 truncate">{user?.tenant?.name || 'Global'}</span>
            </div>
          </div>

          {/* Sidebar Menu Options */}
          <nav className="flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'ledger'
                  ? 'bg-[#005E43] text-white shadow-md'
                  : 'text-gray-500 hover:bg-[#F3F6F4] hover:text-gray-800'
              }`}
            >
              <FileText className="w-4 h-4" /> Compliance Ledger
            </button>

            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                  activeTab === 'users'
                    ? 'bg-[#005E43] text-white shadow-md'
                    : 'text-gray-500 hover:bg-[#F3F6F4] hover:text-gray-800'
                }`}
              >
                <Users className="w-4 h-4" /> User Management
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar signout button */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-[#C62828] hover:bg-[#FFEBEE] transition-all mt-auto"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </aside>

      {/* Main compliance content panel container */}
      <main className="flex-1 bg-white rounded-[32px] border border-white/60 p-8 shadow-xl overflow-y-auto">
        {activeTab === 'ledger' && <LedgerView />}
        {activeTab === 'users' && user?.role === 'ADMIN' && <UserManager />}
      </main>
    </div>
  );
}

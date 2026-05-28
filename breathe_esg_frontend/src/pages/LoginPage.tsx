import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Database, AlertTriangle, ArrowRight, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await login(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  const quickFill = (em: string, pw: string) => { setEmail(em); setPassword(pw); setError(null); };

  return (
    <div className="min-h-screen bg-[#D6E2DB] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl p-8 border border-white/60 flex flex-col gap-6">
        <div className="text-center">
          <div className="bg-[#005E43] p-3.5 rounded-3xl inline-flex items-center justify-center shadow-md mb-3">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Breathe ESG</h2>
          <p className="mt-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@breathe.com"
                className="w-full bg-[#F3F6F4] border border-[#DCE5DE] pl-10 pr-4 py-2.5 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#005E43]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F3F6F4] border border-[#DCE5DE] pl-10 pr-4 py-2.5 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#005E43]"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-[#005E43] text-white py-3.5 rounded-2xl text-xs font-bold hover:bg-[#004A34] transition-all flex items-center justify-center gap-2 shadow-md uppercase tracking-wider disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : <>Sign In <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        {/* Quick-fill demo credentials */}
        <div className="border-t border-[#EDF2ED] pt-4">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-3 text-center">Demo Credentials</span>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Admin', email: 'admin@breathe.com', pw: 'admin123', badge: 'bg-[#005E43] text-white' },
              { label: 'Analyst', email: 'analyst1@breathe.com', pw: 'analyst123', badge: 'bg-[#E3F2FD] text-[#1565C0]' },
              { label: 'Client', email: 'client1@breathe.com', pw: 'client123', badge: 'bg-[#FFF8E1] text-[#F57F17]' },
            ].map(c => (
              <button key={c.email} type="button" onClick={() => quickFill(c.email, c.pw)}
                className="w-full bg-[#F8FAF8] hover:bg-[#EDF2ED] border border-[#EDF2ED] p-3 rounded-2xl text-left flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold ${c.badge}`}>{c.label.toUpperCase()}</span>
                  <span className="text-xs font-bold text-gray-700">{c.email}</span>
                </div>
                <span className="text-[10px] font-mono text-gray-400">{c.pw}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

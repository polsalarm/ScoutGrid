import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, X, Zap, AlertCircle } from 'lucide-react';
import { registerUser, getUsername } from '../../lib/contract';
import { useScoutStore } from '../../lib/store';
import { showToast } from './Toast';

interface RegisterModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function RegisterModal({ onClose, onSuccess }: RegisterModalProps) {
  const { walletAddress, setIsRegistered, setUsername } = useScoutStore();
  const [ign, setIgn] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!ign) return;
    setError('');

    setIsRegistering(true);
    try {
      const existingIgn = await getUsername(walletAddress!);

      if (!existingIgn) {
        await registerUser(walletAddress!, ign);
      } else {
        console.log('[Register] Already registered with IGN:', existingIgn);
      }

      setIsRegistered(true);
      setUsername(existingIgn || ign);
      showToast('success', 'Handle Claimed', `Welcome to the Grid, ${existingIgn || ign}!`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = 'Registration failed. Handle might be taken or transaction rejected.';
      setError(msg);
      showToast('error', 'Registration Failed', msg);
    } finally {
      setIsRegistering(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#020710]/90 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm bg-[#0a0f1b] border border-electric/40 shadow-[0_0_40px_rgba(0,240,255,0.1)] relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors">
          <X size={16} />
        </button>

        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white italic tracking-tighter flex items-center space-x-2 underline decoration-electric/30">
              <Shield className="text-electric" size={24} />
              <span>JOIN THE GRID</span>
            </h2>
            <p className="text-slate-500 mt-1 font-mono text-[10px] uppercase tracking-widest">Verify Identity on Testnet</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Claim Your IGN (In-Game Name)</label>
              <div className="relative">
                <input 
                  type="text"
                  value={ign}
                  onChange={(e) => setIgn(e.target.value)}
                  placeholder="e.g. SKYLARK_01"
                  className="w-full bg-[#121c26] border border-slate-700 text-white px-4 py-3 rounded-none focus:border-electric transition-colors outline-none pl-12 font-mono text-sm"
                />
                <Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-electric/40" size={16} />
              </div>
            </div>

            <div className="bg-electric/5 border border-electric/20 p-4">
              <p className="text-[10px] text-slate-400 leading-relaxed font-mono italic">
                ◈ By claiming an IGN, you establish your permanent account handle on the ScoutGrid decentralized network. 
              </p>
            </div>

            <div className="flex flex-col items-center">
              {error && (
                <div className="flex items-center space-x-2 text-pink-500 font-mono text-[10px] mb-4 border border-pink-500/20 bg-pink-500/5 px-2 py-1.5 w-full">
                   <AlertCircle size={12} />
                   <span>{error}</span>
                </div>
              )}
              <button
                onClick={handleRegister}
                disabled={isRegistering || !ign}
                className="w-full bg-electric text-slate-900 px-8 py-3 font-black uppercase italic tracking-tighter text-lg hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isRegistering ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-900 border-t-transparent" />
                ) : (
                  <>
                    <Zap size={16} />
                    <span>CLAIM HANDLE</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

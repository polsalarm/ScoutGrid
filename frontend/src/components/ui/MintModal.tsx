import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, X, Zap, Trophy, Plus, Trash2, Info } from 'lucide-react';
import { mintPlayerProfile } from '../../lib/contract';
import { useScoutStore } from '../../lib/store';
import { showToast } from './Toast';
import type { Player } from '../../lib/types';
import { TOURNAMENTS, AWARDS, ROLES } from '../../lib/constants';

interface MintModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function MintModal({ onClose, onSuccess }: MintModalProps) {
  const { walletAddress, username, addPlayer, securePlayer, setIsMinted } = useScoutStore();
  
  const [role, setRole] = useState(ROLES[0]);
  const [bio, setBio] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [isMinting, setIsMinting] = useState(false);

  // Achievement Builder State
  const [selectedTournament, setSelectedTournament] = useState(TOURNAMENTS[0]);
  const [selectedAward, setSelectedAward] = useState(AWARDS[0]);
  const [achievements, setAchievements] = useState<string[]>([]);

  const addAchievement = () => {
    const newAch = `${selectedTournament} - ${selectedAward}`;
    if (!achievements.includes(newAch)) {
      setAchievements([...achievements, newAch]);
    }
  };

  const removeAchievement = (index: number) => {
    setAchievements(achievements.filter((_, i) => i !== index));
  };

  const handleMint = async () => {
    if (!listPrice || !bio) return;
    const price = parseInt(listPrice);
    
    setIsMinting(true);
    try {
      await mintPlayerProfile(walletAddress!, role, bio, achievements, price);

      const newPlayer = {
        id: Math.random().toString(36).substr(2, 9),
        name: username || 'Player',
        role,
        bio,
        achievements,
        winPoints: 0,
        address: walletAddress!,
        owner: walletAddress!,
        price,
        isListed: true,
        endTime: '12:00',
        stats: {
          kda: '0.0',
          winRate: '0%',
          matches: 0,
          tournamentsWon: 0,
          mvpAwards: 0,
          avgGoldMin: '0'
        }
      } as Player;

      addPlayer(newPlayer);
      securePlayer(newPlayer);
      setIsMinted(true);
      showToast('success', 'Profile Minted', `${username || 'Player'} is now live on the Market Grid.`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Minting failed. Check console.';
      showToast('error', 'Mint Failed', msg);
    } finally {
      setIsMinting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#020710]/95 backdrop-blur-xl">
      <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#0a1118] border border-electric/30 shadow-[0_0_50px_rgba(0,240,255,0.15)] relative">

        {/* Decorative top bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-electric to-transparent" />

        <div className="relative p-6 sm:p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-3xl font-black text-white italic tracking-tighter flex items-center space-x-3">
                <Shield className="text-electric" size={32} />
                <span>MINT PLAYER PROFILE</span>
              </h2>
              <p className="text-slate-400 mt-1 font-mono text-sm uppercase tracking-widest">
                Owner Verified: <span className="text-electric">{username || walletAddress?.slice(0, 8)}</span>
              </p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Basic Info */}
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Primary Role</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-[#121c26] border border-slate-700 text-white px-4 py-3 rounded-none focus:border-electric transition-colors outline-none"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Scout Bio / Definition</label>
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe your playstyle, hero pool, and competitive history..."
                  rows={4}
                  className="w-full bg-[#121c26] border border-slate-700 text-white px-4 py-3 rounded-none focus:border-electric transition-colors outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Market Asking Price (XLM)</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full bg-[#121c26] border border-slate-700 text-white px-4 py-3 rounded-none focus:border-electric transition-colors outline-none pl-12"
                  />
                  <Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-electric" size={18} />
                </div>
              </div>

              <div className="bg-electric/5 border border-electric/20 p-4 flex items-start space-x-3">
                <Info size={20} className="text-electric shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong className="text-electric uppercase">Note:</strong> Win Points (WP) are awarded automatically by the ScoutGrid WebApp based on validated tournament performances. Your initial WP will be 0.
                </p>
              </div>
            </div>

            {/* Right Column: Achievement Builder */}
            <div className="bg-[#121c26] p-6 border border-slate-700/50">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center space-x-2">
                <Trophy size={16} className="text-yellow-500" />
                <span>Achievement Builder</span>
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tournament</label>
                  <select 
                    value={selectedTournament}
                    onChange={(e) => setSelectedTournament(e.target.value as any)}
                    className="w-full bg-[#0a1118] border border-slate-700 text-xs text-white px-3 py-2 outline-none focus:border-electric"
                  >
                    {TOURNAMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Award / Place</label>
                  <select 
                    value={selectedAward}
                    onChange={(e) => setSelectedAward(e.target.value as any)}
                    className="w-full bg-[#0a1118] border border-slate-700 text-xs text-white px-3 py-2 outline-none focus:border-electric"
                  >
                    {AWARDS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <button 
                  onClick={addAchievement}
                  className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 transition-colors uppercase tracking-widest border border-slate-600"
                >
                  <Plus size={14} />
                  <span>Add Achievement</span>
                </button>
              </div>

              {/* Achievements List */}
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                {achievements.length === 0 ? (
                  <p className="text-center text-slate-600 italic text-xs py-8">No achievements added yet.</p>
                ) : (
                  achievements.map((ach, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-[#0a1118] border border-slate-800 px-3 py-2 group">
                      <span className="text-[11px] text-slate-300 font-mono">{ach}</span>
                      <button 
                        onClick={() => removeAchievement(idx)}
                        className="text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center">
            <button
              onClick={handleMint}
              disabled={isMinting || !bio || !listPrice}
              className="w-full max-w-sm bg-electric text-slate-900 px-8 py-4 font-black uppercase italic tracking-tighter text-xl hover:shadow-[0_0_30px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50 flex items-center justify-center space-x-3"
            >
              {isMinting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-900 border-t-transparent" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Shield size={24} />
                  <span>TRANSMIT TO MARKET GRID</span>
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

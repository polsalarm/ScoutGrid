import { useScoutStore } from '../lib/store';
import { Achievements } from './Achievements';
import { Trophy, AlertTriangle, ShieldCheck } from 'lucide-react';

export function MyAchievements() {
  const { walletAddress, players, isRegistered, isMinted, username } = useScoutStore();

  // Find the player object for the connected wallet — pick the most recent if multiple exist
  const myPlayer = [...players].reverse().find(p => p.address === walletAddress);

  if (!isRegistered) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-6 border border-pink-500/30 bg-pink-500/5 mb-6 rounded-sm">
          <AlertTriangle size={48} className="text-pink-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Identity Not Verified</h2>
          <p className="text-slate-400 font-mono text-sm max-w-md">
            The career tracking system requires a verified on-chain identity. 
            Please connect your wallet and complete the "Verify Identity" stage.
          </p>
        </div>
      </div>
    );
  }

  if (!isMinted || !myPlayer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-8 border border-electric/30 bg-electric/5 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
             <Trophy size={120} />
          </div>
          <Trophy size={48} className="text-electric mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Career Profile Pending</h2>
          <p className="text-slate-400 font-mono text-sm max-w-lg mb-8">
            Welcome, <span className="text-electric">{username}</span>. Your identity is verified, but your pro-scout 
            contract has not been listed on the grid yet.
          </p>
          
          <div className="bg-[#0a1118] border border-slate-700 p-4 mb-4 text-left">
             <div className="flex items-start space-x-3 text-electric/80 font-mono text-[10px] uppercase leading-relaxed">
                <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                   SYSTEM NOTE: Professional career tracking and performance metrics officially 
                   commenced upon your identity verification. Mint your profile now to sync 
                   your history with the global talent grid.
                </span>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      {/* Career Tracking Header Note */}
      <div className="mb-8 bg-electric/5 border border-electric/20 p-4 flex items-center space-x-4">
        <div className="p-2 bg-electric/10 text-electric">
          <ShieldCheck size={20} />
        </div>
        <div>
          <div className="text-[10px] font-bold text-electric uppercase tracking-[0.2em] mb-0.5">Scout Record Protocol // Active</div>
          <p className="text-slate-400 font-mono text-[11px] leading-tight">
             Career tracking and win-point accumulation officially commenced upon your identity verification on the grid.
          </p>
        </div>
      </div>

      {/* Re-use the Achievements view but without the "Back" button if it's a top-level page */}
      {/* We pass a no-op for onBack since we are staying on this page */}
      <Achievements player={myPlayer} onBack={() => {}} />
    </div>
  );
}

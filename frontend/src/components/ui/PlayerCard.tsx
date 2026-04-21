import { useState } from 'react';
import { Trophy, Clock, Cpu, Zap, ShieldCheck, Landmark } from 'lucide-react';
import { useScoutStore } from '../../lib/store';
import { buyout as contractBuyout, acceptBid as contractAcceptBid, syncGlobalMarket } from '../../lib/contract';
import { showToast } from './Toast';
import type { Player } from '../../lib/types';
import { BidModal } from './BidModal';
import { LoanModal } from './LoanModal';
import { LoanBadge } from './LoanBadge';

interface PlayerCardProps {
  player: Player;
  onViewAchievements: (player: Player) => void;
}

export function PlayerCard({ player, onViewAchievements }: PlayerCardProps) {
  const { walletAddress, setPlayers, loans } = useScoutStore();
  const [showBidModal, setShowBidModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [secured, setSecured] = useState(false);

  const isOwner = walletAddress === player.owner;
  const hasBid = player.highestBid && player.highestBid > 0;
  const activeLoan = loans[player.address] ?? null;

  const handleBuyout = async () => {
    if (!walletAddress) return;
    setIsProcessing(true);
    try {
      await contractBuyout(walletAddress, player.address);
      await syncGlobalMarket(setPlayers);
      setSecured(true);
      showToast('success', 'Buyout Confirmed', `${player.name} added to your roster.`);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Transaction failed or was rejected.';
      showToast('error', 'Buyout Failed', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptBid = async () => {
    if (!walletAddress) return;
    setIsProcessing(true);
    try {
      await contractAcceptBid(walletAddress, player.address);
      await syncGlobalMarket(setPlayers);
      showToast('success', 'Bid Accepted', 'Contract ownership has been transferred.');
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to accept bid.';
      showToast('error', 'Accept Failed', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-[#0a0f1b] border border-slate-800 hover:border-electric/50 hover:scale-[1.03] hover:shadow-[0_0_28px_rgba(0,240,255,0.12)] transition-all duration-200 p-6 flex flex-col relative cursor-default">

      {/* Top row: address tag + WP badge */}
      <div className="flex justify-between items-center mb-4">
        <div className="border border-electric/30 text-electric font-mono text-[10px] px-2 py-0.5 bg-electric/5 uppercase tracking-tighter">
          {player.address.length > 10 
            ? `${player.address.slice(0, 4)}...${player.address.slice(-4)}` 
            : player.address}
        </div>
        <div className="flex items-center space-x-1.5 text-[#39ff14] font-mono text-sm border border-[#39ff14]/20 bg-[#39ff14]/5 px-2.5 py-1">
          <Trophy size={13} />
          <span>{player.winPoints} WP</span>
        </div>
      </div>

      {/* Player identity */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="p-3 bg-slate-800/80 border border-slate-700 text-electric flex-shrink-0">
          <Cpu size={24} />
        </div>
        <div>
          <div className="text-slate-100 font-black uppercase tracking-widest text-lg leading-none">
            {player.name}
          </div>
          <div className="flex items-center space-x-1 text-electric font-mono text-xs mt-1.5">
            <Zap size={11} />
            <span className="uppercase">{player.role}</span>
          </div>
        </div>
      </div>

      {/* Bio */}
      <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-3 flex-1">
        {player.bio}
      </p>

      {/* Auction ends */}
      <div className="flex items-center justify-between text-xs font-mono mb-1.5">
        <div className="flex items-center space-x-1.5 text-slate-500">
          <Clock size={12} />
          <span>Auction ends</span>
        </div>
        <span className="text-red-400 font-bold">{player.endTime}</span>
      </div>

      {/* Achievements count - clickable */}
      <button
        onClick={() => onViewAchievements(player)}
        className="flex items-center space-x-1.5 text-xs font-mono text-slate-500 hover:text-electric transition-colors mb-5 text-left"
      >
        <ShieldCheck size={12} />
        <span>{player.achievements.length} verified achievements</span>
      </button>

      {/* Divider */}
      <div className="border-t border-slate-800 mb-4" />

      {/* Buyout price row */}
      <div className="flex items-center justify-between font-mono mb-4">
        <div className="flex flex-col">
          <span className="text-slate-500 text-[10px] uppercase tracking-widest">Buyout Price</span>
          {player.highestBid && (
            <span className="text-electric/60 text-[9px] uppercase font-bold">Current Bid: {player.highestBid.toLocaleString()} XLM</span>
          )}
        </div>
        <span className="text-slate-100 font-bold text-xl">
          {(player.price || 0).toLocaleString()} <span className="text-electric text-base">XLM</span>
        </span>
      </div>

      {/* Action area — adaptive based on ownership and bids */}
      {secured ? (
        <div className="text-center border border-[#39ff14]/40 bg-[#39ff14]/5 text-[#39ff14] font-mono text-xs py-3 uppercase tracking-widest">
          ✓ Secured to Roster
        </div>
      ) : isOwner ? (
        <div className="flex flex-col space-y-2">
          {activeLoan ? (
            <LoanBadge loan={activeLoan} />
          ) : hasBid ? (
            <button
              onClick={handleAcceptBid}
              disabled={isProcessing}
              className="w-full border border-green-500/60 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-slate-900 py-3 text-xs font-bold uppercase tracking-widest transition-all"
            >
              {isProcessing ? 'Processing...' : `Accept Bid (${player.highestBid} XLM)`}
            </button>
          ) : (
            <div className="text-center border border-slate-800 bg-slate-800/20 text-slate-500 font-mono text-[10px] py-3 uppercase tracking-widest">
              Awaiting Bids
            </div>
          )}
          {!activeLoan && (
            <button
              onClick={() => setShowLoanModal(true)}
              className="w-full flex items-center justify-center space-x-1.5 border border-amber-500/40 bg-amber-500/5 text-amber-500 hover:bg-amber-500/15 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              <Landmark size={11} />
              <span>Borrow Against</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowBidModal(true)}
            className="flex-1 flex items-center justify-center space-x-1.5 border border-pink-500/60 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors"
          >
            <Zap size={12} />
            <span>Place Bid</span>
          </button>
          <button
            onClick={handleBuyout}
            disabled={isProcessing}
            className="flex-1 border border-electric/60 bg-electric/10 text-electric hover:bg-electric hover:text-slate-900 py-2.5 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {isProcessing ? '...' : 'Buyout'}
          </button>
        </div>
      )}

      {showBidModal && (
        <BidModal
          player={player}
          onClose={() => setShowBidModal(false)}
          onSuccess={() => setSecured(true)}
        />
      )}
      {showLoanModal && (
        <LoanModal
          player={player}
          onClose={() => setShowLoanModal(false)}
          onSuccess={() => syncGlobalMarket(setPlayers)}
        />
      )}
    </div>
  );
}

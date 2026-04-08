import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap, X, Clock, AlertCircle, Wallet, CheckCircle2 } from 'lucide-react';
import { requestAccess, isConnected } from '@stellar/freighter-api';
import { placeBid as contractPlaceBid, buyout as contractBuyout, syncGlobalMarket } from '../../lib/contract';
import { useScoutStore } from '../../lib/store';
import type { Player } from '../../lib/mock-data';

interface BidModalProps {
  player: Player;
  onClose: () => void;
  onSuccess: () => void;
}

export function BidModal({ player, onClose, onSuccess }: BidModalProps) {
  const { walletAddress, setWalletAddress, setPlayers } = useScoutStore();
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const connectWallet = async () => {
    setIsConnecting(true);
    setError('');
    try {
      const connected = await isConnected();
      if (!connected) {
        setError('Freighter extension not detected. Please install it.');
        return;
      }
      const access = await requestAccess();
      if (access.error) { setError(access.error); return; }
      setWalletAddress(access.address);
    } catch {
      setError('Failed to connect wallet.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setStatusMsg('');
    const num = parseInt(bidAmount);
    if (!num || num <= 0) {
      setError('Enter a valid XLM amount.');
      return;
    }
    if (num >= player.price) {
      setError(`Bid must be lower than the buyout price of ${player.price} XLM.`);
      return;
    }

    setIsSubmitting(true);
    try {
      setStatusMsg('Simulating on Soroban...');
      // Real contract call — triggers Freighter popup
      await contractPlaceBid(walletAddress!, player.address, num);
      await syncGlobalMarket(setPlayers); // Refetch fresh on-chain data

      setStatusMsg('Confirmed! Grid updated.');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Transaction failed or was rejected.';
      setError(msg);
      setStatusMsg('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBuyout = async () => {
    if (!walletAddress) return;
    setError('');
    setStatusMsg('');
    setIsSubmitting(true);

    try {
      setStatusMsg('Initiating Buyout on Soroban...');
      // 1. Contract Call
      await contractBuyout(walletAddress, player.address);
      await syncGlobalMarket(setPlayers); // Refetch fresh state

      setStatusMsg('Purchase confirmed! Updating Global Grid...');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Buyout failed or was rejected.';
      setError(msg);
      setStatusMsg('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,7,16,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div
        className="w-full max-w-sm bg-[#0a0f1b] border border-pink-500/70 relative"
        style={{ boxShadow: '0 0 40px rgba(236,72,153,0.2)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-200 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-pink-500 font-black uppercase tracking-widest text-sm mb-2">
            <Zap size={14} />
            <span>Place a Bid</span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            Bidding on <span className="font-bold text-slate-100">{player.name}</span>'s contract.
            Buyout is <span className="font-bold text-slate-100">{(player.price || 0).toLocaleString()} XLM</span>.
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Auction timer row */}
          <div className="flex items-center justify-between border border-slate-700 bg-slate-900/50 px-4 py-3">
            <div className="flex items-center space-x-2 text-slate-400 font-mono text-xs">
              <Clock size={12} />
              <span>Auction closes</span>
            </div>
            <div className="flex items-center space-x-1 border border-pink-500/60 bg-pink-500/10 text-pink-400 font-mono text-[10px] px-2 py-0.5 uppercase tracking-widest">
              <Clock size={9} />
              <span>{player.endTime}</span>
            </div>
          </div>

          {/* Bid input */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">
              Your Bid (XLM)
            </label>
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => { setBidAmount(e.target.value); setError(''); }}
              placeholder="Min: 1 XLM"
              autoFocus
              className="w-full bg-[#0F172A] border border-slate-600 focus:border-pink-500 text-slate-200 px-4 py-3 text-sm font-mono outline-none transition-colors"
            />
            <div className="mt-2 space-y-0.5">
              <p className="text-slate-500 font-mono text-[10px]">Must be lower than the buyout price.</p>
              <p className="text-slate-500 font-mono text-[10px]">
                Bids below {(player.price || 0).toLocaleString()} XLM signal bargain intent.
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center space-x-2 text-pink-400 font-mono text-[10px] border border-pink-500/30 bg-pink-500/5 px-3 py-2">
              <AlertCircle size={12} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Connect wallet CTA (shown when not connected) */}
          {!walletAddress && (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="w-full border border-pink-500/50 text-pink-400 hover:bg-pink-500/10 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              <span className="flex items-center justify-center space-x-2">
                <Wallet size={12} />
                <span>{isConnecting ? 'Connecting...' : 'Connect your Freighter wallet to bid'}</span>
              </span>
            </button>
          )}

          {/* Status / progress message */}
          {statusMsg && !error && (
            <div className="flex items-center space-x-2 text-electric font-mono text-[10px] border border-electric/20 bg-electric/5 px-3 py-2">
              <span className="animate-pulse">◈</span>
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Footer buttons */}
          <div className="space-y-3 pt-1">
            <button
               onClick={handleBuyout}
               disabled={!walletAddress || isSubmitting}
               className="w-full bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-electric border border-electric/40 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all disabled:opacity-40 flex items-center justify-center space-x-2"
            >
               <CheckCircle2 size={14} />
               <span>{isSubmitting ? (statusMsg || 'Processing...') : 'Instant Buyout'}</span>
            </button>

            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="flex-1 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!walletAddress || isSubmitting || !bidAmount}
                className="flex-1 flex items-center justify-center space-x-1 border border-pink-500/60 bg-pink-500/10 text-pink-400 hover:bg-pink-500 hover:text-white py-2.5 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Zap size={11} />
                <span>Submit Bid</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

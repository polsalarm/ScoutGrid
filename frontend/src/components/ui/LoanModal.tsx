import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, TrendingUp, AlertCircle } from 'lucide-react';
import { useScoutStore } from '../../lib/store';
import { takePlayerLoan, getPoolBalance } from '../../lib/contract';
import { showToast } from './Toast';
import type { Player } from '../../lib/types';

interface LoanModalProps {
  player: Player;
  onClose: () => void;
  onSuccess: () => void;
}

const LTV_TIERS = [
  { maxWp: 0,  ltv: 50, label: '50%' },
  { maxWp: 2,  ltv: 55, label: '55%' },
  { maxWp: 5,  ltv: 65, label: '65%' },
  { maxWp: 9,  ltv: 72, label: '72%' },
  { maxWp: Infinity, ltv: 80, label: '80%' },
];

function getLtv(winPoints: number) {
  return LTV_TIERS.find(t => winPoints <= t.maxWp) ?? LTV_TIERS[LTV_TIERS.length - 1];
}

export function LoanModal({ player, onClose, onSuccess }: LoanModalProps) {
  const { walletAddress, setLoan } = useScoutStore();
  const [amount, setAmount] = useState(0);
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const tier = getLtv(player.winPoints);
  const maxByLtv = Math.floor(player.price * tier.ltv / 100);
  const maxBorrow = poolBalance !== null ? Math.min(maxByLtv, poolBalance) : maxByLtv;
  const repayPreview = amount > 0 ? amount + Math.floor(amount * 500 / 10_000) : 0;

  useEffect(() => {
    getPoolBalance().then(setPoolBalance);
  }, []);

  const handleLoan = async () => {
    if (!walletAddress || amount <= 0) return;
    if (amount > maxBorrow) {
      setError(`Maximum borrowable is ${maxBorrow.toLocaleString()} XLM.`);
      return;
    }
    setIsProcessing(true);
    setError('');
    try {
      await takePlayerLoan(walletAddress, player.address, amount);
      setLoan(player.address, {
        borrower: walletAddress,
        principal: amount,
        startLedger: 0,
        dueLedger: 0,
      });
      showToast('success', 'Loan Secured', `${amount.toLocaleString()} XLM borrowed against ${player.name}.`);
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed.';
      setError(msg);
      showToast('error', 'Loan Failed', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,7,16,0.92)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm bg-[#0a0f1b] border border-amber-500/30"
        style={{ boxShadow: '0 0 40px rgba(245,158,11,0.08)' }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 font-black uppercase tracking-widest text-sm mb-1">
              <Lock size={14} />
              <span>Collateral Loan</span>
            </div>
            <p className="text-slate-400 text-xs font-mono">
              Lock <span className="text-white font-bold">{player.name}</span> as collateral to borrow XLM.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors mt-0.5">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* LTV tier */}
          <div className="flex items-center justify-between border border-slate-800 bg-slate-900/40 px-4 py-3">
            <div>
              <div className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mb-0.5">LTV Tier</div>
              <div className="text-xs font-bold text-amber-400 font-mono">{tier.ltv}% of list price</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mb-0.5">Win Points</div>
              <div className="text-xs font-bold text-[#39ff14] font-mono">{player.winPoints} WP</div>
            </div>
          </div>

          {/* Pool + max */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-800 bg-slate-900/40 px-3 py-2.5">
              <div className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mb-0.5">Pool Available</div>
              <div className="text-sm font-bold text-white font-mono">
                {poolBalance !== null ? `${poolBalance.toLocaleString()} XLM` : '…'}
              </div>
            </div>
            <div className="border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
              <div className="text-[9px] text-amber-500 uppercase font-mono tracking-widest mb-0.5">Max Borrow</div>
              <div className="text-sm font-bold text-amber-400 font-mono">
                {maxBorrow.toLocaleString()} XLM
              </div>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-[9px] text-slate-500 uppercase font-mono tracking-widest mb-1.5">
              Borrow Amount (XLM)
            </label>
            <input
              type="number"
              min={1}
              max={maxBorrow}
              value={amount || ''}
              onChange={(e) => setAmount(Math.min(Number(e.target.value), maxBorrow))}
              placeholder={`1 – ${maxBorrow.toLocaleString()}`}
              className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500/60 text-white font-mono text-sm px-3 py-2.5 outline-none transition-colors"
            />
            <input
              type="range"
              min={0}
              max={maxBorrow}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full mt-2 accent-amber-400"
            />
          </div>

          {/* Repayment preview */}
          {amount > 0 && (
            <div className="flex items-center justify-between border border-slate-800 bg-slate-900/40 px-4 py-3">
              <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-xs">
                <TrendingUp size={12} />
                <span>Repayment (1 term, 5%)</span>
              </div>
              <span className="text-white font-bold font-mono text-sm">
                {repayPreview.toLocaleString()} XLM
              </span>
            </div>
          )}

          {/* Term notice */}
          <p className="text-[9px] text-slate-600 font-mono leading-relaxed">
            Term: ~30 days. Interest compounds each term if overdue.
            Unpaid loans can be liquidated by anyone — ownership transfers to admin.
          </p>

          {error && (
            <div className="flex items-start space-x-2 text-pink-400 font-mono text-[10px] border border-pink-500/30 bg-pink-500/5 px-3 py-2">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleLoan}
            disabled={isProcessing || amount <= 0 || amount > maxBorrow}
            className="w-full border border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-900 py-3 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Locking Collateral…' : `Lock & Borrow ${amount > 0 ? amount.toLocaleString() + ' XLM' : ''}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Unlock, AlertCircle, AlertTriangle } from 'lucide-react';
import { useScoutStore } from '../../lib/store';
import { repayPlayerLoan, getCurrentLedger, LOAN_DURATION_LEDGERS } from '../../lib/contract';
import { showToast } from './Toast';
import type { Player, LoanRecord } from '../../lib/types';

interface RepayModalProps {
  player: Player;
  loan: LoanRecord;
  onClose: () => void;
  onSuccess: () => void;
}

function computeRepayment(loan: LoanRecord, currentLedger: number): number {
  const elapsed = Math.max(0, currentLedger - loan.startLedger);
  const terms = Math.max(1, Math.ceil(elapsed / LOAN_DURATION_LEDGERS));
  let repay = loan.principal;
  for (let i = 0; i < terms; i++) {
    repay = repay + Math.floor(repay * 500 / 10_000);
  }
  return repay;
}

function formatDueDate(loan: LoanRecord, currentLedger: number): string {
  const ledgersLeft = loan.dueLedger - currentLedger;
  if (ledgersLeft <= 0) return 'OVERDUE';
  const seconds = ledgersLeft * 5;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

export function RepayModal({ player, loan, onClose, onSuccess }: RepayModalProps) {
  const { walletAddress, setLoan } = useScoutStore();
  const [currentLedger, setCurrentLedger] = useState(loan.startLedger);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCurrentLedger().then((l) => { if (l > 0) setCurrentLedger(l); });
  }, []);

  const isOverdue = currentLedger > loan.dueLedger;
  const repayment = computeRepayment(loan, currentLedger);
  const interest = repayment - loan.principal;
  const dueLabel = formatDueDate(loan, currentLedger);

  const handleRepay = async () => {
    if (!walletAddress) return;
    setIsProcessing(true);
    setError('');
    try {
      await repayPlayerLoan(walletAddress, player.address);
      setLoan(player.address, null);
      showToast('success', 'Loan Repaid', `${player.name} is unlocked and re-listed.`);
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed.';
      setError(msg);
      showToast('error', 'Repayment Failed', msg);
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
        className={`w-full max-w-sm bg-[#0a0f1b] border ${isOverdue ? 'border-red-500/40' : 'border-amber-500/30'}`}
        style={{ boxShadow: isOverdue ? '0 0 40px rgba(239,68,68,0.08)' : '0 0 40px rgba(245,158,11,0.08)' }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 flex items-start justify-between">
          <div>
            <div className={`flex items-center space-x-2 font-black uppercase tracking-widest text-sm mb-1 ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>
              {isOverdue ? <AlertTriangle size={14} /> : <Unlock size={14} />}
              <span>{isOverdue ? 'Loan Overdue' : 'Repay Loan'}</span>
            </div>
            <p className="text-slate-400 text-xs font-mono">
              Repay to unlock <span className="text-white font-bold">{player.name}</span> and re-list.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors mt-0.5">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Status */}
          <div className={`flex items-center justify-between border px-4 py-3 ${isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800 bg-slate-900/40'}`}>
            <span className="text-[9px] text-slate-500 uppercase font-mono tracking-widest">Loan Status</span>
            <span className={`text-xs font-bold font-mono ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>
              {dueLabel}
            </span>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-500">Principal borrowed</span>
              <span className="text-white">{loan.principal.toLocaleString()} XLM</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-500">Interest accrued (5% compound)</span>
              <span className="text-amber-400">+{interest.toLocaleString()} XLM</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-mono font-bold">
              <span className="text-slate-300">Total repayment</span>
              <span className="text-white">{repayment.toLocaleString()} XLM</span>
            </div>
          </div>

          {isOverdue && (
            <div className="flex items-start space-x-2 text-red-400 font-mono text-[10px] border border-red-500/30 bg-red-500/5 px-3 py-2">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span>
                Loan is past due. Anyone can liquidate this contract. Repay now to recover ownership.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start space-x-2 text-pink-400 font-mono text-[10px] border border-pink-500/30 bg-pink-500/5 px-3 py-2">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleRepay}
            disabled={isProcessing}
            className={`w-full border py-3 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isOverdue
                ? 'border-red-500/60 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
                : 'border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-900'
            }`}
          >
            {isProcessing ? 'Processing Repayment…' : `Repay ${repayment.toLocaleString()} XLM & Unlock`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

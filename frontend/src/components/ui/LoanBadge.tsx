import { Lock } from 'lucide-react';
import type { LoanRecord } from '../../lib/types';
import { LOAN_DURATION_SECONDS } from '../../lib/contract';
import { TOKEN_SYMBOL } from '../../lib/chain';

interface LoanBadgeProps {
  loan: LoanRecord;
  currentTime?: number;
}

export function LoanBadge({ loan, currentTime }: LoanBadgeProps) {
  const secondsLeft = currentTime ? Math.max(0, loan.dueTime - currentTime) : null;
  const isOverdue = currentTime ? currentTime > loan.dueTime : false;

  const dueDateLabel = (() => {
    if (secondsLeft === null) return 'Loading…';
    if (isOverdue) return 'OVERDUE';
    const days = Math.floor(secondsLeft / 86400);
    const hours = Math.floor((secondsLeft % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  })();

  const termsElapsed = currentTime
    ? Math.max(1, Math.ceil((currentTime - loan.startTime) / LOAN_DURATION_SECONDS))
    : 1;
  let repayPreview = loan.principal;
  for (let i = 0; i < termsElapsed; i++) {
    repayPreview = repayPreview + Math.floor(repayPreview * 500 / 10_000);
  }

  return (
    <div className={`flex items-center space-x-2 border px-3 py-2 font-mono text-[10px] ${
      isOverdue
        ? 'border-red-500/50 bg-red-500/10 text-red-400'
        : 'border-amber-500/50 bg-amber-500/10 text-amber-400'
    }`}>
      <Lock size={11} className="flex-shrink-0" />
      <div className="flex flex-col leading-tight">
        <span className="font-bold uppercase tracking-widest">
          {isOverdue ? 'Loan Overdue' : 'Collateral Locked'}
        </span>
        <span className="text-[9px] opacity-70">
          Borrowed {loan.principal.toLocaleString()} {TOKEN_SYMBOL} · Repay {repayPreview.toLocaleString()} {TOKEN_SYMBOL} · {dueDateLabel}
        </span>
      </div>
    </div>
  );
}

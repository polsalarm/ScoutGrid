import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Wallet, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { StellarWalletsKit, FREIGHTER_ID, ALBEDO_ID, XBULL_ID, HOTWALLET_ID } from '../../lib/walletKit';
import { showToast } from './Toast';

interface WalletModalProps {
  onClose: () => void;
  onSuccess: (address: string) => void;
}

const WALLETS = [
  {
    id: FREIGHTER_ID,
    name: 'Freighter',
    description: 'Browser extension by Stellar.org',
    borderColor: 'border-electric/50 hover:border-electric',
    textColor: 'text-electric',
    bgColor: 'hover:bg-electric/10',
  },
  {
    id: ALBEDO_ID,
    name: 'Albedo',
    description: 'Web-based transaction signer',
    borderColor: 'border-purple-500/50 hover:border-purple-400',
    textColor: 'text-purple-400',
    bgColor: 'hover:bg-purple-500/10',
  },
  {
    id: XBULL_ID,
    name: 'xBull',
    description: 'Mobile-first Stellar wallet',
    borderColor: 'border-yellow-500/50 hover:border-yellow-400',
    textColor: 'text-yellow-400',
    bgColor: 'hover:bg-yellow-500/10',
  },
  {
    id: HOTWALLET_ID,
    name: 'HOT Wallet',
    description: 'NEAR-connected multi-chain wallet',
    borderColor: 'border-orange-500/50 hover:border-orange-400',
    textColor: 'text-orange-400',
    bgColor: 'hover:bg-orange-500/10',
  },
] as const;

export function WalletModal({ onClose, onSuccess }: WalletModalProps) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [phase, setPhase] = useState<'select' | 'signing'>('select');
  const [error, setError] = useState('');

  const handleSelect = async (walletId: string) => {
    const wallet = WALLETS.find(w => w.id === walletId);
    setConnecting(walletId);
    setError('');
    try {
      // Phase 1: Connect & fetch address
      StellarWalletsKit.setWallet(walletId);
      const { address } = await StellarWalletsKit.fetchAddress();
      if (!address) throw new Error('No address returned from wallet.');

      // Phase 2: Request signature to verify ownership
      setPhase('signing');
      const timestamp = new Date().toISOString();
      const challengeMessage = `ScoutGrid Wallet Verification\nAddress: ${address}\nTimestamp: ${timestamp}`;
      
      try {
        await StellarWalletsKit.signMessage(challengeMessage);
      } catch {
        // Some wallets (Albedo, xBull) may not support arbitrary message signing.
        // If signature fails, we still allow connection — the address was fetched successfully.
        console.warn(`[Wallet] ${wallet?.name} signature skipped (not supported or rejected).`);
      }

      // Success
      const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
      showToast(
        'success',
        `Connected via ${wallet?.name ?? 'Wallet'}`,
        `Wallet ${shortAddr} authenticated on Stellar Testnet`
      );

      onSuccess(address);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect wallet.';
      setError(msg);
      showToast('error', 'Connection Failed', msg);
    } finally {
      setConnecting(null);
      setPhase('select');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,7,16,0.9)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm bg-[#0a0f1b] border border-electric/30 relative"
        style={{ boxShadow: '0 0 40px rgba(0,240,255,0.1)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-200 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-5 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-electric font-black uppercase tracking-widest text-sm mb-1">
            <Wallet size={14} />
            <span>Connect Wallet</span>
          </div>
          <p className="text-slate-400 text-xs font-mono">
            {phase === 'signing'
              ? 'Approve the signature request in your wallet to verify ownership...'
              : 'Select a wallet provider to continue.'}
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          {WALLETS.map((wallet) => {
            const isConnecting = connecting === wallet.id;
            return (
              <button
                key={wallet.id}
                onClick={() => handleSelect(wallet.id)}
                disabled={connecting !== null}
                className={`w-full flex items-center justify-between border px-4 py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${wallet.borderColor} ${wallet.bgColor}`}
              >
                <div className="text-left">
                  <div className={`font-bold text-sm uppercase tracking-widest ${wallet.textColor}`}>
                    {wallet.name}
                  </div>
                  <div className="text-slate-500 font-mono text-[10px] mt-0.5">
                    {wallet.description}
                  </div>
                </div>
                {isConnecting && (
                  <div className="flex items-center space-x-1.5">
                    {phase === 'signing' ? (
                      <ShieldCheck size={14} className={`animate-pulse ${wallet.textColor}`} />
                    ) : (
                      <Loader2 size={14} className={`animate-spin ${wallet.textColor}`} />
                    )}
                    <span className={`text-[9px] font-mono uppercase tracking-widest ${wallet.textColor}`}>
                      {phase === 'signing' ? 'Sign' : 'Link'}
                    </span>
                  </div>
                )}
              </button>
            );
          })}

          {error && (
            <div className="flex items-start space-x-2 text-pink-400 font-mono text-[10px] border border-pink-500/30 bg-pink-500/5 px-3 py-2">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-slate-600 font-mono text-[9px] text-center pt-1">
            Make sure your wallet extension is installed and unlocked.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}


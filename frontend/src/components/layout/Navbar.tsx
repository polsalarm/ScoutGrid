import { useState, useEffect } from 'react';
import { Target, Upload, Wallet, CheckCircle2 } from 'lucide-react';
import { useScoutStore } from '../../lib/store';
import { StellarWalletsKit } from '../../lib/walletKit';
import { getProfile, getUsername } from '../../lib/contract';
import { RegisterModal } from '../ui/RegisterModal';
import { MintModal } from '../ui/MintModal';
import { WalletModal } from '../ui/WalletModal';
import { showToast } from '../ui/Toast';

interface NavbarProps {
  page: 'marketplace' | 'roster' | 'achievements';
  onNavigate: (page: 'marketplace' | 'roster' | 'achievements') => void;
}

export function Navbar({ page, onNavigate }: NavbarProps) {
  const {
    walletAddress, setWalletAddress,
    username, setUsername,
    isRegistered, setIsRegistered,
    isMinted, setIsMinted,
    activeWalletId, setActiveWalletId,
    isWalletModalOpen, setIsWalletModalOpen,
  } = useScoutStore();

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isMintOpen, setIsMintOpen] = useState(false);
  const [error, setError] = useState('');

  const handleWalletSuccess = async (address: string) => {
    setWalletAddress(address);
    setActiveWalletId(StellarWalletsKit.selectedModule?.productId ?? null);
    setError('');

    // Check if the account is funded on testnet
    const { isAccountFunded } = await import('../../lib/contract');
    const funded = await isAccountFunded(address);
    if (!funded) {
      showToast(
        'info',
        'Account Not Funded',
        `Fund this wallet via Stellar Friendbot before transacting. Visit: https://friendbot.stellar.org/?addr=${address}`,
        8000
      );
    }

    const existingIgn = await getUsername(address);
    if (existingIgn) {
      setUsername(existingIgn);
      setIsRegistered(true);
      const profile = await getProfile(address);
      if (profile) setIsMinted(true);
    } else {
      if (funded) {
        setIsRegisterOpen(true);
      }
    }
  };

  // Monitor for active wallet address changes (relevant for Freighter account switching)
  useEffect(() => {
    if (!walletAddress || !activeWalletId) return;
    const checkAddress = async () => {
      try {
        const { address } = await StellarWalletsKit.getAddress();
        if (address && address !== walletAddress) {
          setWalletAddress(address);
          setIsRegistered(false);
          setIsMinted(false);
          setUsername(null);
        }
      } catch {}
    };
    checkAddress();
  }, [walletAddress, activeWalletId, setWalletAddress, setIsRegistered, setIsMinted, setUsername]);

  useEffect(() => {
    if (walletAddress && !isRegistered) {
      getUsername(walletAddress).then(ign => {
        if (ign) {
          setUsername(ign);
          setIsRegistered(true);
        }
      });
    }
    if (walletAddress && isRegistered && !isMinted) {
      getProfile(walletAddress).then(profile => {
        if (profile) setIsMinted(true);
      });
    }
  }, [walletAddress, isRegistered, isMinted, setIsRegistered, setIsMinted, setUsername]);

  const shortAddr = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : null;

  return (
    <>
      <nav className="border-b border-electric/20 bg-[#020710]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2 text-electric font-black text-xl italic tracking-wider">
                <Target size={24} />
                <span>SCOUTGRID</span>
              </div>
              <div className="hidden md:flex space-x-6">
                <span onClick={() => onNavigate('marketplace')} className={`transition-colors cursor-pointer text-sm font-medium ${page === 'marketplace' ? 'text-electric' : 'text-slate-500 hover:text-slate-300'}`}>Marketplace</span>
                <span onClick={() => onNavigate('roster')} className={`transition-colors cursor-pointer text-sm font-medium ${page === 'roster' ? 'text-electric' : 'text-slate-500 hover:text-slate-300'}`}>My Roster</span>
                {isRegistered && (
                  <span onClick={() => onNavigate('achievements')} className={`transition-colors cursor-pointer text-sm font-medium ${page === 'achievements' ? 'text-electric' : 'text-slate-500 hover:text-slate-300'}`}>My Achievements</span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {isRegistered && !isMinted && (
                <button
                  onClick={() => setIsMintOpen(true)}
                  className="hidden md:flex items-center space-x-2 border border-electric/50 bg-electric/10 hover:bg-electric hover:text-slate-900 px-4 py-2 text-sm text-electric transition-all font-bold animate-pulse"
                >
                  <Upload size={16} />
                  <span>List as Player</span>
                </button>
              )}

              {walletAddress ? (
                <div className="flex items-center space-x-2">
                  <div
                    onClick={() => {
                      setWalletAddress(null); setIsRegistered(false); setIsMinted(false);
                      setUsername(null); setActiveWalletId(null);
                      showToast('info', 'Wallet Disconnected', 'Session cleared. Connect again to resume.');
                    }}
                    className="flex items-center space-x-2 border border-electric/30 bg-electric/5 px-3 py-1.5 font-mono text-xs text-electric cursor-pointer hover:bg-red-500/10 hover:border-red-500/50 transition-all group"
                  >
                    {isRegistered ? <CheckCircle2 size={12} className="text-[#39ff14]" /> : <Wallet size={12} />}
                    <span className="group-hover:hidden truncate max-w-[100px]">{username || shortAddr}</span>
                    <span className="hidden group-hover:inline text-red-500">DISCONNECT</span>
                  </div>
                  {!isRegistered && (
                    <button onClick={() => setIsRegisterOpen(true)} className="border border-pink-500/50 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors">
                      Verify Identity
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  className="flex items-center space-x-2 bg-electric text-slate-900 px-5 py-2 font-bold text-sm tracking-wide hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all"
                >
                  <Wallet size={16} />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {error && <div className="bg-red-900/80 text-red-200 text-center text-xs py-1.5 font-mono">{error}</div>}

      {isWalletModalOpen && (
        <WalletModal
          onClose={() => setIsWalletModalOpen(false)}
          onSuccess={handleWalletSuccess}
        />
      )}
      {isRegisterOpen && (
        <RegisterModal
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={() => { setIsRegistered(true); setIsRegisterOpen(false); }}
        />
      )}
      {isMintOpen && (
        <MintModal
          onClose={() => setIsMintOpen(false)}
          onSuccess={() => { setIsMinted(true); setIsMintOpen(false); }}
        />
      )}
    </>
  );
}

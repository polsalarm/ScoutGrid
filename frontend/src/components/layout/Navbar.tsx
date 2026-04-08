import { useState, useEffect } from 'react';
import { Target, Upload, Wallet, CheckCircle2 } from 'lucide-react';
import { useScoutStore } from '../../lib/store';
import { isConnected, requestAccess, getAddress, signMessage } from '@stellar/freighter-api';
import { getProfile, getUsername } from '../../lib/contract';
import { RegisterModal } from '../ui/RegisterModal';
import { MintModal } from '../ui/MintModal';

interface NavbarProps {
  page: 'marketplace' | 'roster' | 'achievements';
  onNavigate: (page: 'marketplace' | 'roster' | 'achievements') => void;
}

export function Navbar({ page, onNavigate }: NavbarProps) {
  const { 
    walletAddress, setWalletAddress, 
    username, setUsername, 
    isRegistered, setIsRegistered, 
    isMinted, setIsMinted 
  } = useScoutStore();
  
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isMintOpen, setIsMintOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  const connectWallet = async () => {
    if (walletAddress) return;
    try {
      setIsChecking(true);
      const connected = await isConnected();
      if (!connected) {
        setError('Freighter not detected.');
        return;
      }

      const access = await requestAccess();
      if (access.error) { setError(access.error); return; }

      const message = `Verify ScoutGrid Connection: ${access.address.slice(0, 8)}...`;
      const signed = await signMessage(message);
      
      if (signed.error) {
        setError("Verification rejected.");
        return;
      }

      setWalletAddress(access.address);
      setError('');

      // Check on-chain state
      const existingIgn = await getUsername(access.address);
      if (existingIgn) {
        setUsername(existingIgn);
        setIsRegistered(true);
        const profile = await getProfile(access.address);
        if (profile) setIsMinted(true);
      } else {
        setIsRegisterOpen(true); 
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect.');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const syncWallet = async () => {
      try {
        const result = await getAddress();
        const activeAddress = result.address;
        if (walletAddress && activeAddress && activeAddress !== walletAddress) {
          setWalletAddress(activeAddress);
          setIsRegistered(false);
          setIsMinted(false);
          setUsername(null);
        }
      } catch {}
    };
    syncWallet();
  }, [walletAddress, setWalletAddress, setIsRegistered, setIsMinted, setUsername]);

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
                      setWalletAddress(null); setIsRegistered(false); setIsMinted(false); setUsername(null);
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
                <button onClick={connectWallet} disabled={isChecking} className="flex items-center space-x-2 bg-electric text-slate-900 px-5 py-2 font-bold text-sm tracking-wide hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all disabled:opacity-60">
                  <Wallet size={16} />
                  <span>{isChecking ? 'Checking...' : 'Connect Wallet'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {error && <div className="bg-red-900/80 text-red-200 text-center text-xs py-1.5 font-mono">{error}</div>}

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

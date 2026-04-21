import { useEffect, useState } from 'react';
import { Trophy, ShoppingBag, Zap, Shield, RefreshCw, Cpu, Clock, ShieldCheck, ExternalLink, Landmark } from 'lucide-react';
import { useScoutStore } from '../lib/store';
import { syncFullRegistry, acceptBid, getActiveLoan } from '../lib/contract';
import { showToast } from '../components/ui/Toast';
import type { Player, LoanRecord } from '../lib/types';
import { LoanBadge } from '../components/ui/LoanBadge';
import { RepayModal } from '../components/ui/RepayModal';
import { LoanModal } from '../components/ui/LoanModal';

function RosterCard({ player, walletAddress, isOffer }: { player: Player; walletAddress: string | null; isOffer?: boolean }) {
  const { setPlayers, loans, setLoan } = useScoutStore();
  const [isAccepting, setIsAccepting] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);

  const activeLoan: LoanRecord | null = loans[player.address] ?? null;
  const hasBid = player.highestBid && player.highestBid > 0;

  const handleAcceptBid = async () => {
    if (!walletAddress) return;
    setIsAccepting(true);
    try {
      await acceptBid(walletAddress, player.address);
      await syncFullRegistry(walletAddress, setPlayers);
      showToast('success', 'Bid Accepted', 'Player contract has been transferred.');
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to accept bid.';
      showToast('error', 'Accept Failed', msg);
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="bg-[#0a0f1b] border border-slate-800 hover:border-electric/50 hover:scale-[1.03] transition-all duration-200 p-6 flex flex-col relative group cursor-default">

      {/* Header: Address + Label */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <div className="border border-electric/30 text-electric font-mono text-[9px] px-2 py-0.5 bg-electric/5 uppercase tracking-tighter">
            {player.address.slice(0, 4)}...{player.address.slice(-4)}
          </div>
          <div className={`text-[8px] font-bold px-2 py-0.5 border ${isOffer ? 'border-pink-500/30 text-pink-400 bg-pink-500/5' : 'border-electric/30 text-electric bg-electric/5'} uppercase tracking-widest`}>
            {isOffer ? 'PEER OFFER' : 'OWNED ASSET'}
          </div>
        </div>
        <div className="flex items-center space-x-1.5 text-[#39ff14] font-mono text-sm border border-[#39ff14]/20 bg-[#39ff14]/5 px-2.5 py-1">
          <Trophy size={13} />
          <span>{player.winPoints} WP</span>
        </div>
      </div>

      {/* Identity */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="p-3 bg-slate-800/80 border border-slate-700 text-electric flex-shrink-0">
          <Cpu size={24} />
        </div>
        <div>
          <div className="text-slate-100 font-black uppercase tracking-widest text-lg leading-none italic">
            {player.name}
          </div>
          <div className="flex items-center space-x-1 text-electric font-mono text-xs mt-1.5">
            <Zap size={11} />
            <span className="uppercase tracking-widest">{player.role}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-slate-800/50">
        <div>
          <div className="text-[9px] text-slate-500 uppercase font-mono mb-1">KDA Ratio</div>
          <div className="text-xs font-bold text-white font-mono">{player.stats.kda}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase font-mono mb-1">Win Rate</div>
          <div className="text-xs font-bold text-[#39ff14] font-mono">{player.stats.winRate}</div>
        </div>
      </div>

      {/* Bio */}
      <p className="text-slate-400 text-xs italic leading-relaxed mb-4 line-clamp-2 h-10">
        {player.bio || "Scout verification complete."}
      </p>

      {/* Verification footer */}
      <div className="flex items-center justify-between text-[10px] font-mono mb-4 text-slate-500">
        <div className="flex items-center space-x-1.5">
          <ShieldCheck size={12} />
          <span>On-Chain Verified</span>
        </div>
        <div className="flex items-center space-x-1">
          <Clock size={12} />
          <span>{player.endTime}</span>
        </div>
      </div>

      {/* Pricing / Bid area */}
      <div className="border-t border-slate-800 pt-4 mb-6">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mb-1">
              {isOffer ? 'Your Offer' : 'Current Value'}
            </div>
            <div className="text-white text-lg font-bold font-mono">
              {(isOffer ? (player.highestBid ?? 0) : player.price || 0).toLocaleString()} <span className="text-xs text-slate-500">XLM</span>
            </div>
          </div>
          {!isOffer && hasBid && (
            <div className="text-right">
              <div className="text-[9px] text-electric uppercase font-mono tracking-widest mb-1 animate-pulse">Top Bid</div>
              <div className="text-electric text-lg font-bold font-mono">
                {player.highestBid?.toLocaleString()} <span className="text-xs opacity-60">XLM</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loan badge — shown when contract is pledged as collateral */}
      {!isOffer && activeLoan && (
        <div className="mb-3">
          <LoanBadge loan={activeLoan} />
        </div>
      )}

      {/* CTA: Final design harmonized */}
      <div className="space-y-2">
        {!isOffer && activeLoan ? (
          <button
            onClick={() => setShowRepayModal(true)}
            className="w-full border border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-900 py-3 text-xs font-bold uppercase tracking-widest transition-all italic"
          >
            Repay & Unlock
          </button>
        ) : !isOffer && hasBid ? (
          <button
            onClick={handleAcceptBid}
            disabled={isAccepting}
            className="w-full border border-green-500/60 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-slate-900 py-3 text-xs font-bold uppercase tracking-widest transition-all italic"
          >
            {isAccepting ? 'Accepting...' : 'Accept Highest Bid'}
          </button>
        ) : !isOffer ? (
          <button className="w-full border border-electric/60 bg-electric/10 text-electric hover:bg-electric hover:text-slate-900 py-3 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center space-x-2 italic">
            <ExternalLink size={14} />
            <span>Mint to Marketplace</span>
          </button>
        ) : (
          <div className="text-center py-3 border border-pink-500/30 bg-pink-500/5 text-pink-400 font-mono text-[10px] uppercase tracking-widest italic opacity-80">
            Awaiting Seller Response
          </div>
        )}
        {!isOffer && !activeLoan && (
          <button
            onClick={() => setShowLoanModal(true)}
            className="w-full flex items-center justify-center space-x-1.5 border border-amber-500/30 bg-amber-500/5 text-amber-500 hover:bg-amber-500/15 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <Landmark size={11} />
            <span>Borrow Against</span>
          </button>
        )}
      </div>

      {showRepayModal && activeLoan && (
        <RepayModal
          player={player}
          loan={activeLoan}
          onClose={() => setShowRepayModal(false)}
          onSuccess={() => { setLoan(player.address, null); syncFullRegistry(walletAddress!, setPlayers); }}
        />
      )}
      {showLoanModal && (
        <LoanModal
          player={player}
          onClose={() => setShowLoanModal(false)}
          onSuccess={() => syncFullRegistry(walletAddress!, setPlayers)}
        />
      )}
    </div>
  );
}

export function MyRoster() {
  const { players, walletAddress, setPlayers, setLoan } = useScoutStore();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;
    const runSync = async () => {
      setIsSyncing(true);
      await syncFullRegistry(walletAddress, setPlayers);
      setIsSyncing(false);
    };
    runSync();
  }, [walletAddress, setPlayers]);

  // Sync active loans for all owned players
  useEffect(() => {
    if (!walletAddress) return;
    const ownedAddresses = players
      .filter(p => p.owner === walletAddress)
      .map(p => p.address);
    ownedAddresses.forEach(async (addr) => {
      const loan = await getActiveLoan(addr);
      setLoan(addr, loan);
    });
  }, [players, walletAddress, setLoan]);

  const ownedPlayers = players.filter(p => p.owner === walletAddress);
  const biddedPlayers = players.filter(p =>
    p.currentBidder === walletAddress && p.owner !== walletAddress
  );

  const totalActive = ownedPlayers.length + biddedPlayers.length;

  return (
    <div className="min-h-screen pb-20">
      <div className="mb-12 pt-8">
        <div className="flex items-center space-x-2 text-electric font-mono text-[10px] uppercase tracking-[0.3em] mb-4">
          <div className="w-8 h-[1px] bg-electric" />
          <span>ROSTER MANAGEMENT</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-5xl lg:text-7xl font-black text-white italic tracking-tighter uppercase leading-none">
              MY <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-electric">ROSTER</span>
            </h1>
            <p className="mt-4 text-slate-400 font-mono text-sm max-w-xl leading-relaxed">
              Dossier of all secured pro-contracts. Mint your roster back to the marketplace to release capital or monitor active purchase offers.
            </p>
          </div>

          <div className="bg-[#0a1118] border border-slate-800 p-6 flex items-center space-x-6">
            <div className="text-center border-r border-slate-800 pr-6">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-widest">Contracts</div>
              <div className="text-3xl font-black text-white font-mono">{totalActive}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-widest">Network</div>
              <div className="text-[10px] text-[#39ff14] font-mono flex items-center space-x-2">
                {isSyncing ? (
                  <RefreshCw size={12} className="animate-spin text-electric" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
                )}
                <span>{isSyncing ? 'SYNCING' : 'STABLE'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Owned Assets */}
      <div className="mb-12">
        <h2 className="text-sm font-bold text-white uppercase tracking-[0.3em] mb-6 flex items-center space-x-3">
          <Shield className="text-electric" size={16} />
          <span>Secured Contracts</span>
        </h2>
        {ownedPlayers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {ownedPlayers.map(p => <RosterCard key={p.address} player={p} walletAddress={walletAddress} />)}
          </div>
        ) : totalActive > 0 ? null : (
          <div className="py-20 border border-slate-800/50 bg-slate-900/10 text-center rounded-lg">
            <ShoppingBag size={48} className="text-slate-800 mx-auto mb-4" />
            <p className="text-slate-500 font-mono text-xs uppercase tracking-widest italic">Roster is empty</p>
          </div>
        )}
      </div>

      {/* Active Bids */}
      {biddedPlayers.length > 0 && (
        <div className="mb-12">
          <h2 className="text-sm font-bold text-white uppercase tracking-[0.3em] mb-6 flex items-center space-x-3">
            <Zap className="text-pink-500" size={16} />
            <span>Active Offers (Waitlist)</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {biddedPlayers.map(p => <RosterCard key={p.address} player={p} walletAddress={walletAddress} isOffer />)}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useScoutStore } from '../lib/store';
import { PlayerCard } from '../components/ui/PlayerCard';
import { Achievements } from './Achievements';
import { syncFullRegistry } from '../lib/contract';
import type { Player } from '../lib/types';
import { getDemoPlayers } from '../lib/demoData'; // DEMO REMOVE

export function Marketplace() {
  const { players, setPlayers, walletAddress } = useScoutStore();
  const [, setIsSyncing] = useState(false);

  // ─── Universal Sync ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!walletAddress) return;
    const runSync = async () => {
      setIsSyncing(true);
      await syncFullRegistry(walletAddress, setPlayers);
      setIsSyncing(false);
    };
    runSync();

    // ─── Real-time Polling ───
    const interval = setInterval(runSync, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [setPlayers, walletAddress]);

  // DEMO REMOVE — always merge demo players with real on-chain data
  const realAddresses = new Set(players.map(p => p.address));
  const displayPlayers = [...players, ...getDemoPlayers(walletAddress, realAddresses)];

  // Deduplicate: only show the latest profile for each address if multiple exist
  const uniquePlayers = displayPlayers.reduceRight((acc, player) => {
    if (!acc.some(p => p.address === player.address)) acc.push(player);
    return acc;
  }, [] as Player[]).reverse().filter(p => p.isListed !== false);

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  if (selectedPlayer) {
    return <Achievements player={selectedPlayer} onBack={() => setSelectedPlayer(null)} />;
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-12">
        {/* Status tag */}
        <div className="text-electric font-mono text-xs tracking-widest mb-5 flex items-center space-x-1">
          <span className="text-electric">›_</span>
          <span>SYSTEM ONLINE // GLOBAL GRID</span>
        </div>

        {/* Hero title */}
        <h1
          className="font-black uppercase leading-none mb-6 select-none"
          style={{
            fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          <span
            className="block text-slate-100"
            style={{ textShadow: '2px 2px 0 rgba(0,240,255,0.12)' }}
          >
            SCOUT TOP ESPORTS
          </span>
          <span className="block">
            <span
              className="text-slate-100"
              style={{ textShadow: '2px 2px 0 rgba(0,240,255,0.12)' }}
            >
              TALENT{' '}
            </span>
            {/* ON- in electric cyan */}
            <span
              style={{
                color: '#00f0ff',
                textShadow: '0 0 20px rgba(0,240,255,0.6), 2px 2px 0 rgba(0,240,255,0.2)',
              }}
            >
              ON-
            </span>
            {/* CHAIN in crimson red */}
            <span
              style={{
                color: '#e8374a',
                textShadow: '0 0 20px rgba(232,55,74,0.5), 2px 2px 0 rgba(232,55,74,0.25)',
              }}
            >
              CHAIN
            </span>
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-slate-400 font-mono text-sm max-w-xl leading-relaxed">
          Access verified smart contracts of professional players. Review metrics, evaluate win points, and secure talent directly on the Soroban network.
        </p>
      </div>

      <div className="border-b border-slate-800 mb-8 pb-2 flex justify-between items-end">
        <div className="w-full h-[1px] bg-electric/20 absolute left-0" />
        <span className="text-slate-500 font-mono text-xs uppercase tracking-widest z-10 bg-background pr-4">
          Available Contracts : {uniquePlayers.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {uniquePlayers.map(player => (
          <PlayerCard 
            key={player.id} 
            player={player} 
            onViewAchievements={setSelectedPlayer} 
          />
        ))}
      </div>
    </div>
  );
}

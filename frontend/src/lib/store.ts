import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player } from './mock-data';
import { INITIAL_PLAYERS } from './mock-data';

interface ScoutState {
  walletAddress: string | null;
  username: string | null;
  players: Player[];
  roster: Player[];
  isRegistered: boolean;
  isMinted: boolean;
  setWalletAddress: (address: string | null) => void;
  setUsername: (name: string | null) => void;
  setIsRegistered: (status: boolean) => void;
  setIsMinted: (status: boolean) => void;
  addPlayer: (player: Player) => void;
  unlistPlayer: (playerId: string) => void;
  transferOwnership: (playerId: string, newOwner: string) => void;
  placeBid: (playerId: string, bidAmount: number) => void;
  securePlayer: (player: Player) => void;
  setPlayers: (players: Player[]) => void;
}

export const useScoutStore = create<ScoutState>()(
  persist(
    (set) => ({
      walletAddress: null,
      username: null,
      players: INITIAL_PLAYERS,
      roster: [],
      isRegistered: false,
      isMinted: false,
      setWalletAddress: (address) => set({ walletAddress: address }),
      setUsername: (name) => set({ username: name }),
      setIsRegistered: (status) => set({ isRegistered: status }),
      setIsMinted: (status) => set({ isMinted: status }),
      addPlayer: (player) => set((state) => {
        const index = state.players.findIndex(p => p.address === player.address);
        if (index > -1) {
          const newPlayers = [...state.players];
          newPlayers[index] = player;
          return { players: newPlayers };
        }
        return { players: [...state.players, player] };
      }),
      placeBid: (playerId, bidAmount) => set((state) => ({
        players: state.players.map(p =>
          p.id === playerId ? { ...p, highestBid: bidAmount } : p
        )
      })),
      securePlayer: (player) => set((state) => ({
        roster: state.roster.some(p => p.id === player.id)
          ? state.roster
          : [...state.roster, player],
      })),
      unlistPlayer: (playerId) => set((state) => ({
        players: state.players.map(p => p.id === playerId ? { ...p, isListed: false } : p)
      })),
      transferOwnership: (playerId, newOwner) => set((state) => ({
        players: state.players.map(p => p.id === playerId ? { ...p, owner: newOwner } : p)
      })),
      setPlayers: (newPlayers) => set({ players: newPlayers }),
    }),
    {
      name: 'scoutgrid-storage',
      partialize: (state) => ({
        // DO NOT persist the marketplace list (players) to ensure real-time sync
        walletAddress: state.walletAddress,
        username: state.username,
        roster: state.roster,
        isRegistered: state.isRegistered,
        isMinted: state.isMinted,
      }),
    }
  )
);

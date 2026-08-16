/**
 * Single source of truth for chain config. Swapping Fuji C-Chain for a
 * custom Avalanche L1 (Phase 6 of the migration plan) means changing only
 * this file — everything else in the app reads from here.
 */
import { avalancheFuji } from 'viem/chains';

export const ACTIVE_CHAIN = avalancheFuji;

export const TOKEN_SYMBOL = 'AVAX';

/** Set after `forge script script/Deploy.s.sol --rpc-url fuji --broadcast`. */
export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const EXPLORER_TX = (hash: string) => `https://testnet.snowtrace.io/tx/${hash}`;
export const EXPLORER_ADDRESS = (address: string) => `https://testnet.snowtrace.io/address/${address}`;
export const FAUCET_URL = 'https://core.app/tools/testnet-faucet';

export const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '';

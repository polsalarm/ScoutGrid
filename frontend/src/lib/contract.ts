/**
 * ScoutGrid EVM Contract Client
 *
 * Network:  Avalanche Fuji C-Chain (chainId 43113)
 * Contract: see VITE_CONTRACT_ADDRESS / frontend/src/lib/chain.ts
 *
 * Built on viem + wagmi's framework-agnostic actions (`wagmi/actions`), so
 * every function here is a plain async call — no React hooks required —
 * matching the calling convention every component already uses.
 */
import { isAddress, parseEther, formatEther, stringToHex, hexToString, zeroAddress, type Address } from 'viem';
import {
  readContract,
  simulateContract,
  writeContract,
  waitForTransactionReceipt,
  getAccount,
  getBlock,
  switchChain,
} from 'wagmi/actions';
import { wagmiConfig } from './walletKit';
import { SCOUTGRID_ABI } from './abi';
import { ACTIVE_CHAIN, CONTRACT_ADDRESS } from './chain';
import { showToast } from '../components/ui/Toast';
import type { Player, LoanRecord } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────
export const LOAN_DURATION_SECONDS = 30 * 24 * 60 * 60; // mirrors contract's LOAN_DURATION (30 days)

// ─── ABI-adjacent helpers ─────────────────────────────────────────────────────
function roleToBytes32(role: string): `0x${string}` {
  return stringToHex(role, { size: 32 });
}
function bytes32ToRole(hex: `0x${string}`): string {
  return hexToString(hex, { size: 32 }).replace(/\0+$/, '');
}

function extractRevertReason(err: unknown): string {
  const anyErr = err as { cause?: { data?: { errorName?: string } }; shortMessage?: string } | undefined;
  if (anyErr?.cause?.data?.errorName) return anyErr.cause.data.errorName;
  if (anyErr?.shortMessage) return anyErr.shortMessage;
  return err instanceof Error ? err.message : 'Unknown error';
}

// ─── Helper: ensure network → simulate → sign → submit → poll ────────────────
async function invokeContract(
  functionName: string,
  args: readonly unknown[],
  value?: bigint
): Promise<`0x${string}`> {
  const { address: account, chainId } = getAccount(wagmiConfig);
  if (!account) throw new Error('Wallet not connected.');

  if (chainId !== ACTIVE_CHAIN.id) {
    showToast('info', 'Switching Network', `Approve the switch to ${ACTIVE_CHAIN.name} in your wallet.`, 8000);
    try {
      await switchChain(wagmiConfig, { chainId: ACTIVE_CHAIN.id });
    } catch {
      showToast('error', 'Wrong Network', `Switch your wallet to ${ACTIVE_CHAIN.name} and try again.`);
      throw new Error('Wallet is on the wrong network.');
    }
  }

  showToast('info', 'Simulating Transaction', `Preparing ${functionName}…`, 2500);
  let request;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim = await simulateContract(wagmiConfig, {
      address: CONTRACT_ADDRESS,
      abi: SCOUTGRID_ABI,
      functionName: functionName as never,
      args: args as never,
      account,
      value,
    });
    request = sim.request;
  } catch (err) {
    const reason = extractRevertReason(err);
    showToast('error', 'Simulation Failed', `Contract rejected this call: ${reason}`);
    throw new Error(`Simulation failed: ${reason}`);
  }

  showToast('info', 'Approve in Wallet', 'Sign the transaction in your wallet to continue.', 12000);
  let hash: `0x${string}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hash = await writeContract(wagmiConfig, request as any);
  } catch {
    showToast('error', 'Transaction Rejected', 'You cancelled or rejected the wallet signature.');
    throw new Error('Transaction rejected in wallet.');
  }

  showToast('info', 'Transaction Submitted', `Hash: ${hash.slice(0, 12)}…`, 4000);

  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  if (receipt.status === 'reverted') {
    showToast('error', 'Transaction Failed', 'The transaction was rejected on-chain.');
    throw new Error('Transaction failed on-chain.');
  }
  return hash;
}

// ─── Contract Functions (writes) ───────────────────────────────────────────────

/** registerUser — claim an IGN handle on-chain */
export async function registerUser(_userAddress: string, username: string): Promise<void> {
  await invokeContract('registerUser', [username]);
}

/** mintPlayerProfile — list as a professional scoutable profile */
export async function mintPlayerProfile(
  _playerAddress: string,
  role: string,
  bio: string,
  achievements: string[],
  listPriceAvax: number
): Promise<void> {
  await invokeContract('mintPlayerProfile', [roleToBytes32(role), bio, achievements, parseEther(String(listPriceAvax))]);
}

/** placeBid — bargain bid; must be lower than the player's list price */
export async function placeBid(
  _bidderAddress: string,
  playerAddress: string,
  bidAmountAvax: number
): Promise<void> {
  await invokeContract('placeBid', [playerAddress as Address], parseEther(String(bidAmountAvax)));
}

/** acceptBid — current owner accepts the standing bid */
export async function acceptBid(_ownerAddress: string, playerAddress: string): Promise<void> {
  await invokeContract('acceptBid', [playerAddress as Address]);
}

/** buyout — instantly secure a player's contract for the list price */
export async function buyout(_buyerAddress: string, playerAddress: string): Promise<void> {
  const profile = await getProfile(playerAddress);
  if (!profile) throw new Error('Profile not found.');
  await invokeContract('buyout', [playerAddress as Address], parseEther(String(profile.listPrice)));
}

// ─── Read-only helpers ────────────────────────────────────────────────────────

export interface OnChainProfile {
  username: string;
  role: string;
  bio: string;
  achievements: string[];
  winPoints: number;
  owner: string;
  originalCreator: string;
  listPrice: number;
}

/** getProfile — read a player's on-chain profile (no signature needed) */
export async function getProfile(playerAddress: string): Promise<OnChainProfile | null> {
  try {
    if (!isAddress(playerAddress)) {
      console.warn(`[EVM] Skipping getProfile for invalid address: ${playerAddress}`);
      return null;
    }
    const profile = await readContract(wagmiConfig, {
      address: CONTRACT_ADDRESS,
      abi: SCOUTGRID_ABI,
      functionName: 'getProfile',
      args: [playerAddress as Address],
    });
    return {
      username: profile.username,
      role: bytes32ToRole(profile.role),
      bio: profile.bio,
      achievements: [...profile.achievements],
      winPoints: profile.winPoints,
      owner: profile.owner,
      originalCreator: profile.originalCreator,
      listPrice: Number(formatEther(profile.listPrice)),
    };
  } catch (err) {
    console.error(`[EVM] getProfile failed for ${playerAddress}:`, err);
    return null;
  }
}

/** getUsername — read only registration IGN */
export async function getUsername(userAddress: string): Promise<string | null> {
  try {
    return await readContract(wagmiConfig, {
      address: CONTRACT_ADDRESS,
      abi: SCOUTGRID_ABI,
      functionName: 'getUsername',
      args: [userAddress as Address],
    });
  } catch {
    return null;
  }
}

/** getCurrentBid — current standing bid amount for a player in AVAX */
export async function getCurrentBid(playerAddress: string): Promise<number> {
  try {
    const bid = await readContract(wagmiConfig, {
      address: CONTRACT_ADDRESS,
      abi: SCOUTGRID_ABI,
      functionName: 'getCurrentBid',
      args: [playerAddress as Address],
    });
    return Number(formatEther(bid));
  } catch (err) {
    console.warn(`[EVM] Failed to get current bid for ${playerAddress}`, err);
    return 0;
  }
}

/** getAllPlayerAddresses — retrieve the global registry */
export async function getAllPlayerAddresses(): Promise<string[]> {
  try {
    const addrs = await readContract(wagmiConfig, {
      address: CONTRACT_ADDRESS,
      abi: SCOUTGRID_ABI,
      functionName: 'getAllPlayerAddresses',
    });
    return [...addrs];
  } catch (err) {
    console.error('[EVM] Failed to fetch player registry:', err);
    return [];
  }
}

function marketItemToPlayer(item: {
  player: Address;
  profile: {
    username: string;
    role: `0x${string}`;
    bio: string;
    achievements: readonly string[];
    winPoints: number;
    owner: Address;
    listPrice: bigint;
    listed: boolean;
  };
  currentBid: bigint;
  currentBidder: Address;
}): Player {
  const playerAddr = item.player;
  const profile = item.profile;
  return {
    id: playerAddr.slice(0, 10),
    name: profile.username || 'Scout',
    role: bytes32ToRole(profile.role),
    bio: profile.bio || '',
    achievements: [...profile.achievements],
    winPoints: Number(profile.winPoints || 0),
    address: playerAddr,
    owner: profile.owner,
    price: Number(formatEther(profile.listPrice)),
    highestBid: Number(formatEther(item.currentBid)),
    currentBidder: item.currentBidder === zeroAddress ? null : item.currentBidder,
    isListed: profile.listed,
    endTime: '24:00',
    stats: { kda: 'N/A', winRate: 'N/A', matches: 0, tournamentsWon: 0, mvpAwards: 0, avgGoldMin: 'N/A' },
  };
}

/** syncGlobalMarket — Optimized Single-Call Sync */
export async function syncGlobalMarket(setPlayersInStore: (p: Player[]) => void): Promise<void> {
  try {
    console.log('[Sync] Starting Optimized Global Sync...');
    const items = await readContract(wagmiConfig, {
      address: CONTRACT_ADDRESS,
      abi: SCOUTGRID_ABI,
      functionName: 'getAllMarketItems',
    });
    const players = items.map(marketItemToPlayer);
    setPlayersInStore(players);
    console.log(`[Sync] Market discovery complete! Sync'd ${players.length} players.`);
  } catch (err) {
    console.error('[Sync] Market Sync failed:', err);
  }
}

/** Helper for read-only simulations of getOwnedAssets */
async function getOwnedAssetsRaw(owner: string) {
  return readContract(wagmiConfig, {
    address: CONTRACT_ADDRESS,
    abi: SCOUTGRID_ABI,
    functionName: 'getOwnedAssets',
    args: [owner as Address],
  });
}

/** getChainTime — latest confirmed block timestamp (unix seconds) */
export async function getChainTime(): Promise<number> {
  try {
    const block = await getBlock(wagmiConfig, { chainId: ACTIVE_CHAIN.id });
    return Number(block.timestamp);
  } catch {
    return 0;
  }
}

// ─── Loan Functions ───────────────────────────────────────────────────────────

/** fundPool — admin (or any sponsor) deposits AVAX into the lending pool */
export async function fundPool(_funderAddress: string, amountAvax: number): Promise<void> {
  await invokeContract('fundPool', [], parseEther(String(amountAvax)));
}

/** takePlayerLoan — lock a player contract as collateral and borrow AVAX */
export async function takePlayerLoan(
  _borrowerAddress: string,
  playerAddress: string,
  amountAvax: number
): Promise<void> {
  await invokeContract('takeLoan', [playerAddress as Address, parseEther(String(amountAvax))]);
}

/** repayPlayerLoan — repay principal + compound interest to unlock collateral */
export async function repayPlayerLoan(_borrowerAddress: string, playerAddress: string): Promise<void> {
  const [exists, loan] = await getLoanRaw(playerAddress);
  if (!exists) throw new Error('No active loan for this player.');
  // Small buffer over the latest known block time to absorb the delay
  // between simulating here and the transaction actually mining — the
  // contract refunds any excess, so overpaying by a few minutes is free.
  const now = (await getChainTime()) + 300;
  const repayment = computeRepaymentWei(loan.principal, Number(loan.startTime), now);
  await invokeContract('repayLoan', [playerAddress as Address], repayment);
}

function computeRepaymentWei(principalWei: bigint, startTime: number, now: number): bigint {
  const elapsed = Math.max(0, now - startTime);
  const terms = Math.max(1, Math.ceil(elapsed / LOAN_DURATION_SECONDS));
  let repayment = principalWei;
  for (let i = 0; i < terms; i++) {
    repayment += (repayment * 500n) / 10_000n;
  }
  return repayment;
}

/** liquidateLoan — callable by anyone after the loan term expires */
export async function liquidateLoan(playerAddress: string, _callerAddress: string): Promise<void> {
  await invokeContract('liquidate', [playerAddress as Address]);
}

async function getLoanRaw(playerAddress: string) {
  return readContract(wagmiConfig, {
    address: CONTRACT_ADDRESS,
    abi: SCOUTGRID_ABI,
    functionName: 'getLoan',
    args: [playerAddress as Address],
  });
}

/** getActiveLoan — read active loan for a player (null if none) */
export async function getActiveLoan(playerAddress: string): Promise<LoanRecord | null> {
  try {
    const [exists, loan] = await getLoanRaw(playerAddress);
    if (!exists) return null;
    return {
      borrower: loan.borrower,
      principal: Number(formatEther(loan.principal)),
      startTime: Number(loan.startTime),
      dueTime: Number(loan.dueTime),
    };
  } catch {
    return null;
  }
}

/** getPoolBalance — current AVAX available in the lending pool */
export async function getPoolBalance(): Promise<number> {
  try {
    const pool = await readContract(wagmiConfig, {
      address: CONTRACT_ADDRESS,
      abi: SCOUTGRID_ABI,
      functionName: 'getPoolBalance',
    });
    return Number(formatEther(pool));
  } catch {
    return 0;
  }
}

/**
 * Universal Sync Engine: Multi-Pass Convergence
 * Ensures both Market Visibility and Personal Collection permanence.
 */
export async function syncFullRegistry(
  walletAddress: string,
  setPlayersInStore: (p: Player[]) => void
) {
  try {
    const marketRaw = await readContract(wagmiConfig, {
      address: CONTRACT_ADDRESS,
      abi: SCOUTGRID_ABI,
      functionName: 'getAllMarketItems',
    });
    const ownedRaw = await getOwnedAssetsRaw(walletAddress);

    const mPlayers = marketRaw.map(marketItemToPlayer);
    const oPlayers = ownedRaw.map(marketItemToPlayer);

    // Merge: Store identity is unique per Address
    const registryMap = new Map<string, Player>();

    // Fill with Personal Assets first (true ownership)
    oPlayers.forEach((p) => registryMap.set(p.address, p));

    // Layer with Market Data (market data might have updated bid info)
    mPlayers.forEach((p) => {
      const existing = registryMap.get(p.address);
      registryMap.set(p.address, existing ? { ...existing, ...p } : p);
    });

    const finalPlayers = Array.from(registryMap.values());
    setPlayersInStore(finalPlayers);
    console.log(`[Full Sync] Combined discovery complete: ${mPlayers.length} market, ${oPlayers.length} owned.`);
  } catch (err) {
    console.error('[Full Sync] Convergence failed:', err);
  }
}

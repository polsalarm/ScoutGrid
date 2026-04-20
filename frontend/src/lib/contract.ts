/**
 * ScoutGrid Soroban Contract Client
 *
 * Contract:  CAYU6ZAZVKY3WVB2GZCTNS3EZT2WEY2OWWBMYWGIJ6FLYQNNCP2ZY27P
 * Network:   Stellar Testnet
 * Admin:     GCF4N2ZDIGVYGSXUT7XCUBR3WHPT2FYTIADXUODQZ57MOWX6USIEW2CY
 *
 * @stellar/stellar-sdk v15: Protocol 22 native, rpc.assembleTransaction, rpc.Api
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { StellarWalletsKit } from './walletKit';
import { showToast } from '../components/ui/Toast';
import type { Player } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────
export const CONTRACT_ID = 'CBJKAS62XBI54L4BTMLUVTWZGBJJMM23GYMN2UPZHATY4WOIPVYV74U6';
export const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const ADMIN_ADDRESS = 'GCF4N2ZDIGVYGSXUT7XCUBR3WHPT2FYTIADXUODQZ57MOWX6USIEW2CY';

// 1 XLM = 10,000,000 stroops (i128)
export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * 10_000_000));
}
export function stroopsToXlm(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}
/** Combines hi/lo parts of a Soroban i128 into a single BigInt */
function parseI128(val: { lo(): any, hi(): any }): bigint {
  const lo = BigInt(val.lo().toString());
  const hi = BigInt(val.hi().toString());
  return (hi << 64n) + lo;
}

// ─── RPC Server (stellar-sdk v13 uses `rpc` namespace) ────────────────────────
function getServer() {
  return new StellarSdk.rpc.Server(RPC_URL, { allowHttp: false });
}

/** Check if a Stellar account exists (is funded) on the network */
export async function isAccountFunded(address: string): Promise<boolean> {
  try {
    await getServer().getAccount(address);
    return true;
  } catch {
    return false;
  }
}

// ─── Helper: build → simulate → assemble → sign → submit → poll ──────────────
async function invokeContract(
  callerAddress: string,
  functionName: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<void> {
  const server = getServer();
  const account = await server.getAccount(callerAddress);
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();

  // 1. Simulate
  showToast('info', 'Simulating Transaction', `Preparing ${functionName}…`, 2500);
  const simulation = await server.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    showToast('error', 'Simulation Failed', 'Contract may be uninitialized or the action is unauthorized.');
    throw new Error(`Simulation failed: The contract may be uninitialized or the action is unauthorized.`);
  }

  // 2. Assemble with resource footprint
  const preparedTx = StellarSdk.rpc.assembleTransaction(tx, simulation).build();

  // 3. Sign via StellarWalletsKit
  showToast('info', 'Approve in Wallet', 'Sign the transaction in your wallet to continue.', 12000);
  let signedXdr: string;
  try {
    const result = await StellarWalletsKit.signTransaction(preparedTx.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    signedXdr = result.signedTxXdr;
  } catch {
    showToast('error', 'Transaction Rejected', 'You cancelled or rejected the wallet signature.');
    throw new Error('Transaction rejected in wallet.');
  }

  // 4. Submit via RPC
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE
  ) as StellarSdk.Transaction;

  const sendResponse = await server.sendTransaction(signedTx);
  if (sendResponse.status === 'ERROR') {
    showToast('error', 'Submission Failed', 'Network rejected the transaction.');
    throw new Error(`Network rejected transaction: ${JSON.stringify(sendResponse.errorResult)}`);
  }

  showToast('info', 'Transaction Submitted', `Hash: ${sendResponse.hash.slice(0, 12)}…`, 4000);

  // 5. Poll until SUCCESS or FAILED
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const pollResponse = await server.getTransaction(sendResponse.hash);
    if (pollResponse.status === StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) return;
    if (pollResponse.status === StellarSdk.rpc.Api.GetTransactionStatus.FAILED) {
      showToast('error', 'Transaction Failed', 'The transaction was rejected on-chain.');
      throw new Error('Transaction failed on-chain.');
    }
  }
  showToast('error', 'Transaction Timeout', 'No confirmation after 30 seconds. Check Stellar Explorer.');
  throw new Error('Transaction timed out waiting for confirmation.');
}

// ─── ScVal helpers (stellar-sdk v13 uses nativeToScVal) ──────────────────────
function addrVal(addr: string): StellarSdk.xdr.ScVal {
  return StellarSdk.Address.fromString(addr).toScVal();
}
function strVal(s: string): StellarSdk.xdr.ScVal {
  return StellarSdk.nativeToScVal(s, { type: 'string' });
}
function i128Val(xlm: number): StellarSdk.xdr.ScVal {
  return StellarSdk.nativeToScVal(xlmToStroops(xlm), { type: 'i128' });
}
function vecVal(arr: string[]): StellarSdk.xdr.ScVal {
  return StellarSdk.nativeToScVal(arr.map(s => strVal(s)), { type: 'vec' });
}

// ─── Contract Functions ───────────────────────────────────────────────────────

/** register_user — verify account and set IGN on-chain */
export async function registerUser(
  userAddress: string,
  username: string
): Promise<void> {
  await invokeContract(userAddress, 'register_user', [
    addrVal(userAddress),
    strVal(username),
  ]);
}

/** mint_player_profile — list as a professional scoutable profile */
export async function mintPlayerProfile(
  playerAddress: string,
  role: string,
  bio: string,
  achievements: string[],
  listPriceXlm: number
): Promise<void> {
  await invokeContract(playerAddress, 'mint_player_profile', [
    addrVal(playerAddress),
    strVal(role),
    strVal(bio),
    vecVal(achievements),
    i128Val(listPriceXlm),
  ]);
}

/** LEGACY: register_player */
export async function registerPlayer(
  playerAddress: string,
  role: string,
  listPriceXlm: number
): Promise<void> {
  await invokeContract(playerAddress, 'register_player', [
    addrVal(playerAddress),
    strVal(role),
    i128Val(listPriceXlm),
  ]);
}

/** place_bid — bargain bid; must be lower than the player's list price */
export async function placeBid(
  bidderAddress: string,
  playerAddress: string,
  bidAmountXlm: number
): Promise<void> {
  await invokeContract(bidderAddress, 'place_bid', [
    addrVal(bidderAddress),
    addrVal(playerAddress),
    i128Val(bidAmountXlm),
  ]);
}

/** accept_bid — current owner accepts the standing bid */
export async function acceptBid(
  ownerAddress: string,
  playerAddress: string
): Promise<void> {
  await invokeContract(ownerAddress, 'accept_bid', [
    addrVal(playerAddress),
  ]);
}

/** buyout — instantly secure a player's contract for the list price */
export async function buyout(
  buyerAddress: string,
  playerAddress: string
): Promise<void> {
  await invokeContract(buyerAddress, 'buyout', [
    addrVal(buyerAddress),
    addrVal(playerAddress),
  ]);
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
  listPriceXlm: number;
}

/** getProfile — read a player's on-chain profile (no signature needed) */
export async function getProfile(playerAddress: string): Promise<OnChainProfile | null> {
  try {
    // Hardening: Prevent crash if address is invalid/mock
    if (!playerAddress || !playerAddress.startsWith('G') || playerAddress.length !== 56) {
      console.warn(`[Soroban] Skipping getProfile for invalid address: ${playerAddress}`);
      return null;
    }

    const retval = await simulateInvoke('get_profile', [addrVal(playerAddress)]);
    if (!retval) return null;

    const map = retval.map();
    if (!map) return null;

    const find = (key: string) => map.find((e: any) => {
      try { return e.key().sym().toString() === key; } catch { return false; }
    })?.val();

    const username = find('username')?.str()?.toString() ?? '';
    const role = find('role')?.str()?.toString() ?? '';
    const bio = find('bio')?.str()?.toString() ?? '';
    const achievements = find('achievements')?.vec()?.map((v: any) => v.str().toString()) ?? [];
    const winPoints = find('win_points')?.u32() ?? 0;
    const owner = StellarSdk.Address.fromScVal(find('owner')!).toString();
    const originalCreator = StellarSdk.Address.fromScVal(find('original_creator')!).toString();
    const rawPrice = find('list_price')?.i128();
    const listPriceXlm = rawPrice
      ? stroopsToXlm(parseI128(rawPrice))
      : 0;

    return { username, role, bio, achievements, winPoints, owner, originalCreator, listPriceXlm };
  } catch (err) {
    console.error(`[Soroban] getProfile failed for ${playerAddress}:`, err);
    return null;
  }
}

/** getUsername — read only registration IGN */
export async function getUsername(userAddress: string): Promise<string | null> {
  try {
    const retval = await simulateInvoke('get_username', [addrVal(userAddress)]);
    if (!retval) return null;
    return retval.str().toString();
  } catch {
    return null;
  }
}

/** getCurrentBid — current standing bid amount for a player in XLM */
export async function getCurrentBid(playerAddress: string): Promise<number> {
  try {
    const retval = await simulateInvoke('get_current_bid', [addrVal(playerAddress)]);
    if (!retval) return 0;
    const stroops = retval.i128();
    return stroopsToXlm(parseI128(stroops));
  } catch (err) {
    console.warn(`[Soroban] Failed to get current bid for ${playerAddress}`, err);
    return 0;
  }
}

/** get_all_player_addresses — retrieve the global registry */
export async function getAllPlayerAddresses(): Promise<string[]> {
  try {
    const retval = await simulateInvoke('get_all_player_addresses', []);
    if (!retval) return [];
    return retval.vec()?.map((v: any) => StellarSdk.Address.fromScVal(v).toString()) ?? [];
  } catch (err) {
    console.error('[Soroban] Failed to fetch player registry:', err);
    return [];
  }
}

/** syncGlobalMarket — Optimized Single-Call Sync */
export async function syncGlobalMarket(setPlayersInStore: (p: any[]) => void): Promise<void> {
  try {
    console.log('[Sync] Starting Optimized Global Sync...');
    const retval = await simulateInvoke('get_all_market_items', []);
    if (!retval) {
      console.warn('[Sync] Registry is empty or simulation failed.');
      return;
    }

    const native = StellarSdk.scValToNative(retval);
    if (!Array.isArray(native)) return;

    const players = native.map((item: any) => {
      const playerAddr = item.player.toString();
      const profile = item.profile;

      const highestBidXlm = typeof item.current_bid === 'bigint' ? stroopsToXlm(item.current_bid) : 0;
      const currentBidder = item.current_bidder ? item.current_bidder.toString() : null;

      return {
        id: playerAddr.slice(0, 10),
        name: profile.username || 'Scout',
        role: profile.role || 'N/A',
        bio: profile.bio || '',
        achievements: profile.achievements || [],
        winPoints: Number(profile.win_points || 0),
        address: playerAddr,
        owner: profile.owner.toString(),
        price: typeof profile.list_price === 'bigint' ? stroopsToXlm(profile.list_price) : 0,
        highestBid: highestBidXlm,
        currentBidder,
        isListed: profile.listed,
        endTime: '24:00',
        stats: { kda: 'N/A', winRate: 'N/A', matches: 0, tournamentsWon: 0, mvpAwards: 0, avgGoldMin: 'N/A' }
      };
    });

    setPlayersInStore(players);
    console.log(`[Sync] Market discovery complete! Sync'd ${players.length} players.`);
  } catch (err) {
    console.error('[Sync] Market Sync failed:', err);
  }
}

/** Helper for read-only simulations — returns the return value ScVal or null. */
async function simulateInvoke(method: string, args: StellarSdk.xdr.ScVal[]): Promise<any> {
  const server = getServer();
  const contract = new StellarSdk.Contract(CONTRACT_ID);
  const dummyAccount = new StellarSdk.Account(ADMIN_ADDRESS, '0');

  const tx = new StellarSdk.TransactionBuilder(dummyAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(10)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim) || !sim.result) return null;
  return sim.result.retval;
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
    // 1. Fetch Global Marketplace (Visible public items + Bids)
    const marketRaw = await simulateInvoke('get_all_market_items', []);

    // 2. Fetch Owned Assets (only if account is funded on-chain)
    let ownedRaw = null;
    const funded = await isAccountFunded(walletAddress);
    if (funded) {
      ownedRaw = await simulateInvoke('get_owned_assets', [addrVal(walletAddress)]);
    } else {
      console.warn(`[Full Sync] Wallet ${walletAddress.slice(0, 8)}... is unfunded. Skipping owned-assets lookup.`);
    }

    const parseItems = (raw: any): Player[] => {
      if (!raw) return [];
      const native = StellarSdk.scValToNative(raw);
      if (!Array.isArray(native)) return [];

      return native.map((item: any) => {
        const profile = item.profile;
        const playerAddr = item.player.toString();

        const parseAmount = (val: any) => typeof val === 'bigint' ? stroopsToXlm(val) : 0;

        return {
          id: playerAddr.slice(0, 10),
          name: profile.username || 'Scout',
          role: profile.role || 'N/A',
          bio: profile.bio || '',
          achievements: profile.achievements || [],
          winPoints: Number(profile.win_points || 0),
          address: playerAddr,
          owner: profile.owner.toString(),
          price: parseAmount(profile.list_price),
          highestBid: parseAmount(item.current_bid),
          currentBidder: item.current_bidder ? item.current_bidder.toString() : null,
          isListed: profile.listed,
          endTime: '24:00',
          stats: { kda: 'N/A', winRate: 'N/A', matches: 0, tournamentsWon: 0, mvpAwards: 0, avgGoldMin: 'N/A' }
        } as Player;
      });
    };

    const mPlayers = parseItems(marketRaw);
    const oPlayers = parseItems(ownedRaw);

    // Merge: Store identity is unique per Address
    const registryMap = new Map<string, Player>();

    // Fill with Personal Assets first (True ownership)
    oPlayers.forEach(p => registryMap.set(p.address, p));

    // Layer with Market Data (Market data might have updated bid info)
    mPlayers.forEach(p => {
      const existing = registryMap.get(p.address);
      if (existing) {
        // Merge properties, keeping ownership from Personal for consistency
        registryMap.set(p.address, { ...existing, ...p });
      } else {
        registryMap.set(p.address, p);
      }
    });

    const finalPlayers = Array.from(registryMap.values());
    setPlayersInStore(finalPlayers);
    console.log(`[Full Sync] Combined discovery complete: ${mPlayers.length} market, ${oPlayers.length} owned.`);
  } catch (err) {
    console.error('[Full Sync] Convergence failed:', err);
  }
}
/**
 * ScoutGrid Soroban Contract Client
 *
 * Contract:  CAYU6ZAZVKY3WVB2GZCTNS3EZT2WEY2OWWBMYWGIJ6FLYQNNCP2ZY27P
 * Network:   Stellar Testnet
 * Admin:     GCF4N2ZDIGVYGSXUT7XCUBR3WHPT2FYTIADXUODQZ57MOWX6USIEW2CY
 *
 * stellar-sdk v13: SorobanRpc → rpc, scVal → nativeToScVal
 */

import * as StellarSdk from 'stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { type Player, INITIAL_PLAYERS } from './mock-data';

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

// ─── Helper: build → simulate → sign → submit → poll ─────────────────────────
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

  // Simulate to get resource footprint
  console.log(`[Soroban] Simulating ${functionName}...`, { callerAddress, args });
  const simResult = await server.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: The contract may be uninitialized or the action is unauthorized.`);
  }
  console.log(`[Soroban] Simulation Result:`, simResult);

  // Assemble with footprint
  const preparedTx = StellarSdk.rpc.assembleTransaction(tx, simResult).build();
  console.log(`[Soroban] Prepared Transaction XDR:`, preparedTx.toXDR());

  // Sign via Freighter v6 — throws on rejection instead of returning { error }
  let signedXdr: string;
  try {
    const signed = await signTransaction(preparedTx.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    signedXdr = signed.signedTxXdr;
  } catch {
    throw new Error('Transaction rejected in Freighter.');
  }

  // ⚠️ Bypass stellar-sdk XDR re-parsing (causes "Bad union switch" with Freighter v6).
  // Submit the signed XDR directly via the Soroban JSON-RPC endpoint instead.
  const sendRes = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'sendTransaction',
      params: { transaction: signedXdr },
    }),
  });
  const sendJson = await sendRes.json();
  if (sendJson.error) throw new Error(`RPC error: ${JSON.stringify(sendJson.error)}`);

  const { hash, status: sendStatus } = sendJson.result;
  if (sendStatus === 'ERROR') {
    throw new Error(`Network rejected transaction: ${JSON.stringify(sendJson.result)}`);
  }

  // Poll getTransaction until SUCCESS or FAILED
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const pollRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2,
        method: 'getTransaction',
        params: { hash },
      }),
    });
    const pollJson = await pollRes.json();
    const txStatus = pollJson.result?.status;
    if (txStatus === 'SUCCESS') return;
    if (txStatus === 'FAILED') throw new Error('Transaction failed on-chain.');
  }
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
    const server = getServer();
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    // Hardening: Prevent crash if address is invalid/mock
    if (!playerAddress || !playerAddress.startsWith('G') || playerAddress.length !== 56) {
      console.warn(`[Soroban] Skipping getProfile for invalid address: ${playerAddress}`);
      return null;
    }

    const dummy = new StellarSdk.Account(playerAddress, '0');

    const tx = new StellarSdk.TransactionBuilder(dummy, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_profile', addrVal(playerAddress)))
      .setTimeout(10)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim) || !sim.result) return null;

    const map = sim.result.retval.map();
    if (!map) return null;

    const find = (key: string) => map.find(e => {
      try { return e.key().sym().toString() === key; } catch { return false; }
    })?.val();

    const username = find('username')?.str()?.toString() ?? '';
    const role = find('role')?.str()?.toString() ?? '';
    const bio = find('bio')?.str()?.toString() ?? '';
    const achievements = find('achievements')?.vec()?.map(v => v.str().toString()) ?? [];
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
    const server = getServer();
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const dummy = new StellarSdk.Account(userAddress, '0');

    const tx = new StellarSdk.TransactionBuilder(dummy, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_username', addrVal(userAddress)))
      .setTimeout(10)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim) || !sim.result) return null;

    return sim.result.retval.str().toString();
  } catch {
    return null;
  }
}

/** getCurrentBid — current standing bid amount for a player in XLM */
export async function getCurrentBid(playerAddress: string): Promise<number> {
  try {
    const server = getServer();
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const dummy = new StellarSdk.Account(playerAddress, '0');

    const tx = new StellarSdk.TransactionBuilder(dummy, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_current_bid', addrVal(playerAddress)))
      .setTimeout(10)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim) || !sim.result) return 0;

    const stroops = sim.result.retval.i128();
    return stroopsToXlm(parseI128(stroops));
  } catch (err) {
    console.warn(`[Soroban] Failed to get current bid for ${playerAddress}`, err);
    return 0;
  }
}
/** get_all_player_addresses — retrieve the global registry */
export async function getAllPlayerAddresses(): Promise<string[]> {
  try {
    const server = getServer();
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const dummy = new StellarSdk.Account(ADMIN_ADDRESS, '0');

    const tx = new StellarSdk.TransactionBuilder(dummy, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_all_player_addresses'))
      .setTimeout(10)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim) || !sim.result) return [];

    return sim.result.retval.vec()?.map(v => StellarSdk.Address.fromScVal(v).toString()) ?? [];
  } catch (err) {
    console.error('[Soroban] Failed to fetch player registry:', err);
    return [];
  }
}

/** syncGlobalMarket — Optimized Single-Call Sync */
export async function syncGlobalMarket(setPlayersInStore: (p: any[]) => void): Promise<void> {
  try {
    console.log('[Sync] Starting Optimized Global Sync...');
    const server = getServer();
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const dummy = new StellarSdk.Account(ADMIN_ADDRESS, '0');

    const tx = new StellarSdk.TransactionBuilder(dummy, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_all_market_items'))
      .setTimeout(10)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim) || !sim.result) {
      console.warn('[Sync] Registry is empty or simulation failed.');
      return;
    }

    const itemsVec = sim.result.retval.vec();
    if (!itemsVec) return;

    const players = itemsVec.map(itemSc => {
      // Use scValToNative for easier parsing of the MarketItem struct
      const item = StellarSdk.scValToNative(itemSc);
      
      const playerAddr = item.player.toString();
      const profile = item.profile;
      
      const highestBidXlm = stroopsToXlm(item.current_bid);
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
        price: stroopsToXlm(profile.list_price),
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

/** 
 * Helper for read-only simulations 
 */
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
    // 2. Fetch Owned Assets (Private Collection)
    const marketRaw = await simulateInvoke('get_all_market_items', []);
    const ownedRaw = await simulateInvoke('get_owned_assets', [addrVal(walletAddress)]);

    const parseItems = (raw: any): Player[] => {
      if (!raw) return [];
      const native = StellarSdk.scValToNative(raw);
      if (!Array.isArray(native)) return [];
      
      return native.map((item: any) => {
        const profile = item.profile;
        const playerAddr = item.player.toString();
        
        // Find local mock data to keep rich stats (KDA, matches, etc.)
        const localTemplate = INITIAL_PLAYERS.find((p: Player) => p.address === playerAddr);

        const parseAmount = (val: any) => typeof val === 'bigint' ? stroopsToXlm(val) : 0;

        return {
          ...localTemplate, // Spread local details (stats, bio, etc.) first
          id: playerAddr.slice(0, 10),
          name: profile.username || (localTemplate?.name) || 'Scout',
          role: profile.role || (localTemplate?.role) || 'N/A',
          bio: profile.bio || (localTemplate?.bio) || '',
          achievements: profile.achievements || (localTemplate?.achievements) || [],
          winPoints: Number(profile.win_points || 0),
          address: playerAddr,
          owner: profile.owner.toString(),
          price: parseAmount(profile.list_price),
          highestBid: parseAmount(item.current_bid),
          currentBidder: item.current_bidder ? item.current_bidder.toString() : null,
          isListed: profile.listed,
          endTime: localTemplate?.endTime || '24:00',
          stats: localTemplate?.stats || { kda: 'N/A', winRate: 'N/A', matches: 0, tournamentsWon: 0, mvpAwards: 0, avgGoldMin: 'N/A' }
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

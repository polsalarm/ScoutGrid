# Soroban Contract Client

**File:** `frontend/src/lib/contract.ts`  
**SDK:** `@stellar/stellar-sdk` v15 (Protocol 22 native)  
**Network:** Stellar Testnet  
**Contract ID:** `CBJKAS62XBI54L4BTMLUVTWZGBJJMM23GYMN2UPZHATY4WOIPVYV74U6`  
**RPC:** `https://soroban-testnet.stellar.org`

---

## Overview

Pure TypeScript client for the ScoutGrid Soroban contract. Handles transaction building, simulation, signing (via StellarWalletsKit), and submission. No React dependency — can be imported in any TS file.

---

## Transaction flow (`invokeContract`)

```
1. server.getAccount(callerAddress)          — fetch sequence number from RPC
2. build transaction                         — wrap contract call in TransactionBuilder
3. server.simulateTransaction(tx)            — get resource footprint + fee estimate
4. rpc.assembleTransaction(tx, sim).build()  — attach footprint (Protocol 22 native)
5. StellarWalletsKit.signTransaction()       — wallet popup; returns signed XDR
6. TransactionBuilder.fromXDR(signedXdr)     — parse signed tx back for submission
7. server.sendTransaction(signedTx)          — submit via SDK
8. server.getTransaction(hash) ×20 / 1.5s   — poll until SUCCESS/FAILED
```

---

## Exported functions

### Write (require wallet signature)

| Function | Contract call | Caller |
|---|---|---|
| `registerUser(address, username)` | `register_user` | user |
| `mintPlayerProfile(address, role, bio, achievements, priceXlm)` | `mint_player_profile` | player |
| `placeBid(bidder, player, amountXlm)` | `place_bid` | bidder |
| `acceptBid(owner, player)` | `accept_bid` | owner |
| `buyout(buyer, player)` | `buyout` | buyer |

### Read (simulation only — no signature)

| Function | Contract call | Returns |
|---|---|---|
| `getProfile(address)` | `get_profile` | `OnChainProfile \| null` |
| `getUsername(address)` | `get_username` | `string \| null` |
| `getCurrentBid(address)` | `get_current_bid` | `number` (XLM) |
| `getAllPlayerAddresses()` | `get_all_player_addresses` | `string[]` |

### Sync helpers

| Function | Description |
|---|---|
| `syncGlobalMarket(setPlayers)` | Single-call sync from `get_all_market_items`; updates store |
| `syncFullRegistry(wallet, setPlayers)` | Two-pass merge: market items + owned assets; handles private collections |

---

## XLM ↔ Stroops

```typescript
xlmToStroops(xlm: number): bigint   // 1 XLM = 10_000_000 stroops
stroopsToXlm(stroops: bigint): number
```

---

## Error handling

- Simulation failures → `"Simulation failed: The contract may be uninitialized or the action is unauthorized."`
- Wallet rejection → `"Transaction rejected in wallet."`
- RPC error → `"RPC error: ..."`
- Timeout (20 polls × 1.5s) → `"Transaction timed out waiting for confirmation."`

---

## History

| Date | Change |
|---|---|
| 2026-04-21 | Replaced `signTransaction` from `@stellar/freighter-api` with `StellarWalletsKit.signTransaction()` |
| 2026-04-21 | Migrated from `stellar-sdk` v13 → `@stellar/stellar-sdk` v15; removed all raw fetch/JSON-RPC bypasses; now uses `server.simulateTransaction()`, `rpc.assembleTransaction()`, `server.sendTransaction()`, and `server.getTransaction()` natively (Protocol 22 fix) |

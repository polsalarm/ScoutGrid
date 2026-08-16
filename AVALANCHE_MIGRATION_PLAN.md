# ScoutGrid → Avalanche Migration Plan

**Status:** IN PROGRESS — Phases 0–4 executed 2026-08-16 (contract + frontend ported, 16/16 tests passing). Blocked on user funding a Fuji wallet before deployment (Phase 5) can complete.
**Scope:** full migration. All Stellar/Soroban code is deleted, not kept alongside.
**Author:** drafted 2026-08-16
**Source stack:** Stellar Testnet · Soroban (Rust, `soroban-sdk` 25.2) · `@stellar/stellar-sdk` v15 · StellarWalletsKit v2
**Target stack:** Avalanche Fuji C-Chain (Phase 1) → optional custom Avalanche L1 (Phase 2) · Solidity 0.8.26 + Foundry · viem/wagmi + `@avalanche-sdk/client`

---

## 0. Verdict

Migration is **feasible with high confidence**. ScoutGrid uses no Stellar-exclusive primitive — no anchors, no SEPs, no trustlines, no path payments, no multi-operation transactions, no classic assets. It is:

- one monolithic contract (state machine + escrow + lending pool),
- one native-token payment rail,
- a React SPA that reads/writes that contract.

All three map cleanly onto EVM. The port is **mechanical for ~70%** of the code and **requires real design decisions for ~30%** (auth model, reentrancy, pool accounting).

**Estimated effort:** 4–5 focused days for Phase 1 (Fuji C-Chain, full parity). +2–3 days for Phase 2 (custom L1).

### What gets EASIER on Avalanche

| Area | Why |
|------|-----|
| Read calls | viem decodes ABI structs to typed JS objects. Deletes `parseI128`, `addrVal`, `strVal`, `vecVal`, and every `.map()/.sym()/.str()/.i128()` chain — **~120 lines gone** from `contract.ts` |
| Write calls | `simulateContract` → `writeContract` → `waitForTransactionReceipt` replaces build→simulate→assemble→sign→submit→poll (~75 lines → ~25) |
| Storage | No TTL / no state rent / no `extend_ttl` bookkeeping. EVM storage is permanent |
| Message signing | Every EVM wallet supports `personal_sign`. Deletes the "Albedo/xBull may not support signMessage" try/catch fallback in `WalletModal.tsx:83-88` |
| Account existence | EVM accounts need no funding to exist. `isAccountFunded()` and the whole Friendbot pre-flight disappear |
| Errors | Solidity custom errors decode client-side with names + args, vs. today's opaque "Simulation failed" toast |

### What gets HARDER

| Area | Why |
|------|-----|
| Auth model | **The big one.** Soroban's `require_auth()` authorizes *sub-invocations* — the contract can pull tokens from the bidder inside `place_bid`. EVM has no equivalent. See §2.1 |
| Reentrancy | Soroban token transfers can't re-enter. EVM `.call{value:}` to an arbitrary address can. See §2.4 |
| Gas for strings | `mint_player_profile` writes `username`, `role`, `bio`, `string[] achievements`. On EVM this is genuinely expensive storage. See §2.6 |
| Testnet funding | Stellar Friendbot is instant + anonymous. Fuji faucet requires mainnet AVAX or a Builder Hub GitHub login. See §5.2 |
| Unbounded loops | `get_all_market_items` loops the whole registry. Free as an `eth_call`, but has a real ceiling. See §2.7 |

---

## 1. Target chain decision

### Option A — Fuji C-Chain (RECOMMENDED for Phase 1)

| | |
|---|---|
| Chain ID | `43113` |
| RPC | `https://api.avax-test.network/ext/bc/C/rpc` |
| Explorer | `https://testnet.snowtrace.io` |
| viem chain | `avalancheFuji` (built in — zero config) |
| Wallets | Core, MetaMask, Rabby, WalletConnect all ship Fuji |
| Effort | Baseline |

**Pros:** fastest path, public explorer for README screenshots, every wallet works out of the box, `@avalanche-sdk/client` and viem support it natively.
**Cons:** faucet friction (§5.2), no "we launched our own chain" narrative.

### Option B — Custom Avalanche L1 (Subnet-EVM) — Phase 2

Per [Avalanche L1 Academy](https://build.avax.network/academy), the relevant courses are `permissioned-l1s` (Proof of Authority via Validator Manager), `l1-native-tokenomics` (custom gas token + native minting), and `interchain-messaging` (ICM/Teleporter).

**Pros:**
- Custom gas token (`SCOUT`) **allocated at genesis** → completely eliminates the faucet problem. You mint demo wallets' balances in the genesis file. Gas feels free.
- Strong differentiator narrative: "ScoutGrid runs on its own sovereign L1."
- Native minting rights → the lending pool could be seeded programmatically.
- ICM/Teleporter unlocks a future cross-chain flex (bridge profile ownership to C-Chain).

**Cons:**
- Needs validators + RPC uptime. A demo dies if your node dies.
- No Snowtrace. You'd self-host an explorer or drop explorer verification from the README.
- Wallets need `wallet_addEthereumChain` to add your network (one extra user click, handled by wagmi).

**Cost:** +2–3 days.

### Recommendation

**Build Phase 1 on Fuji C-Chain. Treat the L1 as a Phase-2 config swap.**

The Solidity bytecode is *identical* on both — Subnet-EVM is EVM-equivalent. Isolate all chain-specific values into a single `frontend/src/lib/chain.ts`, and moving to an L1 becomes a ~20-line diff, not a rewrite. This defers the decision without cost.

---

## 2. Contract port: `contract/src/lib.rs` → `contracts/src/ScoutGridMarket.sol`

### 2.1 Auth model — the critical change

Today, `place_bid` does:

```rust
bidder.require_auth();                                    // authorizes sub-invocations
client.transfer(&bidder, &env.current_contract_address(), &amount);  // pulls FROM bidder
```

EVM cannot pull native tokens from a caller. Two options:

**Option A — Native AVAX + `payable` (RECOMMENDED)**

```solidity
function placeBid(address player) external payable nonReentrant {
    uint256 amount = msg.value;
    ...
}
```

- 1:1 UX parity with XLM today. One transaction per action.
- Requires: `placeBid`, `buyout`, `repayLoan`, `fundPool` become `payable`.
- `repayLoan` must refund excess `msg.value` (user can't compute compound interest to the wei).

**Option B — ERC20 (USDC.e / WAVAX)**

- Requires `approve()` first → **two transactions per bid**. Worse UX, worse demo.
- Only worth it if you need a stable unit of account.

→ **Go with Option A.** Every function signature loses its explicit `amount` / `from` param where `msg.value` / `msg.sender` now carry it.

### 2.2 Type mapping

| Soroban | Solidity | Notes |
|---------|----------|-------|
| `Address` | `address` | 56-char `G...` → 20-byte `0x...`. Frontend guard at `contract.ts:235` (`startsWith('G') && length === 56`) → `viem.isAddress()` |
| `i128` (stroops, 7dp) | `uint256` (wei, 18dp) | **All amounts change decimals.** `xlmToStroops`/`stroopsToXlm` → `parseEther`/`formatEther` |
| `String` | `string` | Storage cost rises sharply — see §2.6 |
| `soroban_sdk::Vec<String>` | `string[]` | |
| `Option<Address>` | `address` | Use `address(0)` as the "no bidder" sentinel |
| `u32 win_points` | `uint32` | |
| `enum DataKey` | `mapping` per key | `Registration(Address)` → `mapping(address => string) usernames`, etc. |
| `#[contracterror] u32` | `error Unauthorized();` | Custom errors — viem decodes name + args client-side |
| `panic_with_error!` | `revert Unauthorized();` | |
| `env.storage().instance()` | contract storage vars | `marketToken` is deleted entirely (native AVAX) |
| `env.storage().persistent()` | contract storage vars | No TTL, no rent |

### 2.3 Time model — ledgers → timestamps

`env.ledger().sequence()` has no EVM equivalent worth using (`block.number` is unreliable across chains). Switch to `block.timestamp`.

```solidity
uint256 public constant LOAN_DURATION = 30 days;   // was LOAN_DURATION_LEDGERS = 518_400
uint256 public constant INTEREST_RATE_BPS = 500;   // unchanged
```

`518_400 ledgers × 5s = 2,592,000s = 30 days` — semantics preserved exactly.

`LoanRecord` fields rename: `start_ledger`/`due_ledger` → `startTime`/`dueTime` (`uint64`).

**Frontend ripple** (all currently multiply by 5 to convert ledgers→seconds):
- `LoanBadge.tsx:11-25` — `ledgersLeft * 5` → seconds directly
- `RepayModal.tsx:16-49` — same
- `types.ts:4-5` — `startLedger`/`dueLedger` → `startTime`/`dueTime`
- `contract.ts:17` — `LOAN_DURATION_LEDGERS` → `LOAN_DURATION_SECONDS = 2_592_000`
- `contract.ts:370` — `getCurrentLedger()` → `getChainTime()` via `publicClient.getBlock()`

### 2.4 Reentrancy — new risk class

`placeBid` refunds the previous bidder with an external call to a **possibly hostile contract**. Same in `buyout`. Soroban's token client cannot re-enter; EVM `.call{value:}` can.

Required:
1. `import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";` — `nonReentrant` on every state-mutating function that transfers value.
2. Strict checks-effects-interactions: write the new bidder/bid to storage **before** refunding the old one.
3. Fallback for failed refunds — a hostile/contract bidder can revert on receive and permanently brick the player's bid slot:

```solidity
(bool ok,) = previousBidder.call{value: previousBid}("");
if (!ok) pendingRefunds[previousBidder] += previousBid;   // pull-payment escape hatch
```
   plus a public `withdrawRefund()`.

### 2.5 🔴 MUST-FIX: lending pool over-accounting bug

**This bug exists in the Soroban contract today and will cause hard transaction failures on EVM.**

`lib.rs:480-500` — `liquidate()`:

```rust
let pool: i128 = ...get(&DataKey::LoanPool).unwrap_or(0);
env.storage().persistent().set(&DataKey::LoanPool, &(pool + loan.principal));
```

The pool counter is credited `principal` — but **no tokens actually arrive**. That principal was paid out to the borrower in `take_loan` and is never returned; the collateral (the profile NFT) is what covers the debt, and it's transferred to the admin instead.

Result: `loanPool` (the counter) drifts above the contract's real balance. On Stellar this is currently masked because the contract also holds bid escrow. On EVM, the next `takeLoan` that passes the `amount > pool` check will attempt a native transfer the contract can't cover and **revert**.

**Fix during the port — pick one:**
- **(a)** Don't credit the pool on liquidation. Instead, list the seized profile and route `acceptBid`/`buyout` proceeds for admin-owned profiles back into `loanPool`. Economically correct, more code.
- **(b)** Don't credit the pool at all on liquidation. The pool takes the loss; the admin holds the collateral. Simplest, honest, one-line change.

→ **Recommend (b) for Phase 1**, with (a) noted as roadmap. Also add an invariant assertion in tests: `loanPool + totalBidEscrow <= address(this).balance`.

### 2.6 Gas cost of on-chain profile strings

`mintPlayerProfile` writes `username`, `role`, `bio`, and a `string[]` of achievements. On Soroban this is cheap; on EVM each 32-byte storage word is ~20k gas cold.

**Options:**
- **Keep fully on-chain** — preserves the "verified on-chain profile" narrative. Cost on Fuji is negligible (faucet AVAX). Cost on an L1 with a genesis-allocated gas token is effectively zero. → **Recommended.**
- Move `bio` + `achievements` to IPFS, store only a `bytes32` hash. Cheaper, but adds a pinning dependency and weakens the pitch.

Mitigations if keeping on-chain: cap `bio` length, cap `achievements.length` (e.g. 10), and use `bytes32` for `role` since it's drawn from a fixed 7-item enum (`constants.ts:22-30`).

### 2.7 Unbounded registry loop

`get_all_market_items` / `get_owned_assets` iterate the full `PlayerRegistry`. As `view` functions they cost no gas via `eth_call`, but public RPC nodes cap `eth_call` gas (Fuji default ~50M). Fine into the thousands of profiles; add a paginated variant (`getMarketItems(uint256 offset, uint256 limit)`) as a defensive measure.

### 2.8 Pre-existing logic gap (free win during port)

`place_bid` never checks `profile.listed`. A profile locked as loan collateral (`take_loan` sets `listed = false`, `lib.rs:444`) can still receive bids. Add `if (!p.listed) revert NotListed();` to `placeBid` and `buyout`.

### 2.9 Function-by-function map

| Soroban | Solidity | Change |
|---------|----------|--------|
| `init(token, admin)` | `constructor(address admin)` | `token` param deleted (native AVAX) |
| `set_admin(new_admin)` | `setAdmin(address)` + `onlyAdmin` | |
| `register_user(user, username)` | `registerUser(string username)` | `user` → `msg.sender` |
| `mint_player_profile(player, role, bio, achievements, list_price)` | `mintPlayerProfile(bytes32 role, string bio, string[] achievements, uint256 listPrice)` | `player` → `msg.sender` |
| `register_player(...)` (legacy) | **DELETE** | Dead code — no frontend caller. `registerPlayer` in `contract.ts:172` is unreferenced |
| `add_win_point(player)` | `addWinPoint(address)` + `onlyAdmin` | Replace bare `panic!("Player not found")` (`lib.rs:191`) with a custom error |
| `place_bid(bidder, player, amount)` | `placeBid(address player) payable nonReentrant` | `amount` → `msg.value`; add `listed` check |
| `accept_bid(player)` | `acceptBid(address player) nonReentrant` | `profile.owner.require_auth()` → `require(msg.sender == p.owner)` |
| `buyout(buyer, player)` | `buyout(address player) payable nonReentrant` | `msg.value == listPrice`; refund excess |
| `fund_pool(funder, amount)` | `fundPool() payable` | `amount` → `msg.value` |
| `take_loan(borrower, player, amount)` | `takeLoan(address player, uint256 amount) nonReentrant` | LTV tiers unchanged (`compute_max_ltv`) |
| `repay_loan(borrower, player)` | `repayLoan(address player) payable nonReentrant` | Refund `msg.value - repayment` |
| `liquidate(player)` | `liquidate(address player)` | **Apply §2.5 fix.** Permissionless in both |
| `get_*` (7 read fns) | `view` functions | Return typed structs; viem auto-decodes |

`compute_max_ltv` maps 1:1 — Solidity `if/else` ladder or the same match semantics.

---

## 3. Frontend port

### 3.1 Dependency swap — `frontend/package.json`

**Remove:**
```
@stellar/stellar-sdk        ^15.0.1
@stellar/freighter-api      ^6.0.1
@creit.tech/stellar-wallets-kit  ^2.1.0
vite-plugin-node-polyfills  ^0.26.0    ← likely droppable; stellar-sdk needed Buffer, viem doesn't
```

**Add:**
```
viem                    ^2.x
wagmi                   ^2.x
@tanstack/react-query   ^5.x     (wagmi peer dep)
@avalanche-sdk/client   latest   (optional — viem-compatible; adds Avalanche chain defs + P/X-chain if ever needed)
```

Verify whether `--legacy-peer-deps` (currently in `vercel.json` and `.github/workflows/ci.yml`) is still needed after the swap — it was added for the Stellar deps. Likely removable.

**Unchanged:** react 19, react-router 7, zustand, tailwind, lucide, `@google/generative-ai`, `vite-plugin-pwa`, `react-markdown`, `uuid`, `clsx`, `tailwind-merge`.

### 3.2 New file — `frontend/src/lib/chain.ts`

Single source of truth for chain config. **This is what makes the Phase-2 L1 swap trivial.**

```ts
import { avalancheFuji } from 'viem/chains';
export const ACTIVE_CHAIN = avalancheFuji;
export const CONTRACT_ADDRESS = '0x...' as const;
export const EXPLORER_TX = (h: string) => `https://testnet.snowtrace.io/tx/${h}`;
```

Phase 2 replaces `avalancheFuji` with a `defineChain({...})` literal. Nothing else in the app changes.

### 3.3 Rewrite — `frontend/src/lib/contract.ts` (528 lines → ~300)

**Preserve every exported function name and signature** so the 10 importing call sites need near-zero edits:

```
Navbar.tsx        getProfile, getUsername
BidModal.tsx      placeBid, buyout, syncGlobalMarket
LoanBadge.tsx     LOAN_DURATION_LEDGERS          ← rename to LOAN_DURATION_SECONDS
LoanModal.tsx     takePlayerLoan, getPoolBalance
MintModal.tsx     mintPlayerProfile
PlayerCard.tsx    buyout, acceptBid, syncGlobalMarket
RegisterModal.tsx registerUser, getUsername
RepayModal.tsx    repayPlayerLoan, getCurrentLedger  ← rename to getChainTime
Marketplace.tsx   syncFullRegistry
MyRoster.tsx      syncFullRegistry, acceptBid, getActiveLoan
```

**Deleted:** `parseI128`, `addrVal`, `strVal`, `i128Val`, `vecVal`, `simulateInvoke`, `isAccountFunded`, `xlmToStroops`, `stroopsToXlm`, `registerPlayer`, `getServer`, and all ScVal field-plucking in `getProfile`/`syncGlobalMarket`/`syncFullRegistry`/`getActiveLoan`.

**New `invokeContract` shape** (replaces `contract.ts:52-125`):

```ts
async function invokeContract(fn: string, args: unknown[], value = 0n) {
  showToast('info', 'Simulating Transaction', `Preparing ${fn}…`, 2500);
  const { request } = await publicClient.simulateContract({
    address: CONTRACT_ADDRESS, abi: SCOUTGRID_ABI,
    functionName: fn, args, account, value,
  });                                    // reverts decode to named custom errors ✅
  showToast('info', 'Approve in Wallet', 'Sign the transaction…', 12000);
  const hash = await walletClient.writeContract(request);
  showToast('info', 'Transaction Submitted', `Hash: ${hash.slice(0, 12)}…`, 4000);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') throw new Error('Transaction reverted on-chain.');
}
```

Keeps all five existing toast stages — **user-visible transaction UX is unchanged.**

The `txBadAuth` / "switch wallet to Testnet" special-case (`contract.ts:101-109`) is replaced by wagmi's `switchChain` — better, because we can *prompt the switch* instead of just telling the user to go do it.

Emit Solidity `event`s (`ProfileMinted`, `BidPlaced`, `BidAccepted`, `LoanTaken`, `LoanRepaid`, `Liquidated`) — enables `watchContractEvent` for live marketplace updates later. Not required for parity.

### 3.4 New file — `frontend/src/lib/abi.ts`

Foundry-generated ABI exported `as const` so viem infers arg/return types end-to-end. Wire `forge build` → ABI extraction into the build step so it can't drift from the contract.

### 3.5 Rewrite — `frontend/src/lib/walletKit.ts` (18 lines)

```ts
import { createConfig, http } from 'wagmi';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { ACTIVE_CHAIN } from './chain';

export const wagmiConfig = createConfig({
  chains: [ACTIVE_CHAIN],
  connectors: [injected(), walletConnect({ projectId: import.meta.env.VITE_WC_PROJECT_ID }), coinbaseWallet()],
  transports: { [ACTIVE_CHAIN.id]: http() },
});
```

`main.tsx` gains `<WagmiProvider>` + `<QueryClientProvider>` wrappers.

### 3.6 Rewrite — `WalletModal.tsx` (215 lines, ~40 change)

Keep the entire component structure, styling, error handling, and two-phase (`select` → `signing`) flow. Only the `WALLETS` array and the body of `handleSelect` change:

| Was | Becomes | Brand color to keep |
|-----|---------|---------------------|
| Freighter | **Core** (Avalanche's own wallet, `core.app`) | electric/cyan |
| Albedo | **MetaMask** | orange |
| xBull | **Rabby** | purple |
| HOT Wallet | **WalletConnect** | blue |

`handleSelect` body: `StellarWalletsKit.setWallet()` + `fetchAddress()` → wagmi `connect({ connector })`; `StellarWalletsKit.signMessage()` → wagmi `signMessage()`. **The try/catch fallback at `:83-88` is deleted** — all EVM wallets support `personal_sign`, so a failed signature is now a genuine rejection.

Add: `switchChain` prompt if the connected wallet is on the wrong network.

### 3.7 Mechanical sweeps

**a) `XLM` → `AVAX`** (or `SCOUT` on Phase-2 L1) — 24 string occurrences:
`BidModal.tsx` (×7) · `LoanModal.tsx` (×7) · `RepayModal.tsx` (×4) · `PlayerCard.tsx` (×3) · `LoanBadge.tsx` (×1) · `MintModal.tsx` (×1) · `Achievements.tsx` (×1) · `MyRoster.tsx` (×2) · `types.ts:3` comment · `demoConfig.ts:3` comment

→ Better: introduce `TOKEN_SYMBOL` in `chain.ts` and interpolate. One constant to flip for Phase 2.

**b) Decimals** — every `parseEther`/`formatEther` boundary. Anywhere a raw number crosses into the contract, confirm 18dp not 7dp. Unit-test the round-trip.

**c) Branding copy:**
- `AIChatbot.tsx:11` — "Soroban link stable" → "Avalanche link stable"
- `ai-service.ts:8` — "You live on the Soroban blockchain" → Avalanche
- `Marketplace.tsx:98` — "…directly on the Soroban network" → Avalanche
- `WalletModal.tsx:95` — "authenticated on Stellar Testnet" → "on Avalanche Fuji"

**d) `Navbar.tsx:42`** — Friendbot URL → Fuji faucet (`https://core.app/tools/testnet-faucet`). See §5.2.

**e) `demoConfig.ts`** — replace both `G...` demo addresses with funded `0x...` addresses.

### 3.8 Untouched files

`App.tsx` · `Layout.tsx` · `Toast.tsx` · `store.ts` · `demoData.ts` · `utils.ts` · `constants.ts` · `MyAchievements.tsx` · `index.css` · `App.css` · `tailwind.config.js` · `postcss.config.js` · all PWA/vite/tsconfig config · all page layout & routing.

---

## 4. Tests & CI

### 4.1 Contract tests: Rust → Foundry

The 10 existing tests in `contract/src/test.rs` (with snapshots under `contract/test_snapshots/`) port 1:1 to Foundry:

| # | Test | Port note |
|---|------|-----------|
| 1 | happy path register + first sale | direct |
| 2 | secondary sale with royalty | direct |
| 3 | bid ≥ list price rejected | `vm.expectRevert(BidTooLow.selector)` |
| 4 | refund on new bid | assert balance delta via `vm.deal` |
| 5 | unauthorized register | `vm.prank` |
| 6 | loan happy path | direct |
| 7 | loan compound interest | `vm.warp` replaces ledger advance |
| 8 | loan exceeds LTV rejected | direct |
| 9 | loan liquidation | **rewrite for §2.5 fix** |
| 10 | double loan rejected | direct |

**Add (new, EVM-specific):**
- reentrancy attack on `placeBid` refund (malicious contract bidder)
- refund-to-reverting-contract → `pendingRefunds` escape hatch
- `msg.value` mismatch on `buyout`
- excess-`msg.value` refund on `repayLoan`
- **solvency invariant fuzz:** `loanPool + totalBidEscrow <= address(this).balance` after any sequence of ops

Soroban's `test_snapshots/*.json` have no Foundry equivalent — replace with `forge snapshot` (gas snapshots) for the README's engineering-rigor section.

### 4.2 `.github/workflows/ci.yml`

Replace the `contract` job's `dtolnay/rust-toolchain` + `cargo test` with:

```yaml
- uses: foundry-rs/foundry-toolchain@v1
- run: forge build --sizes
- run: forge test -vvv
- run: forge fmt --check
```

`frontend` job unchanged apart from possibly dropping `--legacy-peer-deps` (verify).

### 4.3 Deployment

`stellar contract deploy` → `forge script script/Deploy.s.sol --rpc-url $FUJI_RPC --broadcast --verify`

Snowtrace verification (`--verify --etherscan-api-key`) gives a public, source-verified contract — a direct replacement for the StellarExpert screenshots in the README.

---

## 5. Known friction & mitigations

### 5.1 Contract addresses / redeploy
Contract ID `CCB3PY3P…QQED` is hardcoded at `contract.ts:18`; admin `GDGDODMJ…GZHP` at `contract.ts:21`. Both move to `chain.ts`. **All existing on-chain state is lost** — this is a fresh deployment, not a state migration. Demo profiles must be re-minted.

### 5.2 🟡 Testnet faucet friction

Stellar Friendbot: anonymous, instant, unlimited. Fuji faucet requires **either** a mainnet AVAX balance **or** a Builder Hub GitHub login, and is rate-limited (2 AVAX/day).

**Mitigations, in order of preference:**
1. Pre-fund 3–5 demo wallets before recording; distribute keys to judges/testers.
2. Add a `dripFaucet()` admin function to the contract that sends a small AVAX allowance to first-time users (gated by `hasRegistered`).
3. **Phase 2 L1 eliminates this entirely** — genesis allocation means you control every balance. This is the single strongest argument for going custom-L1.

### 5.3 README rewrite (38 KB, heavily Stellar-branded)
Sections requiring substantive rewrite, not find-replace: `## 🛡️ The Soroban Solution` · `## 🏗️ Stellar Features Used` · `## 💎 Why Stellar?` · `## 📜 Smart Contract Setup & Testing` · `## 🛠️ Sample CLI Invocations` (all `stellar contract invoke` → `cast send`) · `### 🌐 On-Chain Explorer Verification`.

`frontend/ui_images/StellarExpert.png` and the multi-wallet screenshots need re-capture. All other UI screenshots stay valid — the interface doesn't change.

### 5.4 Pre-existing (not migration-caused)
`frontend/.env` holds a live Gemini API key. It is correctly gitignored and **not tracked in git** — but any `VITE_*` variable is inlined into the client bundle and is therefore public on the deployed site regardless. Unchanged by this migration; worth routing through a serverless proxy separately.

---

## 6. Execution plan

### Phase 0 — Setup (0.5 day)
1. `foundryup`; scaffold `contracts/` alongside existing `contract/` (keep Soroban until parity is proven).
2. `forge install OpenZeppelin/openzeppelin-contracts`.
3. Fund 3 Fuji wallets via Builder Hub faucet.
4. Create `frontend/src/lib/chain.ts` pointing at `avalancheFuji`.

### Phase 1 — Contract (1.5–2 days)
5. Write `ScoutGridMarket.sol` per §2. Native AVAX, `ReentrancyGuard`, custom errors, `block.timestamp`, **§2.5 pool fix**, **§2.8 listed check**, drop `register_player`.
6. Port the 10 tests + add 5 EVM-specific ones (§4.1).
7. `forge test` green + solvency invariant holds.
8. Deploy to Fuji, verify on Snowtrace, record address.

### Phase 2 — Frontend data layer (1 day)
9. Swap deps (§3.1). Confirm `vite-plugin-node-polyfills` is droppable.
10. Generate `abi.ts` from `forge build`; wire ABI extraction into the build.
11. Rewrite `contract.ts` keeping all export names (§3.3).
12. `npx tsc --noEmit` green.

### Phase 3 — Wallet layer (0.5 day)
13. Rewrite `walletKit.ts` as wagmi config; add providers to `main.tsx`.
14. Rewrite `WalletModal.tsx` connector list + `handleSelect` (§3.6).
15. Add `switchChain` prompt for wrong-network users.

### Phase 4 — Sweeps & polish (0.5 day)
16. `TOKEN_SYMBOL` constant; replace 24 `XLM` strings.
17. Time-unit sweep in `LoanBadge.tsx`, `RepayModal.tsx`, `types.ts`.
18. Branding copy (§3.7c); Navbar faucet link; `demoConfig.ts` addresses.

### Phase 5 — Verify & ship (0.5–1 day)
19. Manual E2E on Fuji: register → mint → bid → accept → buyout → loan → repay → liquidate.
20. Update `ci.yml` for Foundry.
21. Re-capture Snowtrace + wallet screenshots.
22. README rewrite (§5.3).
23. Vercel deploy; delete `contract/` (Soroban) once parity is confirmed.

### Phase 6 — OPTIONAL: custom L1 (+2–3 days)
24. Work `academy/avalanche-l1/permissioned-l1s` (PoA + Validator Manager) and `academy/avalanche-l1/l1-native-tokenomics`.
25. `avalanche blockchain create scoutgrid` — Subnet-EVM, custom `SCOUT` gas token, **genesis-allocate demo wallet balances** (kills the faucet problem).
26. `avalanche blockchain deploy --fuji`; stand up an RPC endpoint.
27. Deploy the *identical* bytecode from step 8.
28. `chain.ts`: `avalancheFuji` → `defineChain({...})`; flip `TOKEN_SYMBOL` to `SCOUT`. **That's the whole frontend diff.**
29. Optional flex: ICM/Teleporter to bridge profile ownership to C-Chain (`academy/avalanche-l1/interchain-messaging`).

---

## 7. Decisions — LOCKED (2026-08-16)

Scope confirmed by project owner: **full migration to Avalanche. All Stellar/Soroban code is deleted, not kept side-by-side.** This is a fresh deployment — no on-chain state carries over.

| # | Decision | **LOCKED** | Rationale |
|---|----------|-----------|-----------|
| 1 | Target chain | **Fuji C-Chain first** | Bytecode is identical on Subnet-EVM, so nothing is wasted. Wallets and Snowtrace already exist. Custom L1 remains optional Phase 6 (§1 Option B) |
| 2 | Payment rail | **Native AVAX via `msg.value`** | One signature per action = 1:1 UX parity with XLM today. ERC20 would need `approve()` first — two signatures per bid (§2.1) |
| 3 | Pool bug fix (§2.5) | **Option (b) — pool absorbs the loss** | Delete the `pool += principal` credit in `liquidate()`. The principal genuinely left the contract in `takeLoan`; the admin holds the seized profile as compensation. One line, keeps the solvency invariant true |
| 4 | Profile strings | **Fully on-chain** | Preserves the "verified on-chain profile" pitch. Gas is negligible on faucet AVAX. Apply the caps from §2.6: `role` as `bytes32`, length-capped `bio`, max 10 achievements |
| 5 | Soroban contract | **Delete `contract/` after Fuji parity** | Git history preserves it. Keeping both doubles CI and muddies the pitch. Delete at step 23 |
| 6 | Wallet connectors | **Core · MetaMask · Rabby · WalletConnect** | Same 4-card modal layout as today — zero UI restructuring (§3.6) |

### Consequences of "delete all Stellar"

- `contract/` (Rust, `Cargo.toml`, `src/lib.rs`, `src/test.rs`, `test_snapshots/`) → removed at step 23.
- All three `@stellar/*` + `@creit.tech/*` deps removed from `package.json` (§3.1).
- README sections `## 🛡️ The Soroban Solution`, `## 🏗️ Stellar Features Used`, `## 💎 Why Stellar?` are rewritten from scratch, not find-replaced (§5.3).
- `frontend/ui_images/StellarExpert.png` deleted, replaced by a Snowtrace capture.
- The `contract` CI job is fully replaced by Foundry (§4.2) — no Rust toolchain remains.
- Existing testnet profiles are **not migrated**. Demo profiles must be re-minted on Fuji (§5.1).

---

## 8. Reference links

- [Avalanche L1 Academy](https://build.avax.network/academy) — course index
- [Permissioned L1s (PoA / Validator Manager)](https://build.avax.network/academy/avalanche-l1/permissioned-l1s)
- [L1 Native Tokenomics (custom gas token)](https://build.avax.network/academy/avalanche-l1/l1-native-tokenomics)
- [Interchain Messaging (ICM/Teleporter)](https://build.avax.network/academy/avalanche-l1/interchain-messaging)
- [Customizing the EVM (precompiles)](https://build.avax.network/academy/avalanche-l1/customizing-evm)
- [avalanche-sdk-typescript](https://github.com/ava-labs/avalanche-sdk-typescript) — `@avalanche-sdk/client` (viem-compatible), `@avalanche-sdk/chainkit` (Glacier data + metrics), `@avalanche-sdk/interchain` (ICM)
- [Customize an Avalanche L1](https://build.avax.network/docs/avalanche-l1s/upgrade/customize-avalanche-l1)
- Fuji: chainId `43113` · RPC `https://api.avax-test.network/ext/bc/C/rpc` · explorer `https://testnet.snowtrace.io` · faucet `https://core.app/tools/testnet-faucet`

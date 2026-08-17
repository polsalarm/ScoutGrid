# Avalanche Migration Checklist

Live status tracker for the Stellar → Avalanche migration. Full design rationale lives in [`AVALANCHE_MIGRATION_PLAN.md`](./AVALANCHE_MIGRATION_PLAN.md) — this file is just "what's done, what's not, what's next."

**Last updated:** 2026-08-16

---

## ✅ Done

### Contract (`contracts/`)
- [x] `ScoutGridMarket.sol` written — Solidity 0.8.26, native AVAX, all 6 locked decisions applied
- [x] Pool-accounting bug fixed (liquidation no longer double-counts principal — decision #3)
- [x] Loan-lock bid gap closed (`NotListed` guard on `placeBid`/`buyout` — §2.8)
- [x] `ReentrancyGuard` + checks-effects-interactions + pull-payment fallback on every value-transferring function
- [x] Foundry test suite: **16/16 passing** (10 ported + 6 new: reentrancy attack, pull-payment fallback, solvency fuzz, wrong-msg-value, excess-refund, loan-lock gate)
- [x] `forge fmt --check` clean
- [x] `script/Deploy.s.sol` deploy script written
- [x] **Full lifecycle validated live on local Anvil devnet** — register → mint → bid → accept → fund pool → take loan → repay (with overpayment refund) → liquidate after 30-day warp. Every balance matched hand-calculated numbers exactly.

### Frontend (`frontend/`)
- [x] Dependencies swapped — removed `@stellar/*`, `@creit.tech/stellar-wallets-kit`, `vite-plugin-node-polyfills`; added `viem`, `wagmi`, `@tanstack/react-query`, `valtio`
- [x] `chain.ts` created — single source of truth for Fuji config (swap point for a future custom L1)
- [x] `abi.ts` auto-generated from the Foundry build artifact
- [x] `contract.ts` fully rewritten on viem/wagmi actions (kept every old export name — call sites barely changed)
- [x] `walletKit.ts` rewritten as wagmi config with EIP-6963 auto-discovery (Core/MetaMask/Rabby detected automatically)
- [x] `WalletModal.tsx` rewritten — Core, MetaMask, Rabby, WalletConnect (same 4-card layout)
- [x] `Navbar.tsx` — dropped Stellar Friendbot funded-check, now uses wagmi's reactive `useAccount`
- [x] `RegisterModal.tsx` — removed HOT Wallet demo-mode special case
- [x] Ledger→time rename everywhere (`LOAN_DURATION_LEDGERS`→`LOAN_DURATION_SECONDS`, `startLedger`/`dueLedger`→`startTime`/`dueTime`)
- [x] `XLM` → `AVAX` sweep via a `TOKEN_SYMBOL` constant (BidModal, LoanModal, RepayModal, PlayerCard, MintModal, Achievements, MyRoster, LoanBadge)
- [x] Branding copy sweep (Soroban → Avalanche in AIChatbot, ai-service, Marketplace, WalletModal)
- [x] `demoConfig.ts` / `demoData.ts` — placeholder addresses converted from Stellar `G...` to valid EVM `0x...`
- [x] **Zero Stellar/Soroban/XLM references left in `frontend/src`** (verified by grep)
- [x] `tsc --noEmit` clean
- [x] `npm run build` succeeds

### CI / Repo hygiene
- [x] `.github/workflows/ci.yml` — Rust/Cargo job replaced with Foundry (`fmt --check` → `build --sizes` → `test -vvv`)
- [x] `contracts/.gitignore` added (build artifacts, `.env`)
- [x] `contracts/README.md` replaced (was Foundry's default boilerplate)

### Docs
- [x] `AVALANCHE_MIGRATION_PLAN.md` — full plan, all 6 decisions locked and recorded
- [x] `README.md` — full rewrite (not find-replace): badges, architecture, function tables, CI section, setup/deploy commands, real 16-test output, honest disclaimers on every stale screenshot/link

---

## ✅ Done (cont'd — deployment)

- [x] Funded a Fuji wallet (`0xB12df7d12d9c5d2B65FB878b5fF67a5f29F59A0c`, via the Builder Hub faucet)
- [x] Deployed `ScoutGridMarket.sol` to Fuji: **`0x82e197f69c3d57595f8E26E5a807E9223F3D9111`**
  - Tx: `0x57e179960f48f4b0e3034facadb09d02322edb1a587e5dccf77f218a26eef246`
  - Cost: ~0.0000000005 AVAX (negligible)
- [x] Verified source on Snowscan/Routescan — `foundry.toml`'s `[etherscan]` block now uses a hardcoded keyless placeholder so future deploys verify automatically without an API key
- [x] Wired the deployed address into `frontend/.env` as `VITE_CONTRACT_ADDRESS`
- [x] Rebuilt frontend against the live address — `tsc --noEmit` and `npm run build` both clean

## ⏳ Not done yet — next up

- [ ] Manual browser E2E pass against the live Fuji contract (connect wallet → register → mint → bid → buyout → loan → repay)
- [ ] Re-record demo video + re-capture screenshots (wallet picker, transaction confirmations, StellarExpert→Snowtrace explorer shot)
- [ ] Redeploy frontend to Vercel pointing at the live contract
- [ ] Delete `contract/` (old Soroban/Rust code) — **only after** the above is confirmed working; kept as a safety net until then
- [ ] (Optional, Phase 6) Custom Avalanche L1 with genesis-allocated gas token — see roadmap in the migration plan

---

## 👉 Next action

**You:** connect a wallet to the live site (locally via `npm run dev` in `frontend/`, or point your live Vercel deploy at the new `.env`) and run through the flow once as a sanity check.
**Me:** ready to redeploy to Vercel, re-capture screenshots, and clean up `contract/` once you confirm the E2E pass looks good.

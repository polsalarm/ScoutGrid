# ScoutGrid — Phase 2 Implementation Plan

> **Goal:** Meet all remaining submission requirements before final deadline.
> **Status:** Planning only — nothing implemented yet.

---

## 📋 Requirements Checklist

| # | Requirement | Status |
|---|---|---|
| 1 | Inter-contract call working (if applicable) | ⬜ Planned |
| 2 | Custom token or pool deployed (if used) | ⬜ Planned |
| 3 | CI/CD pipeline running | ⬜ Planned |
| 4 | Mobile responsive UI | ⬜ Planned |
| R1 | README: mobile responsive screenshot | ⬜ Planned |
| R2 | README: CI/CD badge or screenshot | ⬜ Planned |
| R3 | README: contract addresses + tx hash (inter-contract) | ⬜ Planned |
| R4 | README: token or pool address (if custom) | ⬜ Planned |

---

## 1. Inter-Contract Call

### What it means
The ScoutGrid marketplace contract (`CCB3PY3...`) currently handles all logic internally. An inter-contract call means the ScoutGrid contract explicitly invokes another deployed Soroban contract — typically the **Stellar Asset Contract (SAC)** for XLM transfers, or a separate **Lending Pool contract**.

### Current state
- The contract already calls the **Native XLM SAC** (`CDLZFC3...`) for `fund_pool`, `take_loan`, and `repay_loan` via `token.transfer(...)`. This IS an inter-contract call — it just isn't explicitly surfaced in the README.
- No separate lending pool contract exists yet — pool logic is inside the main contract.

### Plan
**Option A (Low effort):** Document the existing SAC inter-contract call in README with the tx hash. The `fund_pool` transaction already invokes the XLM SAC — this qualifies.

**Option B (High effort):** Extract the lending pool into a separate `ScoutPool` contract and have the main contract call it via `env.invoke_contract(...)`. Cleaner architecture but requires redeploy.

### Recommendation
Go with **Option A** for the deadline. Extract the `fund_pool` transaction hash from Stellar Explorer and add it to README as proof of inter-contract call.

**Tx to document:**
- `fund_pool` tx: `07ad4f59edc8b6d4a9ce1eb513c0c25b08f12bae77aa2a0d21a7be63fdfdf697`
- Calls: ScoutGrid contract → XLM SAC (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`) → `transfer()`

---

## 2. Custom Token or Pool

### Current state
- Uses **Native XLM** via the Stellar Asset Contract — no custom token.
- Lending pool is funded and live on the new contract with **5,000 XLM**.

### Plan
**Option A (Low effort):** Document the existing pool address and current balance in README. The lending pool is a real on-chain pool — its address is the contract itself.

**Option B (Medium effort):** Issue a custom **ScoutGrid Credit (SGC)** SEP-41 token using `stellar contract deploy` with the standard token WASM. Scouts earn SGC as rewards for funded loans. Adds a real custom token with its own contract address.

### Recommendation
**Option A** covers the requirement immediately. **Option B** can be added as a roadmap item if time allows.

**To document:**
- Pool Contract: `CCB3PY3PW6HYPLTXYT2EYVXW7TXBFDE6ALH3MSSWSKI4IZYO67JGQQED`
- Pool Balance: 5,000 XLM
- Token used: Native XLM via SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

---

## 3. CI/CD Pipeline

### Plan
Set up **GitHub Actions** — triggers on every push to `main`, runs:
1. TypeScript type check (`tsc --noEmit`)
2. ESLint (`npm run lint`)
3. Vite build (`npm run build`)
4. (Optional) Rust contract tests (`cargo test`)

### File to create
`.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npm run build
        working-directory: frontend

  contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown
      - run: cargo test
        working-directory: contract
```

### README additions needed
- Add CI badge: `![CI](https://github.com/polsalarm/ScoutGrid/actions/workflows/ci.yml/badge.svg)`
- Screenshot of passing Actions run

---

## 4. Mobile Responsive UI

### Current state
The app uses Tailwind CSS with responsive prefixes (`md:`, `lg:`, `xl:`) in grid layouts. Basic responsiveness exists but has not been tested or optimized for small screens.

### Known issues to fix
- **Navbar**: Connect button and IGN may overflow on small screens
- **Marketplace grid**: `grid-cols-1` on mobile is set — should be correct
- **PlayerCard**: Fixed widths or padding may break on 375px screens
- **Modals**: `max-w-sm` modals should be fine but need `mx-4` padding check
- **MyRoster**: Stats grid may overflow horizontally
- **Nova chatbot**: Floating button position needs `bottom-4 right-4` check on mobile

### Plan
1. Test on Chrome DevTools at 375px (iPhone SE) and 390px (iPhone 14)
2. Fix any overflow/truncation issues with Tailwind responsive classes
3. Take screenshot at mobile viewport for README

### README additions needed
- Add screenshot: `frontend/ui_images/Mobile_Marketplace.png`
- Add screenshot: `frontend/ui_images/Mobile_Roster.png`

---

## 📄 README Additions Summary

When each item above is complete, add the following to README:

```markdown
## ✅ Phase 2 — Technical Requirements

### CI/CD
![CI](https://github.com/polsalarm/ScoutGrid/actions/workflows/ci.yml/badge.svg)
[View latest run →](https://github.com/polsalarm/ScoutGrid/actions)

### Inter-Contract Call
ScoutGrid invokes the native XLM Stellar Asset Contract during pool funding and loan disbursement.
- Calling contract: `CCB3PY3PW6HYPLTXYT2EYVXW7TXBFDE6ALH3MSSWSKI4IZYO67JGQQED`
- Called contract (XLM SAC): `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Example tx: [07ad4f59...](https://stellar.expert/explorer/testnet/tx/07ad4f59edc8b6d4a9ce1eb513c0c25b08f12bae77aa2a0d21a7be63fdfdf697)

### Lending Pool
- Pool address: `CCB3PY3PW6HYPLTXYT2EYVXW7TXBFDE6ALH3MSSWSKI4IZYO67JGQQED`
- Token: Native XLM via SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Funded balance: 5,000 XLM

### Mobile Responsive
| Marketplace (Mobile) | My Roster (Mobile) |
| :---: | :---: |
| ![Mobile Marketplace](./frontend/ui_images/Mobile_Marketplace.png) | ![Mobile Roster](./frontend/ui_images/Mobile_Roster.png) |
```

---

## 🔢 Implementation Order

| Step | Task | Effort | Who |
|---|---|---|---|
| 1 | Set up `.github/workflows/ci.yml` | 15 min | Claude |
| 2 | Fix mobile responsive issues | 30–60 min | Claude |
| 3 | Take mobile screenshots | 5 min | You |
| 4 | Document inter-contract call in README | 10 min | Claude |
| 5 | Document pool address in README | 5 min | Claude |
| 6 | Add CI badge + screenshot to README | 5 min | Claude |

**Total estimate: ~2 hours end-to-end**

---

> Say "do step 1", "do step 2" etc. to execute each item when ready.

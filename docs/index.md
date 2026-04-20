# ScoutGrid Documentation

A running record of features added, updated, or refactored across the project.

---

## Table of Contents

| Document | Area | Status |
|---|---|---|
| [multi-wallet.md](./multi-wallet.md) | Frontend — Wallet Integration | ✅ Done |
| [contract-client.md](./contract-client.md) | Frontend — Soroban Contract Client | ✅ Done |
| [store.md](./store.md) | Frontend — Global State (Zustand) | ✅ Done |

---

## Project Structure

```
ScoutGrid/
├── contract/          # Soroban smart contract (Rust)
├── frontend/          # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── layout/    Navbar
│       │   └── ui/        BidModal, WalletModal, PlayerCard, …
│       ├── lib/           store, contract client, walletKit, ai-service
│       └── pages/         Marketplace, MyRoster, Achievements
└── docs/              # This folder
```

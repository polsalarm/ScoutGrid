# ⚡ ScoutGrid

> **The Decentralized Grid for Pro-Scouts.** Trustless talent acquisition, on-chain verified profiles, and AI-driven market intelligence on the Soroban blockchain.

![Static Badge](https://img.shields.io/badge/Blockchain-Stellar_Soroban-black?style=for-the-badge&logo=stellar)
![Static Badge](https://img.shields.io/badge/Frontend-React_Vite-61DAFB?style=for-the-badge&logo=react)
![Static Badge](https://img.shields.io/badge/Intelligence-Gemini_AI-4285F4?style=for-the-badge&logo=googlegemini)
![Static Badge](https://img.shields.io/badge/Network-Testnet-green?style=for-the-badge)

---

## 🌪️ The Problem
Esports scouting is currently broken. Data is siloed in private spreadsheets, talent contracts are opaque, and the transfer of pro-players often involves payment disputes and long delays. Scouts have no way to verify a player's true market value or track their historical performance win-points (WP) in a tamper-proof way.

## 🛡️ The Soroban Solution
ScoutGrid leverages the **Stellar (Soroban)** blockchain to create a high-performance, transparent marketplace for professional gaming talent.
- **On-Chain Profiles**: Every player is a unique contract entry, storing WP, roles, and verified achievements directly on the ledger.
- **Atomic Escrow**: Bidding and Buyouts are handled by trustless smart contracts. Funds are only transferred when ownership is secured.
- **Royalty Enforcement**: Contract transfers include automated royalty logic (e.g., 10% to the original scout/agency) enforced at the protocol level.
- **AI-Advisor (Nova)**: A Gemini-powered intelligence layer that scans the live blockchain registry to give scouts real-time tactical advice.

---

## 🚀 Core Functions & Features
- **The Marketplace**: A real-time grid to browse, bid on, or buyout pro-gaming contracts.
- **The Roster (Dossier)**: Personal collection management. Track your "Secured Contracts" and "Active Offers."
- **Win-Point (WP) System**: On-chain reputation tracking that increases based on verified tournament performance.
- **Nova AI Advisor**: Interrogate a high-performance AI that knows every contract on the grid to find undervalued talent.
- **Minting Terminal**: Agency tools to deploy new pro-profiles directly to the network.

---

## 📂 Project Structure

```text
ScoutGrid/
├── src/                        # 🦀 Smart Contract Source (Soroban)
│   ├── lib.rs                  # Core Marketplace Logic & Functions
│   └── test.rs                 # Security & Escrow Test Suite
├── frontend/                   # ⚛️ Web3 Interface (React/Vite)
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/             # Tactical UI Components
│   │   │       ├── AIChatbot.tsx   # Nova Command Center (Gemini AI)
│   │   │       ├── PlayerCard.tsx  # Marketplace Contract Display
│   │   │       ├── MintModal.tsx   # Asset Deployment Terminal
│   │   │       └── Navbar.tsx      # Terminal Navigation
│   │   ├── lib/                # Core Application Logic
│   │   │   ├── ai-service.ts   # Gemini AI Integration & Prompting
│   │   │   ├── contract.ts     # Soroban Universal Sync Engine
│   │   │   ├── store.ts        # Zustand On-Chain State Management
│   │   │   └── mock-data.ts    # Extended Talent Metadata
│   │   ├── pages/              # View Layers
│   │   │   ├── Marketplace.tsx # Public Talent Grid
│   │   │   └── MyRoster.tsx    # Personal Secured Dossiers
│   │   └── index.css           # Cyber-Neon Tailwind Styling
├── Cargo.toml                  # Rust Dependency Management
└── README.md                   # Professional Technical Dossier
```

---

## 🏗️ Architecture

```text
Browser (React + Vite)
 |-- Freighter Wallet API     (Transaction signing & Identity)
 |-- @stellar/stellar-sdk     (Transaction building & RPC interaction)
 |-- Universal Sync Engine    (On-chain state management via Zustand)
 |-- Gemini AI SDK            (Intelligence layer & Tactical analysis)

Stellar Testnet
 |-- ScoutGrid Soroban Contract (Marketplace logic, Escrows, Royalties)
 |-- Stellar Asset Contract     (SEP-41 Native XLM payments)
```

> **Zero Backend Requirement**: ScoutGrid has no centralized database. All escrow states, royalties, and win-points live natively on-chain. The Universal Sync Engine mirrors the ledger state for real-time UI updates.

---

## 🛠️ System Components
- **"Global Registry"**: A single-source-of-truth registry maintained on the Soroban ledger, ensuring all scouts see the same talent data instantly.
- **Universal Sync Engine**: A high-performance convergence engine on the frontend that parallelizes on-chain registry fetches with local metadata enrichment.
- **Contract Hardening**: Robust Rust-based logic with exhaustive checks for ownership, bid validity, and state protection.
- **Blockchain-First State**: All roster and marketplace updates hit the on-chain registry first, ensuring changes are visible to all browsers globally with zero stale state.

### Implementation Details:
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS (Cyberpunk/Glassmorphism UI).
- **Smart Contracts**: Soroban (Rust SDK) deployed on Stellar Testnet.
- **Wallet Integration**: @stellar/freighter-api for secure transaction signing.
- **AI Layer**: Google Gemini 1.5 Flash for market analysis and natural language queries.
- **State Management**: Zustand for high-performance, real-time marketplace syncing.

---

## 📜 Smart Contract Interface
ScoutGrid exposes a comprehensive set of **15 exported functions**, providing a robust API for talent management and marketplace interaction:

- `accept_bid`: Finalizes a contract transfer to the highest bidder.
- `add_win_point`: Verified increment of a player's Win Point (WP) reputation.
- `buyout`: Instant purchase of a contract at the listed price.
- `get_all_market_items`: Retrieves the full public marketplace registry.
- `get_all_player_addresses`: Utility to scan every profile on the grid.
- `get_current_bid`: Real-time fetch of the top offer for a specific asset.
- `get_owned_assets`: Retrieves personal dossiers for owners (including unlisted items).
- `get_profile`: Detailed fetch of a player's on-chain stats and metadata.
- `get_username`: Resolve account addresses to scout identifiers.
- `init`: Bootstraps the grid with administrative roles and tokens.
- `mint_player_profile`: Deploys a new pro-talent profile to the blockchain.
- `place_bid`: Escrows a purchase offer for a pro-contract.
- `register_player`: Initializes the data structure for a talent profile.
- `register_user`: Onboards a new scout to the ScoutGrid ecosystem.
- `set_admin`: Secure role management for grid maintenance.

---

## 📦 Prerequisites
- **Node.js**: v18+ 
- **Stellar CLI**: To interact with the smart contracts (`cargo install --locked stellar-cli`).
- **Freighter Wallet**: Browser extension configured for **Stellar Testnet**.
- **Testnet XLM**: Obtain from the [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=testnet).

---

## 📜 Smart Contract Setup & Testing
The core logic resides in `src/lib.rs`.

1. **Install Dependencies**:
   ```bash
   # In the root directory
   rustup target add wasm32-unknown-unknown
   ```

2. **Build the Contract**:
   ```bash
   stellar contract build
   ```

3. **Run Tests**:
   ```bash
   cargo test
   ```
   *Our test suite covers: Buyout logic validation, Bid price protection, and Ownership transfer security.*

4. **Deploy (Testnet)**:
   ```bash
   stellar contract deploy \
     --wasm target/wasm32-unknown-unknown/release/scout_grid.wasm \
     --source <YOUR_ACCOUNT> \
     --network testnet
   ```

---

## 💻 Frontend Local Setup

1. **Clone & Install**:
   ```bash
   cd frontend
   npm install
   ```

2. **Configuration**:
   ScoutGrid uses centralized configuration files for the hackathon phase. To change the network state, update the following files:
   - **Contract ID**: `frontend/src/lib/contract.ts`
   - **AI API Key**: `frontend/src/lib/ai-service.ts`

   *Note: For production deployments, it is recommended to transition these constants to a `.env` file.*

3. **Run Locally**:
   ```bash
   npm run dev
   ```

---

## 📍 Deployment & Contract Addresses

| Layer | Environment | Address |
| :--- | :--- | :--- |
| **Marketplace Contract** | Stellar Testnet | `CBJKAS62XBI54L4BTMLUVTWZGBJJMM23GYMN2UPZHATY4WOIPVYV74U6` |
| **Admin/Factory Account** | Stellar Testnet | `GCF4N2ZDIGVYGSXUT7XCUBR3WHPT2FYTIADXUODQZ57MOWX6USIEW2CY` |
| **Native Asset (XLM)** | Stellar Testnet | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

---

## 🧱 Challenges Faced
- **Contract Data Enrichment**: Soroban maps are heavy on gas. We overcame this by implementing a **Unified Sync Engine** on the frontend that merges on-chain ownership data with off-chain static metadata (player bios/stats) for a seamless UI experience.
- **Real-Time Consistency**: Syncing bidding states across multiple scouts (browsers) required a high-performance polling architecture to ensure no "front-running" of manual buyouts.

---

## 🔮 Future Roadmap
- **[ ] Player Dashboard**: A dedicated view for players to verify their own stats and upload achievements.
- **[ ] DAO Governance**: Allow top scouts (highest WP) to vote on tournament verification and WP multipliers.
- **[ ] IPFS Integration**: Storing player high-resolution assets and tournament clips.
- **[ ] Mobile Dossier**: A lightweight mobile app for scouts on-the-go.

---

*Built for the **Stellar Global Hackathon.** Let's build the future of pro-talent on the grid.* ⚡

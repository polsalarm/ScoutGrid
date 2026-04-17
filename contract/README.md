# ScoutGrid Contract
- **Description:** The core Soroban smart contract for the ScoutGrid decentralized pro-scouting marketplace. Handles atomic escrows, win-point tracking, and automated royalties on the Stellar blockchain.

## Deployed Contract
- **Contract ID:** `CBJKAS62XBI54L4BTMLUVTWZGBJJMM23GYMN2UPZHATY4WOIPVYV74U6`
- **Network:** Stellar Testnet
- **Deploy TX:** `e3cae833afdf4d05f136844e05e0e33c2e1b4f9454e9939df812d220e4620d57`
- **Explorer:** [StellarExpert Link](https://stellar.expert/explorer/testnet/contract/CBJKAS62XBI54L4BTMLUVTWZGBJJMM23GYMN2UPZHATY4WOIPVYV74U6)

![StellarExpert Explorer](../frontend/ui_images/StellarExpert.png)

## CONTRACT FUNCTIONS

| Function | Description |
|---|---|
| `mint_player_profile` | Deploys a new pro-talent profile to the blockchain. |
| `place_bid` | Escrows a purchase offer for a pro-contract. |
| `accept_bid` | Finalizes the contract transfer to the highest bidder. |
| `buyout` | Instant purchase of a contract at the listed price. |
| `register_player` | Initializes the data structure for a talent profile. |
| `register_user` | Onboards a new scout to the ScoutGrid ecosystem. |
| `get_profile` | Detailed fetch of a player's on-chain stats and metadata. |
| `get_owned_assets` | Retrieves personal dossiers (including unlisted items). |
| `get_all_market_items` | Retrieves the full public marketplace registry. |
| `get_all_player_addresses` | Utility to scan every active profile on the grid. |
| `get_current_bid` | Real-time fetch of the top offer for a specific asset. |
| `get_username` | Resolve account addresses to scout identifiers. |
| `add_win_point` | Verified increment of a player's Win Point (WP) reputation. |
| `init` | Bootstraps the grid with administrative roles and tokens. |
| `set_admin` | Secure role management for grid maintenance. |

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli)

```bash
# Install Rust wasm target
rustup target add wasm32-unknown-unknown

# Install Stellar CLI
cargo install --locked stellar-cli --features opt
```

## Build
```bash
cd contract
stellar contract build
```
**Output:**
`target/wasm32-unknown-unknown/release/scout_grid.wasm`

## Test
```bash
cd contract
cargo test
```

## Deploy to Testnet

```bash
# 1. Generate a keypair (if you don't have one)
stellar keys generate --global deployer --network testnet

# 2. Fund it via Friendbot
stellar keys fund deployer --network testnet

# 3. Deploy the contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/scout_grid.wasm \
  --source deployer \
  --network testnet

# 4. Invoke a function (example)
stellar contract invoke \
  --id CBJKAS62XBI54L4BTMLUVTWZGBJJMM23GYMN2UPZHATY4WOIPVYV74U6 \
  --source deployer \
  --network testnet \
  -- get_all_market_items
```

## Frontend Integration

The contract is called from `frontend/src/lib/contract.ts`. The Universal Sync Engine and transaction builders expose the following core hooks:

**Write Operations (Requires Wallet Signature)**
- `registerUser()` - Verification flow; claims an in-game name (IGN) on-chain.
- `mintPlayerProfile()` - Agency tool; deploys a structured pro-profile to the grid.
- `placeBid()` - Escrows XLM into the protocol to secure a contract offer.
- `acceptBid()` - Allows the owner to finalize a contract transfer to the highest bidder.
- `buyout()` - Executes an atomic instant-purchase at the listed buyout price.

**Read Operations (Simulated / Free)**
- `syncGlobalMarket()` - High-performance polling; reads the entire public registry state.
- `syncFullRegistry()` - Converges both the global market and the user's private 'My Roster' assets.
- `getProfile()` - Deep fetch of on-chain metadata (WinPoints, achievements) for a specific address.
- `getCurrentBid()` - Resolves the top active escrow offer for a player.
- `getUsername()` - Resolves an address to an on-chain IGN.

# ScoutGrid Contracts (Avalanche)

Solidity port of ScoutGrid's marketplace + collateral-loan contract, targeting
Avalanche Fuji C-Chain. See [`ScoutGridMarket.sol`](src/ScoutGridMarket.sol)
and the migration plan at the repo root (`AVALANCHE_MIGRATION_PLAN.md`).

Built with [Foundry](https://book.getfoundry.sh/).

## Build & test

```shell
forge build
forge test -vv
```

## Deploy to Fuji

```shell
export PRIVATE_KEY=0x...          # deployer key — becomes admin unless ADMIN_ADDRESS is set
forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify -vvvv
```

Fund the deployer first: https://core.app/tools/testnet-faucet

After deploying, copy the printed contract address into
`frontend/.env` as `VITE_CONTRACT_ADDRESS`, and regenerate the frontend ABI:

```shell
node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('out/ScoutGridMarket.sol/ScoutGridMarket.json', 'utf8'));
const header = '// AUTO-GENERATED from contracts/out/ScoutGridMarket.sol/ScoutGridMarket.json\n' +
  '// Regenerate: forge build (in contracts/) then re-run this script.\n' +
  '// Do not hand-edit — changes will be overwritten on the next contract build.\n\n';
const body = 'export const SCOUTGRID_ABI = ' + JSON.stringify(j.abi, null, 2) + ' as const;\n';
fs.writeFileSync('../frontend/src/lib/abi.ts', header + body);
"
```

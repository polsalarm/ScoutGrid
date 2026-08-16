// DEMO REMOVE — Fuji testnet addresses for end-to-end demo recording
// BORROWER_ADDRESS: connects in browser, owns players, calls takeLoan / repayLoan
// POOL_FUNDER_ADDRESS: funded the lending pool so AVAX is available to borrow
//
// PLACEHOLDER — replace with real funded Fuji addresses before recording a
// demo (fund via https://core.app/tools/testnet-faucet).

export const DEMO_CONFIG = {
  BORROWER_ADDRESS: '0x00000000000000000000000000000000000dEaD0',
  POOL_FUNDER_ADDRESS: '0x000000000000000000000000000000000000cafe',
} as const;

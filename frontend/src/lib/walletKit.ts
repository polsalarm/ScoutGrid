import { createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { ACTIVE_CHAIN, WALLETCONNECT_PROJECT_ID } from './chain';

// Core, MetaMask, and Rabby all announce themselves via EIP-6963
// (multiInjectedProviderDiscovery, on by default below), so wagmi registers
// one connector per detected extension automatically — no per-wallet target
// strings needed. `injected()` is kept as a generic fallback for any
// EIP-1193 wallet that predates EIP-6963. WalletModal matches by name.
export const WALLETCONNECT_ID = 'walletConnect';

export const wagmiConfig = createConfig({
  chains: [ACTIVE_CHAIN],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    walletConnect({ projectId: WALLETCONNECT_PROJECT_ID, showQrModal: true }),
  ],
  transports: {
    [ACTIVE_CHAIN.id]: http(),
  },
});

/** Finds an EIP-6963-announced connector by (case-insensitive) name substring. */
export function findConnectorByName(nameSubstring: string) {
  return wagmiConfig.connectors.find((c) =>
    c.name.toLowerCase().includes(nameSubstring.toLowerCase())
  );
}


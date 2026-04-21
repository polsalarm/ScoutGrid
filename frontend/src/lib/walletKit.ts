import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule, ALBEDO_ID } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { xBullModule, XBULL_ID } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { LedgerModule, LEDGER_ID } from '@creit.tech/stellar-wallets-kit/modules/ledger';

export { StellarWalletsKit, Networks, FREIGHTER_ID, ALBEDO_ID, XBULL_ID, LEDGER_ID };

StellarWalletsKit.init({
  network: Networks.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: [
    new FreighterModule(),
    new AlbedoModule(),
    new xBullModule(),
    new LedgerModule(),
  ],
});

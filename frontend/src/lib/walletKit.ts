import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule, ALBEDO_ID } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { xBullModule, XBULL_ID } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { HotWalletModule, HOTWALLET_ID } from '@creit.tech/stellar-wallets-kit/modules/hotwallet';

export { StellarWalletsKit, Networks, FREIGHTER_ID, ALBEDO_ID, XBULL_ID, HOTWALLET_ID };

StellarWalletsKit.init({
  network: Networks.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: [
    new FreighterModule(),
    new AlbedoModule(),
    new xBullModule(),
    new HotWalletModule(),
  ],
});

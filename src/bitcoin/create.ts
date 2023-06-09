import BIP32Factory from 'bip32';
import { initEccLib } from 'bitcoinjs-lib';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { mnemonicToSeedSync } from 'bip39';

export const NETWORK = true ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
export const TESTNET_DERIV_PATH = "m/86'/1'/0'/0/0";
export const MAINNET_DERIV_PATH = "m/86'/0'/0'/0/0";
 
export const mnemonicToTaprootPrivateKey = async (mnemonic: string, testnet?) => {
  const bip32 = BIP32Factory(ecc);
  initEccLib(ecc);

  const seed = mnemonicToSeedSync(mnemonic);
  const rootKey = await bip32.fromSeed(
    seed,
    testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
  );
  const derivePath = testnet ? TESTNET_DERIV_PATH : MAINNET_DERIV_PATH;
  const taprootChild = rootKey.derivePath(derivePath);

  const privateKey = taprootChild.privateKey!;
  return privateKey;
};

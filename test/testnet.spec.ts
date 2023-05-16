import * as bitcoin from 'bitcoinjs-lib';
import { assert } from 'chai';
import BIP32Factory from 'bip32';
import { initEccLib } from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import * as bip39 from 'bip39';
import { generateTaprootKeyPair, setBTCNetwork, NetworkType } from '../src/index';

const bip32 = BIP32Factory(ecc);
initEccLib(ecc);

export const NETWORK = true ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
export const DEFAULT_DERIV_PATH = "m/86'/1'/0'/0/0";

const TEST_MNE_1 =
  'open jelly jeans corn ketchup supreme brief element armed lens vault weather original scissors rug priority vicious lesson raven spot gossip powder person volcano';

describe('Sign msg Tx', async () => {
  it('create signed raw tc tx', async () => {
    const seed = bip39.mnemonicToSeedSync(TEST_MNE_1);
    const rootKey = await bip32.fromSeed(seed, NETWORK);
    const taprootChild = rootKey.derivePath(DEFAULT_DERIV_PATH);

    const privateKey = taprootChild.privateKey!;
    setBTCNetwork(NetworkType.Testnet);

    const { senderAddress } = generateTaprootKeyPair(privateKey);

    assert(senderAddress == 'tb1p5hwep2dna6wjhk6atjh0uyjmmp095y2arz3z32c9udmde7qrgwrseypr8x');
    return false;
  });
});

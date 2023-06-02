import * as bitcoin from 'bitcoinjs-lib';
import { assert } from 'chai';
import BIP32Factory from 'bip32';
import { initEccLib } from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import * as bip39 from 'bip39';
import {
  generateTaprootKeyPair,
  setBTCNetwork,
  NetworkType,
  createTx,
  Inscription,
  getBTCBalance,
  UTXO,
  ICreateTxResp,
  mnemonicToTaprootPrivateKey,
  createInscribeTx,
} from '../src/index';
import BigNumber from 'bignumber.js';
import { getAllUnspentTransactions_mempool } from '../src/bitcoin/btc';

const bip32 = BIP32Factory(ecc);
initEccLib(ecc);

export const NETWORK = true ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
export const TESTNET_DERIV_PATH = "m/86'/1'/0'/0/0";
export const MAINNET_DERIV_PATH = "m/86'/0'/0'/0/0";
const TEST_MNE_1 =
  'open jelly jeans corn ketchup supreme brief element armed lens vault weather original scissors rug priority vicious lesson raven spot gossip powder person volcano';

describe('Create Inscription', async () => {
  it('create inscription', async () => {
    const utxos = await getAllUnspentTransactions_mempool(
      'tb1p5hwep2dna6wjhk6atjh0uyjmmp095y2arz3z32c9udmde7qrgwrseypr8x',
      'BTC_TAPROOT'
    );
    const parsedUtxos =
      utxos?.length > 0
        ? utxos?.map((utxo: any) => ({
            tx_hash: utxo.hash,
            tx_output_n: utxo.index,
            value: new BigNumber(utxo.value), // normal
          }))
        : [];
    console.log(parsedUtxos, 'parsedUtxos');

    let inscriptions: { [key: string]: Inscription[] } = {
      '68fb52991055475d22516b13ff3381f6a244f006d8fc68f631da329473b26ea6:0': [
        {
          id: '68fb52991055475d22516b13ff3381f6a244f006d8fc68f631da329473b26ea6i0',
          offset: new BigNumber(0),
        },
      ],
    };
    const respo = await createInscribeTx({
      senderMnemonic: TEST_MNE_1,
      senderAddress: 'tb1p5hwep2dna6wjhk6atjh0uyjmmp095y2arz3z32c9udmde7qrgwrseypr8x',
      utxos: parsedUtxos,
      inscriptions: inscriptions,
      feeRatePerByte: 7,
      data: 'test',
      isTestNet: true
    });

    console.log(respo, 'respo');
  });
});

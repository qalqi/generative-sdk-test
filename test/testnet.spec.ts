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
} from '../src/index';
import axios from 'axios';
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
    return;

    const utxos = await getAllUnspentTransactions_mempool(
      'bc1plsexaxcakavpp7wxtu40qg757q5jk8wwvmk8wzm5cw0g0hyxrx8qkauxdm',
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

    //console.log(respo, 'respo');
  });
});

describe('Sign msg Tx', async () => {
  it('create signed raw tc tx', async () => {
    return;
    const isTestNet = true;
    const privateKey = await mnemonicToTaprootPrivateKey(TEST_MNE_1, isTestNet);
    setBTCNetwork(isTestNet ? NetworkType.Testnet : NetworkType.Mainnet);

    const { senderAddress, keyPair } = generateTaprootKeyPair(privateKey);

    assert(senderAddress == 'tb1p5hwep2dna6wjhk6atjh0uyjmmp095y2arz3z32c9udmde7qrgwrseypr8x');

    const utxos = await getUtxos(senderAddress);
    const parsedUtxos =
      utxos?.length > 0
        ? utxos?.map((utxo: any) => ({
            tx_hash: utxo.txid,
            tx_output_n: utxo.vout,
            value: new BigNumber(utxo.value), // normal
          }))
        : [];

    let inscriptions: { [key: string]: Inscription[] } = {
      '68fb52991055475d22516b13ff3381f6a244f006d8fc68f631da329473b26ea6:0': [
        {
          id: '68fb52991055475d22516b13ff3381f6a244f006d8fc68f631da329473b26ea6i0',
          offset: new BigNumber(0),
        },
      ],
    };
    const overallBalance = await getBalance(senderAddress);
    const cardinalBalance = await getBTCBalance({ utxos: parsedUtxos, inscriptions });
    console.log(overallBalance, 'overallBalance', cardinalBalance.toNumber(), 'cardinalBalance');

    const response = await createTx(
      privateKey,
      parsedUtxos,
      inscriptions,
      undefined,
      senderAddress,
      new BigNumber(1234),
      7
    );
    assert(response.selectedUTXOs.length == 1);

    const broadcastTxn_mempool = async (rawTransaction) => {
      const apiUrl = 'https://mempool.space/testnet/api/tx';
      let serverRes = { hash: '', error: false, errorMessage: '' };

      try {
        const { data } = await axios.post<string>(apiUrl, rawTransaction);
        serverRes.hash = data;
        return serverRes;
      } catch (error) {
        console.error(error);
        serverRes.error = true;
        serverRes.errorMessage = error.message;
        return serverRes;
      }
    };
    //console.log(response, 'response');
    //const broadcasted = await broadcastTxn_mempool(response.txHex);
    //console.log(broadcasted, 'broadcasted');
    /* 
    const sendOrdinal = await createTx(
      privateKey,
      parsedUtxos,
      inscriptions,
      '68fb52991055475d22516b13ff3381f6a244f006d8fc68f631da329473b26ea6i0',
      'tb1p5hwep2dna6wjhk6atjh0uyjmmp095y2arz3z32c9udmde7qrgwrseypr8x',
      new BigNumber(0),
      7,
      false
    ); */
    //console.log('sendOrdinal', sendOrdinal, sendOrdinal.fee.toNumber());
    return false;
  });
});

export const getUtxos = async (address: string) => {
  //curl -sSL "https://mempool.space/testnet/api/address/tb1q4kgratttzjvkxfmgd95z54qcq7y6hekdm3w56u/utxo"
  let utxos = [];
  await axios.get(`https://mempool.space/api/address/${address}/utxo`).then((res) => {
    utxos = res.data;
  });
  return utxos;
};

export const getBalance = async (address: string) => {
  /*

curl -sSL "https://mempool.space/api/address/1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv"

{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 15007599040,
    spent_txo_count: 5,
    spent_txo_sum: 15007599040,
    tx_count: 7
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}
balance = 51546
*/
  let balance = 0;
  await axios
    .get(`https://mempool.space/testnet/api/address/${address}`)
    .then((res) => {
      balance = res.data.chain_stats.funded_txo_sum - res.data.chain_stats.spent_txo_sum;
    })
    .catch((err) => {
      console.log(err);
    });
  return balance;
};

/**
 * createTx creates the Bitcoin transaction (including sending inscriptions).
 * NOTE: Currently, the function only supports sending from Taproot address.
 * @param mnemonic string mnemonic of the sender
 * @param utxos list of utxos (include non-inscription and inscription utxos)
 * @param inscriptions list of inscription infos of the sender
 * @param sendInscriptionID id of inscription to send
 * @param receiverInsAddress the address of the inscription receiver
 * @param sendAmount satoshi amount need to send
 * @param feeRatePerByte fee rate per byte (in satoshi)
 * @param isUseInscriptionPayFee flag defines using inscription coin to pay fee
 * @returns the transaction id
 * @returns the hex signed transaction
 * @returns the network fee
 */
export const createTransaction_BTC_TAPROOT = async (
  mnemonic: string,
  utxos: UTXO[],
  inscriptions: { [key: string]: Inscription[] },
  sendInscriptionID = '',
  receiverInsAddress: string,
  sendAmount: BigNumber,
  feeRatePerByte: number,
  isUseInscriptionPayFeeParam = true // default is true
): Promise<ICreateTxResp> => {
  const privateKey = await mnemonicToTaprootPrivateKey(mnemonic);

  const response = await createTx(
    privateKey,
    utxos,
    inscriptions,
    sendInscriptionID,
    receiverInsAddress,
    sendAmount,
    feeRatePerByte,
    isUseInscriptionPayFeeParam
  );
  return response;
};

describe('btc api tests', async () => {
  it('get utxos', async () => {
    return;
    const rawInscriptions = [
      {
        content: '/content/96dc5ca729e309e07f85077096fed830e5bd8968a64af01b4488e4d9fdb54777i0',
        'content length': '52641 bytes',
        'content type': 'image/jpeg',
        content_length: '52641 bytes',
        content_type: 'image/jpeg',
        'genesis fee': '214496',
        'genesis height': '/block/781126',
        'genesis transaction':
          '/tx/96dc5ca729e309e07f85077096fed830e5bd8968a64af01b4488e4d9fdb54777',
        genesis_fee: '214496',
        genesis_height: '/block/781126',
        genesis_transaction: '/tx/96dc5ca729e309e07f85077096fed830e5bd8968a64af01b4488e4d9fdb54777',
        id: '96dc5ca729e309e07f85077096fed830e5bd8968a64af01b4488e4d9fdb54777i0',
        inscription_number: 491931,
        location: '0c45281ea5ea490f07438748190c866d07d168d6db762322a2e2472a02ffe05c:1:0',
        offset: '0',
        output: '/output/0c45281ea5ea490f07438748190c866d07d168d6db762322a2e2472a02ffe05c:1',
        'output value': '10862',
        output_value: '10862',
        preview: '/preview/96dc5ca729e309e07f85077096fed830e5bd8968a64af01b4488e4d9fdb54777i0',
        sat: '/sat/1590821508792442',
        timestamp: '2023-03-17 00:28:21 UTC',
        title: 'Inscription 491931',
      },
      {
        content: '/content/509c932b2c9121c5bb8745194b6d7be00f83eddad4ba6fcfb5d56038a21f87bai0',
        'content length': '68 bytes',
        'content type': 'text/plain;charset=utf-8',
        content_length: '68 bytes',
        content_type: 'text/plain;charset=utf-8',
        'genesis fee': '14476',
        'genesis height': '/block/790759',
        'genesis transaction':
          '/tx/509c932b2c9121c5bb8745194b6d7be00f83eddad4ba6fcfb5d56038a21f87ba',
        genesis_fee: '14476',
        genesis_height: '/block/790759',
        genesis_transaction: '/tx/509c932b2c9121c5bb8745194b6d7be00f83eddad4ba6fcfb5d56038a21f87ba',
        id: '509c932b2c9121c5bb8745194b6d7be00f83eddad4ba6fcfb5d56038a21f87bai0',
        inscription_number: 8356818,
        location: '509c932b2c9121c5bb8745194b6d7be00f83eddad4ba6fcfb5d56038a21f87ba:0:0',
        offset: '0',
        output: '/output/509c932b2c9121c5bb8745194b6d7be00f83eddad4ba6fcfb5d56038a21f87ba:0',
        'output value': '546',
        output_value: '546',
        preview: '/preview/509c932b2c9121c5bb8745194b6d7be00f83eddad4ba6fcfb5d56038a21f87bai0',
        sat: '/sat/1598999642888623',
        timestamp: '2023-05-21 16:09:49 UTC',
        title: 'Inscription 8356818',
      },
      {
        content: '/content/89976ceeac31e1d8e3d6a19e25cb00d6a97c47d1cb3d9e7ff02579d75e838713i0',
        'content length': '50 bytes',
        'content type': 'text/plain;charset=utf-8',
        content_length: '50 bytes',
        content_type: 'text/plain;charset=utf-8',
        'genesis fee': '25080',
        'genesis height': '/block/790762',
        'genesis transaction':
          '/tx/89976ceeac31e1d8e3d6a19e25cb00d6a97c47d1cb3d9e7ff02579d75e838713',
        genesis_fee: '25080',
        genesis_height: '/block/790762',
        genesis_transaction: '/tx/89976ceeac31e1d8e3d6a19e25cb00d6a97c47d1cb3d9e7ff02579d75e838713',
        id: '89976ceeac31e1d8e3d6a19e25cb00d6a97c47d1cb3d9e7ff02579d75e838713i0',
        inscription_number: 8360901,
        location: '89976ceeac31e1d8e3d6a19e25cb00d6a97c47d1cb3d9e7ff02579d75e838713:0:0',
        offset: '0',
        output: '/output/89976ceeac31e1d8e3d6a19e25cb00d6a97c47d1cb3d9e7ff02579d75e838713:0',
        'output value': '546',
        output_value: '546',
        preview: '/preview/89976ceeac31e1d8e3d6a19e25cb00d6a97c47d1cb3d9e7ff02579d75e838713i0',
        sat: '/sat/1598999642906623',
        timestamp: '2023-05-21 16:45:50 UTC',
        title: 'Inscription 8360901',
      },
      {
        content: '/content/0269876647e169aea1fa6fcc30a4a64f9044551d81f24e0e87fc69a394938310i0',
        'content length': '50 bytes',
        'content type': 'text/plain;charset=utf-8',
        content_length: '50 bytes',
        content_type: 'text/plain;charset=utf-8',
        'genesis fee': '6688',
        'genesis height': '/block/790762',
        'genesis transaction':
          '/tx/0269876647e169aea1fa6fcc30a4a64f9044551d81f24e0e87fc69a394938310',
        genesis_fee: '6688',
        genesis_height: '/block/790762',
        genesis_transaction: '/tx/0269876647e169aea1fa6fcc30a4a64f9044551d81f24e0e87fc69a394938310',
        id: '0269876647e169aea1fa6fcc30a4a64f9044551d81f24e0e87fc69a394938310i0',
        inscription_number: 8360902,
        location: '0269876647e169aea1fa6fcc30a4a64f9044551d81f24e0e87fc69a394938310:0:0',
        offset: '0',
        output: '/output/0269876647e169aea1fa6fcc30a4a64f9044551d81f24e0e87fc69a394938310:0',
        'output value': '546',
        output_value: '546',
        preview: '/preview/0269876647e169aea1fa6fcc30a4a64f9044551d81f24e0e87fc69a394938310i0',
        sat: '/sat/1598999642965041',
        timestamp: '2023-05-21 16:45:50 UTC',
        title: 'Inscription 8360902',
      },
      {
        content: '/content/7678a47031bcc33d08c1a7fb8ddf5f7260e7ac6069e11842cdd53b306e7e3d28i0',
        'content length': '50 bytes',
        'content type': 'text/plain;charset=utf-8',
        content_length: '50 bytes',
        content_type: 'text/plain;charset=utf-8',
        'genesis fee': '6688',
        'genesis height': '/block/790762',
        'genesis transaction':
          '/tx/7678a47031bcc33d08c1a7fb8ddf5f7260e7ac6069e11842cdd53b306e7e3d28',
        genesis_fee: '6688',
        genesis_height: '/block/790762',
        genesis_transaction: '/tx/7678a47031bcc33d08c1a7fb8ddf5f7260e7ac6069e11842cdd53b306e7e3d28',
        id: '7678a47031bcc33d08c1a7fb8ddf5f7260e7ac6069e11842cdd53b306e7e3d28i0',
        inscription_number: 8360903,
        location: '7678a47031bcc33d08c1a7fb8ddf5f7260e7ac6069e11842cdd53b306e7e3d28:0:0',
        offset: '0',
        output: '/output/7678a47031bcc33d08c1a7fb8ddf5f7260e7ac6069e11842cdd53b306e7e3d28:0',
        'output value': '546',
        output_value: '546',
        preview: '/preview/7678a47031bcc33d08c1a7fb8ddf5f7260e7ac6069e11842cdd53b306e7e3d28i0',
        sat: '/sat/1598999642957807',
        timestamp: '2023-05-21 16:45:50 UTC',
        title: 'Inscription 8360903',
      },
      {
        content: '/content/5819ebb0eadd306f3d9ee2047056e358221739ba2120dbe7f0683477e8e62055i0',
        'content length': '50 bytes',
        'content type': 'text/plain;charset=utf-8',
        content_length: '50 bytes',
        content_type: 'text/plain;charset=utf-8',
        'genesis fee': '6688',
        'genesis height': '/block/790762',
        'genesis transaction':
          '/tx/5819ebb0eadd306f3d9ee2047056e358221739ba2120dbe7f0683477e8e62055',
        genesis_fee: '6688',
        genesis_height: '/block/790762',
        genesis_transaction: '/tx/5819ebb0eadd306f3d9ee2047056e358221739ba2120dbe7f0683477e8e62055',
        id: '5819ebb0eadd306f3d9ee2047056e358221739ba2120dbe7f0683477e8e62055i0',
        inscription_number: 8360905,
        location: '5819ebb0eadd306f3d9ee2047056e358221739ba2120dbe7f0683477e8e62055:0:0',
        offset: '0',
        output: '/output/5819ebb0eadd306f3d9ee2047056e358221739ba2120dbe7f0683477e8e62055:0',
        'output value': '546',
        output_value: '546',
        preview: '/preview/5819ebb0eadd306f3d9ee2047056e358221739ba2120dbe7f0683477e8e62055i0',
        sat: '/sat/1598999642928871',
        timestamp: '2023-05-21 16:45:50 UTC',
        title: 'Inscription 8360905',
      },
      {
        content: '/content/7ce7830be9bc81205aa3dbbe94967d6fbb4ed7e34b09e51a55f317b9d311495ai0',
        'content length': '50 bytes',
        'content type': 'text/plain;charset=utf-8',
        content_length: '50 bytes',
        content_type: 'text/plain;charset=utf-8',
        'genesis fee': '6688',
        'genesis height': '/block/790762',
        'genesis transaction':
          '/tx/7ce7830be9bc81205aa3dbbe94967d6fbb4ed7e34b09e51a55f317b9d311495a',
        genesis_fee: '6688',
        genesis_height: '/block/790762',
        genesis_transaction: '/tx/7ce7830be9bc81205aa3dbbe94967d6fbb4ed7e34b09e51a55f317b9d311495a',
        id: '7ce7830be9bc81205aa3dbbe94967d6fbb4ed7e34b09e51a55f317b9d311495ai0',
        inscription_number: 8360906,
        location: '7ce7830be9bc81205aa3dbbe94967d6fbb4ed7e34b09e51a55f317b9d311495a:0:0',
        offset: '0',
        output: '/output/7ce7830be9bc81205aa3dbbe94967d6fbb4ed7e34b09e51a55f317b9d311495a:0',
        'output value': '546',
        output_value: '546',
        preview: '/preview/7ce7830be9bc81205aa3dbbe94967d6fbb4ed7e34b09e51a55f317b9d311495ai0',
        sat: '/sat/1598999642943339',
        timestamp: '2023-05-21 16:45:50 UTC',
        title: 'Inscription 8360906',
      },
      {
        content: '/content/c075342af35093c9a3603cf15572a9a65d7d6106af440bff852244b0c0c1ca72i0',
        'content length': '50 bytes',
        'content type': 'text/plain;charset=utf-8',
        content_length: '50 bytes',
        content_type: 'text/plain;charset=utf-8',
        'genesis fee': '6688',
        'genesis height': '/block/790762',
        'genesis transaction':
          '/tx/c075342af35093c9a3603cf15572a9a65d7d6106af440bff852244b0c0c1ca72',
        genesis_fee: '6688',
        genesis_height: '/block/790762',
        genesis_transaction: '/tx/c075342af35093c9a3603cf15572a9a65d7d6106af440bff852244b0c0c1ca72',
        id: 'c075342af35093c9a3603cf15572a9a65d7d6106af440bff852244b0c0c1ca72i0',
        inscription_number: 8360907,
        location: 'c075342af35093c9a3603cf15572a9a65d7d6106af440bff852244b0c0c1ca72:0:0',
        offset: '0',
        output: '/output/c075342af35093c9a3603cf15572a9a65d7d6106af440bff852244b0c0c1ca72:0',
        'output value': '546',
        output_value: '546',
        preview: '/preview/c075342af35093c9a3603cf15572a9a65d7d6106af440bff852244b0c0c1ca72i0',
        sat: '/sat/1598999642950573',
        timestamp: '2023-05-21 16:45:50 UTC',
        title: 'Inscription 8360907',
      },
      {
        content: '/content/9f05f979a7c543731cf6b47860b41531c1d8538596f1ec9fece1176f5bfd4b8ai0',
        'content length': '50 bytes',
        'content type': 'text/plain;charset=utf-8',
        content_length: '50 bytes',
        content_type: 'text/plain;charset=utf-8',
        'genesis fee': '6688',
        'genesis height': '/block/790762',
        'genesis transaction':
          '/tx/9f05f979a7c543731cf6b47860b41531c1d8538596f1ec9fece1176f5bfd4b8a',
        genesis_fee: '6688',
        genesis_height: '/block/790762',
        genesis_transaction: '/tx/9f05f979a7c543731cf6b47860b41531c1d8538596f1ec9fece1176f5bfd4b8a',
        id: '9f05f979a7c543731cf6b47860b41531c1d8538596f1ec9fece1176f5bfd4b8ai0',
        inscription_number: 8360908,
        location: '9f05f979a7c543731cf6b47860b41531c1d8538596f1ec9fece1176f5bfd4b8a:0:0',
        offset: '0',
        output: '/output/9f05f979a7c543731cf6b47860b41531c1d8538596f1ec9fece1176f5bfd4b8a:0',
        'output value': '546',
        output_value: '546',
        preview: '/preview/9f05f979a7c543731cf6b47860b41531c1d8538596f1ec9fece1176f5bfd4b8ai0',
        sat: '/sat/1598999642936105',
        timestamp: '2023-05-21 16:45:50 UTC',
        title: 'Inscription 8360908',
      },
      {
        content: '/content/0e25a73e78ce0fe9e89a48443c3e16d367a268c3ae6624e9ea51dbcc77c3eb91i0',
        'content length': '50 bytes',
        'content type': 'text/plain;charset=utf-8',
        content_length: '50 bytes',
        content_type: 'text/plain;charset=utf-8',
        'genesis fee': '6688',
        'genesis height': '/block/790762',
        'genesis transaction':
          '/tx/0e25a73e78ce0fe9e89a48443c3e16d367a268c3ae6624e9ea51dbcc77c3eb91',
        genesis_fee: '6688',
        genesis_height: '/block/790762',
        genesis_transaction: '/tx/0e25a73e78ce0fe9e89a48443c3e16d367a268c3ae6624e9ea51dbcc77c3eb91',
        id: '0e25a73e78ce0fe9e89a48443c3e16d367a268c3ae6624e9ea51dbcc77c3eb91i0',
        inscription_number: 8360909,
        location: '0e25a73e78ce0fe9e89a48443c3e16d367a268c3ae6624e9ea51dbcc77c3eb91:0:0',
        offset: '0',
        output: '/output/0e25a73e78ce0fe9e89a48443c3e16d367a268c3ae6624e9ea51dbcc77c3eb91:0',
        'output value': '546',
        output_value: '546',
        preview: '/preview/0e25a73e78ce0fe9e89a48443c3e16d367a268c3ae6624e9ea51dbcc77c3eb91i0',
        sat: '/sat/1598999642921637',
        timestamp: '2023-05-21 16:45:50 UTC',
        title: 'Inscription 8360909',
      },
      {
        content: '/content/236d1ed15a5a512b6e7eed79420ccc90e1f06d462fbfbb264648be82032f1ea2i0',
        'content length': '50 bytes',
        'content type': 'text/plain;charset=utf-8',
        content_length: '50 bytes',
        content_type: 'text/plain;charset=utf-8',
        'genesis fee': '6688',
        'genesis height': '/block/790762',
        'genesis transaction':
          '/tx/236d1ed15a5a512b6e7eed79420ccc90e1f06d462fbfbb264648be82032f1ea2',
        genesis_fee: '6688',
        genesis_height: '/block/790762',
        genesis_transaction: '/tx/236d1ed15a5a512b6e7eed79420ccc90e1f06d462fbfbb264648be82032f1ea2',
        id: '236d1ed15a5a512b6e7eed79420ccc90e1f06d462fbfbb264648be82032f1ea2i0',
        inscription_number: 8360910,
        location: '236d1ed15a5a512b6e7eed79420ccc90e1f06d462fbfbb264648be82032f1ea2:0:0',
        offset: '0',
        output: '/output/236d1ed15a5a512b6e7eed79420ccc90e1f06d462fbfbb264648be82032f1ea2:0',
        'output value': '546',
        output_value: '546',
        preview: '/preview/236d1ed15a5a512b6e7eed79420ccc90e1f06d462fbfbb264648be82032f1ea2i0',
        sat: '/sat/1598999642907169',
        timestamp: '2023-05-21 16:45:50 UTC',
        title: 'Inscription 8360910',
      },
    ];

    function parseInscriptions(rawInscriptions) {
      const result = {};

      for (let i = 0; i < rawInscriptions.length; i++) {
        result[rawInscriptions[i].id.replace('i', ':')] = [
          {
            id: rawInscriptions[i].id,
            offset: new BigNumber(rawInscriptions[i].offset),
          },
        ];
      }

      return result;
    }

    const inscriptions = parseInscriptions(rawInscriptions);
    console.log(inscriptions, 'inscriptions');
    const utxos = await getAllUnspentTransactions_mempool(
      'bc1plsexaxcakavpp7wxtu40qg757q5jk8wwvmk8wzm5cw0g0hyxrx8qkauxdm',
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

    const cardinalBalance = await getBTCBalance({ utxos: parsedUtxos, inscriptions });
    console.log(cardinalBalance.toNumber(), 'cardinalBalance', parsedUtxos);
    const utxos_mempool = await getAllUnspentTransactions_mempool(
      'bc1qxhmdufsvnuaaaer4ynz88fspdsxq2h9e9cetdj',
      'BTC'
    );
    console.log({ utxos_mempool });
    return true;
  });
});

import { Psbt, Transaction } from 'bitcoinjs-lib';

import BigNumber from 'bignumber.js';

function convertOffsetToNumber(inscriptions) {
  const result = {};

  for (let key in inscriptions) {
    result[key] = inscriptions[key].map((item) => {
      return {
        id: item.id,
        offset: new BigNumber(item.offset),
      };
    });
  }

  return result;
}

interface UTXO {
  tx_hash: string;
  tx_output_n: number;
  value: BigNumber;
}

// key : "TxID:OutcoinIndex" : Inscription[]
interface Inscription {
  offset: BigNumber;
  id: string;
}

interface ICreateTxResp {
  tx: Transaction;
  txID: string;
  txHex: string;
  fee: BigNumber;
  selectedUTXOs: UTXO[];
  changeAmount: BigNumber;
}

interface ICreateRawTxResp {
  base64Psbt: string;
  fee: BigNumber;
  selectedUTXOs: UTXO[];
  changeAmount: BigNumber;
  indicesToSign: number[];
}

interface ICreateTxBuyResp {
  tx: Transaction;
  txID: string;
  txHex: string;
  fee: BigNumber;
  selectedUTXOs: UTXO[];
  splitTxID: string;
  splitUTXOs: UTXO[];
  splitTxRaw: string;
}

interface ICreateTxSellResp {
  base64Psbt: string;
  selectedUTXOs: UTXO[];
  splitTxID: string;
  splitUTXOs: UTXO[];
  splitTxRaw: string;
}

interface ICreateTxSplitInscriptionResp {
  txID: string;
  txHex: string;
  fee: BigNumber;
  selectedUTXOs: UTXO[];
  newValueInscription: BigNumber;
}

interface BuyReqInfo {
  sellerSignedPsbtB64: string;
  receiverInscriptionAddress: string;
  price: BigNumber;
}

interface BuyReqFullInfo extends BuyReqInfo {
  sellerSignedPsbt: Psbt;
  valueInscription: BigNumber;
  paymentUTXO: any; // UTXO || null
}

interface PaymentInfo {
  address: string;
  amount: BigNumber;
}

interface Wallet {
  privKey: string;
}

interface ISignPSBTResp {
  signedBase64PSBT: string;
  msgTxHex: string;
  msgTxID: string;
  msgTx: Transaction;
}

interface NeedPaymentUTXO {
  buyInfoIndex: number;
  amount: BigNumber;
}

interface SafeCardinalUTXO {
  status: string; // for now always mined
  txId: string;
  index: number;
  value: number;
  script: string;
  address: string;
  blockHeight: number;
  type: string;
}

interface SafeInscription {
  id: string;
  genesisFee: number;
  genesisHeight: number;
  number: number;
  satpoint: string;
  timestamp: number;
}
interface SafeOrdinalUTXO {
  status: string; // for now always mined
  txId: string;
  index: number;
  value: number;
  script: string;
  address: string;
  blockHeight: number;
  type: string;
  inscriptions: Array<SafeInscription>;
}

export {
  UTXO,
  Inscription,
  ICreateTxResp,
  ICreateRawTxResp,
  ICreateTxSplitInscriptionResp,
  ICreateTxBuyResp,
  ICreateTxSellResp,
  BuyReqInfo,
  PaymentInfo,
  BuyReqFullInfo,
  Wallet,
  ISignPSBTResp,
  NeedPaymentUTXO,
  SafeCardinalUTXO,
  SafeInscription,
  SafeOrdinalUTXO
};

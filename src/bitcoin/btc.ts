import axios, { AxiosRequestConfig } from 'axios';
import BigNumber from 'bignumber.js';

interface keyable {
  [key: string]: any;
}
const BTC_DECIMAL = 8;
const DOGE_DECIMAL = 8;

interface Inscription {
  offset: BigNumber;
  id: string;
}

interface UTXO {
  tx_hash: string;
  tx_output_n: number;
  value: BigNumber;
}
const filterAndSortCardinalUTXOs = (
  utxos: UTXO[],
  inscriptions: { [key: string]: Inscription[] }
): { cardinalUTXOs: UTXO[]; inscriptionUTXOs: UTXO[]; totalCardinalAmount: BigNumber } => {
  let cardinalUTXOs: UTXO[] = [];
  const inscriptionUTXOs: UTXO[] = [];
  const BNZero = new BigNumber(0);

  let totalCardinalAmount = BNZero;

  // filter normal UTXO and inscription UTXO to send
  for (const utxo of utxos) {
    // txIDKey = tx_hash:tx_output_n
    let txIDKey = utxo.tx_hash.concat(':');
    txIDKey = txIDKey.concat(utxo.tx_output_n.toString());

    // try to get inscriptionInfos
    const inscriptionInfos = inscriptions[txIDKey];

    if (
      inscriptionInfos === undefined ||
      inscriptionInfos === null ||
      inscriptionInfos.length == 0
    ) {
      // normal UTXO
      cardinalUTXOs.push(utxo);
      totalCardinalAmount = totalCardinalAmount.plus(utxo.value);
    } else {
      inscriptionUTXOs.push(utxo);
    }
  }

  cardinalUTXOs = cardinalUTXOs.sort((a: UTXO, b: UTXO): number => {
    if (a.value.gt(b.value)) {
      return -1;
    }
    if (a.value.lt(b.value)) {
      return 1;
    }
    return 0;
  });

  return { cardinalUTXOs, inscriptionUTXOs, totalCardinalAmount };
};

const getCardinalBalance = (params: {
  utxos: UTXO[];
  inscriptions: { [key: string]: Inscription[] };
}): BigNumber => {
  const { utxos, inscriptions } = params;
  const { totalCardinalAmount } = filterAndSortCardinalUTXOs(utxos, inscriptions);
  return totalCardinalAmount;
};

export const getBalance_mempool = async (address: string, symbol: string) => {
  let serverRes =
    symbol == 'BTC' || symbol == 'BTC_TAPROOT'
      ? {
          value: 0,
          error: false,
          currency: {
            symbol: 'BTC',
            decimals: BTC_DECIMAL,
          },
        }
      : {
          value: 0,
          error: false,
          currency: {
            symbol: 'DOGE',
            decimals: DOGE_DECIMAL,
          },
        };
  let balance = 0;
  if (symbol == 'BTC') {
    await axios
      .get(`https://mempool.space/api/address/${address}`)
      .then((res) => {
        balance = res.data.chain_stats.funded_txo_sum - res.data.chain_stats.spent_txo_sum;
        serverRes.value = balance;
      })
      .catch((err) => {
        serverRes.error = true;
        console.log(err);
      });
  } else {
    const utxos = await getAllUnspentTransactions_mempool(address, 'BTC_TAPROOT');
    // todo: get inscriptions
    let inscriptions: { [key: string]: Inscription[] } = await getOrdinalsList(address);

    const parsedUtxos =
      utxos?.length > 0
        ? utxos?.map((utxo: any) => ({
            tx_hash: utxo.txid,
            tx_output_n: utxo.vout,
            value: new BigNumber(utxo.value), // normal
          }))
        : [];
    const cardinalBalance = await getCardinalBalance({ utxos: parsedUtxos, inscriptions });
    serverRes.value = cardinalBalance.toNumber();
  }

  return balance;
};

export const getTransactions_mempool = async (address) => {
  const apiUrl = `https://mempool.space/api/address/${address}/txs`;

  try {
    const response = await axios.get(apiUrl);
    const { data } = response;
    return data?.map((tx) => ({
      ...tx,
      ...{ type: 'mempool' },
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
};

export interface TxStatus {
  confirmed: boolean;
  block_height: number;
  block_hash: string;
  block_time: number;
}

export interface AddressTxsUtxo {
  txid: string;
  vout: number;
  status: TxStatus;
  value: number;
}
const getScriptFromTxId = async (txId, vout,testnet = false) => {
  const apiUrl = testnet ? `https://mempool.space/testnet/api/tx/${txId}` : `https://mempool.space/api/tx/${txId}`;

  try {
    const response = await axios.get(apiUrl);
    const transaction = response.data;

    const output = transaction.vout[vout];
    if (output) {
      const script = output;
      return script;
    } else {
      console.log('Output not found');
      return '';
    }
  } catch (error) {
    console.log(error);
    return '';
  }
};


export const getAllUnspentTransactions_mempool = async (address, symbol, testnet = false) => {
  const apiUrl = testnet?  `https://mempool.space/testnet/api/address/${address}/utxo` : `https://mempool.space/api/address/${address}/utxo`;

  try {
    const response = await axios.get(apiUrl);
    const unspentTransactions = response.data;
    if (false) {
      return unspentTransactions.map((utxo: AddressTxsUtxo) => ({
        hash: utxo.txid,
        index: utxo.vout,
        address: address,
        value: utxo.value,
      }));
    } else {
      const promises = unspentTransactions.map(async (utxo: AddressTxsUtxo) => {
        let scripData = await getScriptFromTxId(utxo.txid, utxo.vout, testnet);
        return {
          hash: utxo.txid,
          index: utxo.vout,
          value: utxo.value,
          blockHeight: utxo.status.block_height,
          script: scripData.scriptpubkey,
          address: scripData.scriptpubkey_address,
          type: scripData.scriptpubkey_type,
        };
      });
      return Promise.all(promises);
    }
  } catch (error) {
    console.error(error);
    return [];
  }
};

/**
 * getFeeRateAndFees_BTC_DOGE fetches avg feeRate and avg price for one input and two outputs
 * @param {string} symbol
 * @returns {any}
 */
export const getFeeRateAndFees_mempool = async (symbol: string) => {
  const BYTES_FOR_ONE_INPUT_TWO_OUTPUTS = 400;
  const offlineFeeRate = symbol == 'BTC_TAPROOT' || symbol == 'BTC' ? 13 : 1000;
  try {
    const apiUrl = 'https://mempool.space/api/v1/fees/recommended';
    const response = await axios.get(apiUrl);

    const { fastestFee, halfHourFee, hourFee, economyFee, minimumFee } = response.data;

    return {
      feeRate: halfHourFee,
      fees: (halfHourFee * BYTES_FOR_ONE_INPUT_TWO_OUTPUTS) / Math.pow(10, 8),
    };
  } catch (error) {
    console.error(error);
    return {
      feeRate: offlineFeeRate,
      fees: (offlineFeeRate * BYTES_FOR_ONE_INPUT_TWO_OUTPUTS) / Math.pow(10, 8),
    };
  }
};

export const broadcastTxn_mempool = async (rawTransaction) => {
  const apiUrl = 'https://mempool.space/api/tx';
  let serverRes = { hash: '', error: false, errorMessage: '' };

  try {
    const response = await axios.post(apiUrl, rawTransaction);
    const { data } = response;
    serverRes.hash = data;
    return serverRes;
  } catch (error) {
    console.error(error);
    serverRes.error = true;
    serverRes.errorMessage = error.message;
    return serverRes;
  }
};
/**
 * getOrdinalsList
 * @param {string} address
 * @returns {any}
 */
export const getOrdinalsList = async (address: string) => {
  const url = `https://ordapi.xyz/address/${address}`;
  // for padding left in nft use
  //output_value

  try {
    const response = await axios.get(url);

    return response.data;
  } catch (error) {
    console.log(error);
  }
};

//"/output/a67618527b199966b1a53c9d75319c12e49eb1ac6f62704aa12599771d541dd3:0" =>
function getOutputId(inputString) {
  // Use regex to match the string we want to extract
  const regex = /\/output\/([a-z0-9]{64}):/;
  const match = inputString.match(regex);

  // Check if a match was found and return the extracted string
  if (match && match.length > 1) {
    return match[1];
  } else {
    return null;
  }
}

export const getUTXOFromOutputPath = (outputpath, utxos) => {
  const outputHash = getOutputId(outputpath);
  const utxo = utxos.find((utxo) => utxo.hash === outputHash);
  return utxo;
};

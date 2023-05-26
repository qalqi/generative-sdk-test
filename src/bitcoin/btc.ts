import axios, { AxiosRequestConfig } from 'axios';
interface keyable {
  [key: string]: any;
}
const BTC_DECIMAL = 8;
const DOGE_DECIMAL = 8;
// TODO UPDATE ALL APIS
/**
 * getBalance_BTC_DOGE fetches balance for BTC or DOGE
 * @param {string} address
 * @param {string} symbol
 * @returns {keyable}
 */
export const getBalance_BTC_DOGE = async (address, symbol) => {
  let serverRes =
    symbol == 'BTC'
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

  const config: AxiosRequestConfig = {
    method: 'get',
    url: `https://chain.so/api/v3/balance/${symbol}/${address}`,
  };
  await axios(config)
    .then(function (response) {
      serverRes.value =
        (parseFloat(response?.data?.data?.confirmed) +
          parseFloat(response?.data?.data?.unconfirmed)) *
        Math.pow(10, 8);
    })
    .catch(function (error) {
      console.log(error, 'getBalance_BTC');
      serverRes.error = true;
    });
  return serverRes;
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
  return balance;
};

/**
 * getTransactions_BTC_DOGE fetches txns for BTC or DOGE
 * @param {any} address
 * @param {any} symbol
 * @param {any} page=1
 * @returns {any}
 */
export const getTransactions_BTC_DOGE = async (address, symbol, page = 1) => {
  let serverRes: keyable[] = [];

  const config: AxiosRequestConfig = {
    method: 'get',
    url: `https://chain.so/api/v3/transactions/${symbol}/${address}/${page}`,
  };

  await axios(config)
    .then(function (response) {
      serverRes = response.data.data.transactions.map((tx) => ({
        ...tx,
        ...{ type: 'sohov3' },
      }));
    })
    .catch(function (error) {
      console.log(error, 'getTransactions_BTC');
      return;
    });

  return serverRes;
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

//curl -sSL "https://mempool.space/api/address/1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY/utxo"
// write axios request for this api
// // [
//   {
//     txid: "12f96289f8f9cd51ccfe390879a46d7eeb0435d9e0af9297776e6bdf249414ff",
//     vout: 0,
//     status: {
//       confirmed: true,
//       block_height: 698642,
//       block_hash: "00000000000000000007839f42e0e86fd53c797b64b7135fcad385158c9cafb8",
//       block_time: 1630561459
//     },
//     value: 644951084
//   },
//   ...
// ]

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
const getScriptFromTxId = async (txId, vout) => {
  const apiUrl = `https://mempool.space/api/tx/${txId}`;

  try {
    const response = await axios.get(apiUrl);
    const transaction = response.data;

    const output = transaction.vout[vout];
    if (output) {
      const script = output.scriptpubkey;
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

export const getAllUnspentTransactions_mempool = async (address, symbol) => {
  const apiUrl = `https://mempool.space/api/address/${address}/utxo`;

  try {
    const response = await axios.get(apiUrl);
    const unspentTransactions = response.data;
    if (symbol == 'BTC_TAPROOT') {
      return unspentTransactions.map((utxo: AddressTxsUtxo) => ({
        hash: utxo.txid,
        index: utxo.vout,
        address: address,
        value: utxo.value,
      }));
    } else {
      const promises = unspentTransactions.map(async (utxo: AddressTxsUtxo) => {
        return {
          hash: utxo.txid,
          index: utxo.vout,
          address: address,
          value: utxo.value,
          script: await getScriptFromTxId(utxo.txid, utxo.vout),
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
 * fetches all UTXOS for given address and symbol
 * @param {string} address
 * @param {string} symbol
 * @returns {any}
 */
export const getAllUnspentTransactions = async (address, symbol) => {
  console.log('getAllUnspentTransactions', address, symbol);
  async function getUnspentTransactions(address, page) {
    try {
      const response = await axios.get(
        `https://chain.so/api/v3/unspent_outputs/${
          symbol == 'BTC_TAPROOT' ? 'BTC' : symbol
        }/${address}/${page}`,
        {}
      );
      if (response.data.status !== 'success') {
        throw new Error('Failed to retrieve UTXOs');
      }
      const { outputs } = response.data.data;
      if (outputs.length === 0) {
        return [];
      }
      const unspentTransactions = outputs.map((output) =>
        symbol == 'BTC'
          ? {
              hash: output.hash,
              index: output.index,
              address: output.address,
              script: output.script,
              value: output.value,
            }
          : {
              hash: output.hash,
              index: output.index,
              address: output.address,
              script: output.script,
              value: output.value,
              tx_hex: output.tx_hex,
            }
      );
      if (unspentTransactions.length == 10)
        return unspentTransactions.concat(await getUnspentTransactions(address, page + 1));
      else return unspentTransactions;
    } catch (error) {
      console.error(error);
      return [];
    }
  }
  return await getUnspentTransactions(address, 1);
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

/**
 * getFeeRateAndFees_BTC_DOGE fetches avg feeRate and avg price for one input and two outputs
 * @param {string} symbol
 * @returns {any}
 */
export const getFeeRateAndFees_BTC_DOGE = async (symbol: string) => {
  const BYTES_FOR_ONE_INPUT_TWO_OUTPUTS = 400;
  const offlineFeeRate = symbol == 'BTC_TAPROOT' || symbol == 'BTC' ? 7 : 1000;
  try {
    const response = await axios.get(
      `https://chain.so/api/v3/network_info/${symbol == 'BTC_TAPROOT' ? 'BTC' : symbol}`
    );
    const blocks = response.data.data.mempool.blocks;
    let totalFeeRate = 0;
    for (const block of blocks) {
      totalFeeRate += block.median_fee_rate;
    }
    // medianSpeed * fast factor 1.5
    const averageFeeRate = Math.ceil((totalFeeRate / blocks.length) * 1.5);
    return {
      feeRate: averageFeeRate,
      fees: (averageFeeRate * BYTES_FOR_ONE_INPUT_TWO_OUTPUTS) / Math.pow(10, 8),
    };
  } catch (error) {
    console.error(error);
    return {
      feeRate: offlineFeeRate,
      fees: (offlineFeeRate * BYTES_FOR_ONE_INPUT_TWO_OUTPUTS) / Math.pow(10, 8),
    };
  }
};

export const broadcastTxn_BTC_DOGE = async (txHex, symbol) => {
  var data = JSON.stringify({
    tx_hex: txHex,
  });
  console.log(txHex, symbol, 'broadcastTxn_BTC_DOGE');
  var config: AxiosRequestConfig = {
    method: 'post',
    url: `https://chain.so/api/v3/broadcast_transaction/${
      symbol == 'BTC_TAPROOT' ? 'BTC' : symbol
    }`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: data,
  };

  let serverRes = { hash: '', error: false, errorMessage: '' };
  await axios(config)
    .then(function (response) {
      serverRes.hash = response?.data?.data?.hash;
      return serverRes;
    })
    .catch(function (error) {
      serverRes.error = true;
      if (error.response) {
        console.log(error.response, 'broadcastTxn_BTC_DOGE');
        serverRes.errorMessage = error.response.data.data?.error_message;
      }
      return serverRes;
    });
  return serverRes;
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

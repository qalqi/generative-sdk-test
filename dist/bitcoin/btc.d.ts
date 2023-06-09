export declare const getBalance_mempool: (address: string, symbol: string) => Promise<number>;
export declare const getTransactions_mempool: (address: any) => Promise<any>;
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
export declare const getAllUnspentTransactions_mempool: (address: any, symbol: any, testnet?: boolean) => Promise<any>;
/**
 * getFeeRateAndFees_BTC_DOGE fetches avg feeRate and avg price for one input and two outputs
 * @param {string} symbol
 * @returns {any}
 */
export declare const getFeeRateAndFees_mempool: (symbol: string) => Promise<{
    feeRate: any;
    fees: number;
}>;
export declare const broadcastTxn_mempool: (rawTransaction: any) => Promise<{
    hash: string;
    error: boolean;
    errorMessage: string;
}>;
/**
 * getOrdinalsList
 * @param {string} address
 * @returns {any}
 */
export declare const getOrdinalsList: (address: string) => Promise<any>;
export declare const getUTXOFromOutputPath: (outputpath: any, utxos: any) => any;

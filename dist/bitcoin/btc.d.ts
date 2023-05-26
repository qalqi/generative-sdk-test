interface keyable {
    [key: string]: any;
}
/**
 * getBalance_BTC_DOGE fetches balance for BTC or DOGE
 * @param {string} address
 * @param {string} symbol
 * @returns {keyable}
 */
export declare const getBalance_BTC_DOGE: (address: any, symbol: any) => Promise<{
    value: number;
    error: boolean;
    currency: {
        symbol: string;
        decimals: number;
    };
}>;
/**
 * getTransactions_BTC_DOGE fetches txns for BTC or DOGE
 * @param {any} address
 * @param {any} symbol
 * @param {any} page=1
 * @returns {any}
 */
export declare const getTransactions_BTC_DOGE: (address: any, symbol: any, page?: number) => Promise<keyable[]>;
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
export declare const getAllUnspentTransactions_mempool: (address: any, symbol: any) => Promise<any>;
/**
 * fetches all UTXOS for given address and symbol
 * @param {string} address
 * @param {string} symbol
 * @returns {any}
 */
export declare const getAllUnspentTransactions: (address: any, symbol: any) => Promise<any>;
/**
 * getFeeRateAndFees_BTC_DOGE fetches avg feeRate and avg price for one input and two outputs
 * @param {string} symbol
 * @returns {any}
 */
export declare const getFeeRateAndFees_BTC_DOGE: (symbol: string) => Promise<{
    feeRate: number;
    fees: number;
}>;
export declare const broadcastTxn_BTC_DOGE: (txHex: any, symbol: any) => Promise<{
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
export {};

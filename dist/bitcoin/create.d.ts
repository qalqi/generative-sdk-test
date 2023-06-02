/// <reference types="node" />
import BigNumber from 'bignumber.js';
import * as bitcoin from 'bitcoinjs-lib';
import { Inscription, UTXO } from '../';
export declare function witnessStackToScriptWitness(witness: Buffer[]): Buffer;
export declare const NETWORK: bitcoin.networks.Network;
export declare const TESTNET_DERIV_PATH = "m/86'/1'/0'/0/0";
export declare const MAINNET_DERIV_PATH = "m/86'/0'/0'/0/0";
export declare const mnemonicToTaprootPrivateKey: (mnemonic: string, testnet?: any) => Promise<Buffer>;
export declare const createInscribeTx: ({ senderMnemonic, senderAddress, utxos, inscriptions, feeRatePerByte, data, sequence, isSelectUTXOs, isTestNet, }: {
    senderMnemonic: string;
    senderAddress: string;
    utxos: UTXO[];
    inscriptions: {
        [key: string]: Inscription[];
    };
    feeRatePerByte: number;
    data: string;
    sequence?: number;
    isSelectUTXOs?: boolean;
    isTestNet?: boolean;
}) => Promise<{
    commitTxHex: string;
    commitTxID: string;
    revealTxHex: string;
    revealTxID: string;
    totalFee: BigNumber;
    selectedUTXOs: UTXO[];
    newUTXOs: UTXO[];
}>;

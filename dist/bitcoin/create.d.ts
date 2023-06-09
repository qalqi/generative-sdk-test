import * as bitcoin from 'bitcoinjs-lib';
export declare const NETWORK: bitcoin.networks.Network;
export declare const TESTNET_DERIV_PATH = "m/86'/1'/0'/0/0";
export declare const MAINNET_DERIV_PATH = "m/86'/0'/0'/0/0";
export declare const mnemonicToTaprootPrivateKey: (mnemonic: string, testnet?: any) => Promise<Buffer>;

import BigNumber from 'bignumber.js';
import BIP32Factory from 'bip32';
import { initEccLib } from 'bitcoinjs-lib';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { mnemonicToSeedSync } from 'bip39';
import {
  generateTaprootKeyPair,
  setBTCNetwork,
  NetworkType,
  createTx,
  Inscription,
  getBTCBalance,
  UTXO,
  ICreateTxResp,
  toXOnly,
  estimateTxFee,
  ECPair,
  Network,
  createTxSendBTC,
  DefaultSequenceRBF,
  IKeyPairInfo,
  getKeyPairInfo,
} from '../';
import varuint from 'varuint-bitcoin';
import { ECPairInterface } from 'ecpair';
import { Tapleaf, Taptree } from 'bitcoinjs-lib/src/types';
import { generateRevealAddress } from './inscribe';

/**
 * Helper function that produces a serialized witness script
 * https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts#L477
 */
const BNZero = new BigNumber(0);
const MinSats2 = 546;

export function witnessStackToScriptWitness(witness: Buffer[]) {
  let buffer = Buffer.allocUnsafe(0);

  function writeSlice(slice: Buffer) {
    buffer = Buffer.concat([buffer, Buffer.from(slice)]);
  }

  function writeVarInt(i: number) {
    const currentLen = buffer.length;
    const varintLen = varuint.encodingLength(i);

    buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)]);
    varuint.encode(i, buffer, currentLen);
  }

  function writeVarSlice(slice: Buffer) {
    writeVarInt(slice.length);
    writeSlice(slice);
  }

  function writeVector(vector: Buffer[]) {
    writeVarInt(vector.length);
    vector.forEach(writeVarSlice);
  }

  writeVector(witness);

  return buffer;
}

export const NETWORK = true ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
export const TESTNET_DERIV_PATH = "m/86'/1'/0'/0/0";
export const MAINNET_DERIV_PATH = "m/86'/0'/0'/0/0";

const createLockScript = ({
  internalPubKey,
  data,
}: {
  internalPubKey: Buffer;
  data: string;
}): {
  hashLockKeyPair: ECPairInterface;
  hashScriptAsm: string;
  hashLockScript: Buffer;
  hashLockRedeem: Tapleaf;
  script_p2tr: bitcoin.payments.Payment;
} => {
  // Create a tap tree with two spend paths
  // One path should allow spending using secret
  // The other path should pay to another pubkey

  // Make random key pair for hash_lock script
  const hashLockKeyPair = ECPair.makeRandom({ network: Network });
  console.log(Network, 'Network');
  // TODO: comment
   const hashLockPrivKey = hashLockKeyPair.toWIF();
   console.log("hashLockPrivKey wif : ", hashLockPrivKey);

  // Note: for debug and test
  // const hashLockPrivKey = "";
  // const hashLockKeyPair = ECPair.fromWIF(hashLockPrivKey);
  // console.log("newKeyPair: ", hashLockKeyPair.privateKey);

  const protocolID = 'ord';
  const protocolIDHex = Buffer.from(protocolID, 'utf-8').toString('hex');
  // const protocolIDHex = toHex(protocolID);
  // console.log("protocolIDHex: ", protocolIDHex);

  const contentType = 'text/plain;charset=utf-8';
  const contentTypeHex = Buffer.from(contentType, 'utf-8').toString('hex');
  // const contentTypeHex = toHex(contentType);
  // console.log("contentTypeHex0: ", contentTypeHex0);
  // console.log("contentTypeHex: ", contentTypeHex);

  // P    string`json:"p"`
  // Op   string`json:"op"`
  // Tick string`json:"tick"`
  // Amt  string`json:"amt"`

  const contentStrHex = Buffer.from(data, 'utf-8').toString('hex');
  // const contentStrHex = toHex(data);
  // console.log("contentStrHex: ", contentStrHex);

  // Construct script to pay to hash_lock_keypair if the correct preimage/secret is provided

  // const hashScriptAsm = `${toXOnly(hashLockKeyPair.publicKey).toString("hex")} OP_CHECKSIG OP_0 OP_IF ${protocolIDHex} ${op1} ${contentTypeHex} OP_0 ${contentStrHex} OP_ENDIF`;
  // console.log("InscribeOrd hashScriptAsm: ", hashScriptAsm);
  // const hashLockScript = script.fromASM(hashScriptAsm);
  const len = contentStrHex.length / 2;
  const lenHex = len.toString(16);
  console.log('lenHex: ', lenHex);

  let hexStr = '20'; // 32 - len public key
  hexStr += toXOnly(hashLockKeyPair.publicKey).toString('hex');
  hexStr += 'ac0063'; // OP_CHECKSIG OP_0 OP_IF
  hexStr += '03'; // len protocol
  hexStr += protocolIDHex;
  hexStr += '0101';
  hexStr += '18'; // len content type
  hexStr += contentTypeHex;
  hexStr += '00'; // op_0
  hexStr += lenHex;
  hexStr += contentStrHex;
  hexStr += '68'; // OP_ENDIF

  console.log('hexStr: ', hexStr);

  // const hexStr = "207022ae3ead9927479c920d24b29249e97ed905ad5865439f962ba765147ee038ac0063036f7264010118746578742f706c61696e3b636861727365743d7574662d3800367b2270223a226272632d3230222c226f70223a227472616e73666572222c227469636b223a227a626974222c22616d74223a2231227d68";
  const hashLockScript = Buffer.from(hexStr, 'hex');

  console.log('hashLockScript: ', hashLockScript.toString('hex'));

  // const asm2 = script.toASM(hashLockScript);
  // console.log("asm2: ", asm2);

  const hashLockRedeem = {
    output: hashLockScript,
    redeemVersion: 192,
  };

  const scriptTree: Taptree = hashLockRedeem;
  const script_p2tr = bitcoin.payments.p2tr({
    internalPubkey: internalPubKey,
    scriptTree,
    redeem: hashLockRedeem,
    network: Network,
  });

  console.log('InscribeOrd script_p2tr: ', script_p2tr.address);

  return {
    hashLockKeyPair,
    hashScriptAsm: '',
    hashLockScript,
    hashLockRedeem,
    script_p2tr,
  };
};
export const mnemonicToTaprootPrivateKey = async (mnemonic: string, testnet?) => {
  const bip32 = BIP32Factory(ecc);
  initEccLib(ecc);

  const seed = mnemonicToSeedSync(mnemonic);
  const rootKey = await bip32.fromSeed(
    seed,
    testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
  );
  const derivePath = testnet ? TESTNET_DERIV_PATH : MAINNET_DERIV_PATH;
  const taprootChild = rootKey.derivePath(derivePath);

  const privateKey = taprootChild.privateKey!;
  return privateKey;
};

function getRevealVirtualSize(
  hash_lock_redeem: any,
  script_p2tr: any,
  p2pktr_addr: any,
  hash_lock_keypair: any
) {
  const tapLeafScript = {
    leafVersion: hash_lock_redeem.redeemVersion,
    script: hash_lock_redeem.output,
    controlBlock: script_p2tr.witness![script_p2tr.witness!.length - 1],
  };

  const psbt = new bitcoin.Psbt({ network: Network });
  psbt.addInput({
    hash: '00'.repeat(32),
    index: 0,
    witnessUtxo: { value: 1, script: script_p2tr.output! },
    tapLeafScript: [tapLeafScript],
  });

  psbt.addOutput({
    address: p2pktr_addr,
    value: 1,
  });

  
  psbt.signInput(0, hash_lock_keypair);

  // We have to construct our witness script in a custom finalizer

  const customFinalizer = (_inputIndex: number, input: any) => {
    const scriptSolution = [input.tapScriptSig[0].signature];
    const witness = scriptSolution.concat(tapLeafScript.script).concat(tapLeafScript.controlBlock);

    return {
      finalScriptWitness: witnessStackToScriptWitness(witness),
    };
  };

  psbt.finalizeInput(0, customFinalizer);

  let tx = psbt.extractTransaction();
  return tx.virtualSize();
}

const createRawRevealTx = ({
  commitTxID,
  hashLockKeyPair,
  hashLockRedeem,
  script_p2tr,
  revealTxFee,
  address,
  sequence = 0,
}: {
  commitTxID: string;
  hashLockKeyPair: ECPairInterface;
  hashLockRedeem: any;
  script_p2tr: bitcoin.payments.Payment;
  revealTxFee: number;
  address: string;
  sequence?: number;
}): { revealTxHex: string; revealTxID: string } => {
  const tapLeafScript = {
    leafVersion: hashLockRedeem?.redeemVersion,
    script: hashLockRedeem?.output,
    controlBlock: script_p2tr.witness![script_p2tr.witness!.length - 1],
  };

  const psbt = new bitcoin.Psbt({ network: Network });
  psbt.addInput({
    hash: commitTxID,
    index: 0,
    witnessUtxo: { value: revealTxFee + MinSats2, script: script_p2tr.output! },
    tapLeafScript: [tapLeafScript],
    sequence,
  });

  // output has OP_RETURN zero value
  // const data = Buffer.from("https://trustless.computer", "utf-8");
  // const scriptEmbed = script.compile([
  //     opcodes.OP_RETURN,
  //     data,
  // ]);
  // psbt.addOutput({
  //     value: 0,
  //     script: scriptEmbed,
  // });

  psbt.addOutput({
    value: MinSats2,
    address: address,
  });

  // const hash_lock_keypair = ECPair.fromWIF(hashLockPriKey);
  psbt.signInput(0, hashLockKeyPair);

  // We have to construct our witness script in a custom finalizer
  const customFinalizer = (_inputIndex: number, input: any) => {
    const scriptSolution = [input.tapScriptSig[0].signature];
    const witness = scriptSolution.concat(tapLeafScript.script).concat(tapLeafScript.controlBlock);

    return {
      finalScriptWitness: witnessStackToScriptWitness(witness),
    };
  };

  psbt.finalizeInput(0, customFinalizer);
  const revealTX = psbt.extractTransaction();

  console.log('revealTX: ', revealTX);

  return { revealTxHex: revealTX.toHex(), revealTxID: revealTX.getId() };
};

export const createInscribeTx = async ({
  senderMnemonic,
  senderAddress,
  utxos,
  inscriptions,
  feeRatePerByte,
  data,
  sequence = DefaultSequenceRBF,
  isSelectUTXOs = true,
  isTestNet = false,
}: {
  senderMnemonic: string;
  senderAddress: string;
  utxos: UTXO[];
  inscriptions: { [key: string]: Inscription[] };
  feeRatePerByte: number;
  data: string;
  sequence?: number;
  isSelectUTXOs?: boolean;
  isTestNet?: boolean;
}): Promise<{
  commitTxHex: string;
  commitTxID: string;
  revealTxHex: string;
  revealTxID: string;
  totalFee: BigNumber;
  selectedUTXOs: UTXO[];
  newUTXOs: UTXO[];
}> => {
  const senderPrivateKey = await mnemonicToTaprootPrivateKey(senderMnemonic, isTestNet);
  setBTCNetwork(isTestNet ? NetworkType.Testnet : NetworkType.Mainnet);

  const { ...rest } = generateTaprootKeyPair(senderPrivateKey);
  console.log('address', rest.senderAddress);
  const keyPairInfo: IKeyPairInfo = getKeyPairInfo({
    privateKey: senderPrivateKey,
    address: rest.senderAddress,
  });

  const { addressType, payment, keyPair, signer, sigHashTypeDefault } = keyPairInfo;

  // const { keyPair, p2pktr, senderAddress } = generateTaprootKeyPair(senderPrivateKey);
  const internalPubKey = toXOnly(keyPair.publicKey);
  const hexData = Buffer.from(data, 'utf-8').toString('hex');

  const { p2tr: revealAddress, tapLeafScript } = generateRevealAddress(
    internalPubKey,
    'text/plain;charset=utf-8',
    hexData,
    Network
  );
  console.log(revealAddress, 'revealAddress');
  console.log(tapLeafScript, 'tapLeafScript');
  // create lock script for commit tx
  const { hashLockKeyPair, hashLockRedeem, script_p2tr } = await createLockScript({
    internalPubKey,
    data,
  });
  // estimate fee and select UTXOs

  const estCommitTxFee = estimateTxFee(1, 2, feeRatePerByte);
  console.log('estCommitTxFee: ', estCommitTxFee);

  const revealVByte = getRevealVirtualSize(
    hashLockRedeem,
    script_p2tr,
    rest.senderAddress,
    hashLockKeyPair
  );
  //const revealVByte = 165;
  const estRevealTxFee = revealVByte * feeRatePerByte;
  const totalFee = estCommitTxFee + estRevealTxFee;
  console.log(totalFee, 'totalFee');
  // const totalAmount = new BigNumber(totalFee + MinSats); // MinSats for new output in the reveal tx

  // const { selectedUTXOs, totalInputAmount } = selectCardinalUTXOs(utxos, inscriptions, totalAmount);

  if (script_p2tr.address === undefined || script_p2tr.address === '') {
    console.log('INVALID_TAPSCRIPT_ADDRESS');
  }
  console.log('createTxSendBTC ====>', utxos, inscriptions);

  const {
    txHex: commitTxHex,
    txID: commitTxID,
    fee: commitTxFee,
    changeAmount,
    selectedUTXOs,
    tx,
  } = createTxSendBTC({
    senderPrivateKey,
    utxos,
    inscriptions,
    paymentInfos: [
      { address: script_p2tr.address || '', amount: new BigNumber(estRevealTxFee + MinSats2) },
    ],
    feeRatePerByte,
  });

  const newUTXOs: UTXO[] = [];
  if (changeAmount.gt(BNZero)) {
    newUTXOs.push({
      tx_hash: commitTxID,
      tx_output_n: 1,
      value: changeAmount,
    });
  }

  console.log('commitTX: ', tx, commitTxFee);
  console.log('COMMITTX selectedUTXOs: ', selectedUTXOs);

  // create and sign reveal tx
  const { revealTxHex, revealTxID } = createRawRevealTx({
    commitTxID,
    hashLockKeyPair,
    hashLockRedeem,
    script_p2tr,
    revealTxFee: estRevealTxFee,
    address: senderAddress,
    sequence: 0,
  });

  console.log('commitTxHex: ', commitTxHex);
  console.log('revealTxHex: ', revealTxHex);
  console.log('commitTxID: ', commitTxID);
  console.log('revealTxID: ', revealTxID);

  // const { btcTxID } = await tcClient.submitInscribeTx([commitTxHex, revealTxHex]);
  // console.log("btcTxID: ", btcTxID);

  return {
    commitTxHex,
    commitTxID,
    revealTxHex,
    revealTxID,
    totalFee: new BigNumber(totalFee),
    selectedUTXOs: selectedUTXOs,
    newUTXOs: newUTXOs,
  };
};

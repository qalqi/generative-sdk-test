import * as bitcoin from 'bitcoinjs-lib';

import BIP32Factory, { BIP32Interface } from 'bip32';
import { Taptree } from 'bitcoinjs-lib/src/types';
import {
  Network,
  NetworkType,
  generateTaprootKeyPair,
  mnemonicToTaprootPrivateKey,
  setBTCNetwork,
  toXOnly,
} from '.';

const generateTaprootAddress = (
  node: BIP32Interface,
  network: bitcoin.Network = bitcoin.networks.bitcoin
): [bitcoin.payments.Payment, bitcoin.Signer, Buffer] => {
  const xOnlyPubKey = node.publicKey.slice(1, 33);
  const paymentAddress = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubKey,
    network,
  });
  const signer = node.tweak(bitcoin.crypto.taggedHash('TapTweak', xOnlyPubKey));

  return [paymentAddress, signer, xOnlyPubKey];
};

export const splitByNChars = (str: string, n: number): string[] => {
  const result = [];
  let i = 0;
  const len = str.length;

  while (i < len) {
    result.push(str.substr(i, n));
    i += n;
  }

  return result;
};

export interface CardinalUTXO {
  status: string; // for now always mined
  txId: string;
  index: number;
  value: number;
  script: string;
  address: string;
  blockHeight: number;
  type: string;
  inscriptions: never;
}

export interface Inscription {
  id: string;
  genesisFee: number;
  genesisHeight: number;
  number: number;
  satpoint: string;
  timestamp: number;
}
export interface OrdinalUTXO {
  status: string; // for now always mined
  txId: string;
  index: number;
  value: number;
  script: string;
  address: string;
  blockHeight: number;
  type: string;
  inscriptions: Array<Inscription>;
}

export const generateRevealAddress = (
  xOnlyPubKey: Buffer,
  mimeType: string,
  hexData: string,
  network: bitcoin.Network
): {
  p2tr: bitcoin.Payment;
  tapLeafScript: {
    leafVersion: number;
    script: Buffer;
    controlBlock: Buffer;
  };
} => {
  let inscribeLockScript = bitcoin.script.fromASM(
    `${xOnlyPubKey.toString('hex')} OP_CHECKSIG OP_0 OP_IF ${Buffer.from('ord').toString(
      'hex'
    )} OP_1 ${Buffer.from(mimeType).toString('hex')} OP_0 ${splitByNChars(hexData, 1040).join(
      ' '
    )} OP_ENDIF`
  );

  inscribeLockScript = Buffer.from(
    inscribeLockScript.toString('hex').replace('6f726451', '6f72640101'),
    'hex'
  );

  const scriptTree: Taptree = {
    output: inscribeLockScript,
  };

  const inscribeLockRedeem = {
    output: inscribeLockScript,
    redeemVersion: 192,
  };
  const inscribeP2tr = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubKey,
    scriptTree,
    network,
    redeem: inscribeLockRedeem,
  });

  const tapLeafScript = {
    leafVersion: inscribeLockRedeem.redeemVersion!,
    script: inscribeLockRedeem.output || Buffer.from(''),
    controlBlock: inscribeP2tr.witness![inscribeP2tr.witness!.length - 1],
  };

  return {
    p2tr: inscribeP2tr,
    tapLeafScript,
  };
};

const utxoToPSBTInput = (input: CardinalUTXO | OrdinalUTXO, xOnlyPubKey: Buffer) => {
  return {
    hash: input.txId,
    index: input.index,
    witnessUtxo: {
      script: Buffer.from(input.script, 'hex'),
      value: input.value,
    },
    tapInternalKey: xOnlyPubKey,
  };
};

export const getInscribeCommitTx = (
  inputs: Array<CardinalUTXO>,
  committerAddress: string,
  revealerAddress: string,
  revealCost: number,
  change: number,
  xOnlyPubKey: Buffer,
  serviceFee: number,
  serviceFeeReceiver: string,
  network: bitcoin.Network
): bitcoin.Psbt => {
  if (inputs.length === 0) throw new Error('Not enough funds');

  let outputs = [
    {
      address: revealerAddress,
      value: revealCost,
    },
  ];

  if (change !== 0) {
    outputs.push({
      address: committerAddress,
      value: change,
    });
  }

  if (serviceFee > 0) {
    outputs.push({
      value: serviceFee,
      address: serviceFeeReceiver,
    });
  }

  const psbt = new bitcoin.Psbt({ network });

  inputs.forEach((input) => {
    psbt.addInput(utxoToPSBTInput(input, xOnlyPubKey));
  });

  outputs.forEach((output) => {
    psbt.addOutput(output);
  });

  return psbt;
};

const btc_inscribe = async (
  senderMnemonic: string,
  mimeType: string,
  data: string,
  websiteFeeReceiver: string | null,
  websiteFeeInSats: number | null,
  inscriptionReceiver: string | null
): Promise<{ commit: string; reveal: string }> => {
  try {
    const isTestNet = false;
    const senderPrivateKey = await mnemonicToTaprootPrivateKey(senderMnemonic, isTestNet);
    setBTCNetwork(isTestNet ? NetworkType.Testnet : NetworkType.Mainnet);

    const { keyPair, ...rest } = generateTaprootKeyPair(senderPrivateKey);
    console.log('address', rest.senderAddress);
    // const { keyPair, p2pktr, senderAddress } = generateTaprootKeyPair(senderPrivateKey);
    const internalPubKey = toXOnly(keyPair.publicKey);

    // TODO: figure out why BUffer.from is needed
    const { p2tr: revealAddress, tapLeafScript } = generateRevealAddress(
      Buffer.from(internalPubKey),
      mimeType,
      data,
      Network
    );
    const signer = rest.tweakedSigner;

    /*  const commitPSBT = getInscribeCommitTx(
          chosenUTXOs,
          address,
          revealAddress.address,
          revealCost,
          change,
          Buffer.from(internalPubKey),
          serviceFee.feeAmount,
          serviceFee.feeReceiver,
          network
        );
        const commitTx = signPSBTFromWallet(signer, commitPSBT);
  
        const revealPSBT = getInscribeRevealTx(
          commitTx.getHash(),
          0,
          revealCost,
          postageSize,
          inscriptionReceiver,
          revealAddress.output,
          revealAddress.internalPubkey,
          tapLeafScript,
          websiteFeeReceiver,
          websiteFeeInSats,
          Network
        );
  
        const revealTx = signPSBTFromWallet(walletNode, revealPSBT);
   */
    // const transactions = [commitTx.toHex(), revealTx.toHex()];
    //const { txHashes } = await postMultipleTransactions(transactions);
    // console.log('send btc hash', txHashes);

    // // TODO: hold memmpool dependencies system
    // chosenUTXOs.forEach((utxo) => {
    //   dispatch(
    //     addSpentCardinalUTXO({
    //       txId: utxo.txId,
    //       index: utxo.index,
    //       value: utxo.value,
    //     })
    //   );
    // });

    // if (change > 0) {
    //   dispatch(
    //     addUncofirmedCardinalUTXO({
    //       txId: commitTx.getId(),
    //       index: 1,
    //       value: change,
    //     })
    //   );
    // }

    return { commit: 'commitTx.getId()', reveal: 'revealTx.getId()' }; 
    // return { commit: commitTx.getId(), reveal: revealTx.getId() };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

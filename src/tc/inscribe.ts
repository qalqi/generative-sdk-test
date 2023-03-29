import { BNZero, MinSats, network } from "../bitcoin/constants";
import { ECPair, generateTaprootAddressFromPubKey, generateTaprootKeyPair, toXOnly, tweakSigner } from "../bitcoin/wallet";
import { Inscription, SDKError, UTXO, createTxSendBTC, estimateTxFee, selectCardinalUTXOs, signPSBT } from "..";
import { Psbt, payments, script } from "bitcoinjs-lib";
import { Tapleaf, Taptree } from "bitcoinjs-lib/src/types";

import BigNumber from "bignumber.js";
import { ECPairInterface } from "ecpair";
import { ERROR_CODE } from "../constants/error";
import { randomBytes } from "crypto";
import { witnessStackToScriptWitness } from "./witness_stack_to_script_witness";

const ProtocolID = "bvmv1";

const remove0x = (data: string): string => {
    if (data.startsWith("0x")) data = data.slice(2);
    return data;
};

function generateInscribeContent(protocolID: string, reimbursementAddr: string, datas: string[]): string {
    let content = Buffer.from(protocolID);
    reimbursementAddr = remove0x(reimbursementAddr);
    const addressBytes = Buffer.from(reimbursementAddr, "hex");
    content = Buffer.concat([content, addressBytes]);

    for (let data of datas) {
        data = remove0x(data);
        const len = data.length;

        const lenBuf = Buffer.allocUnsafe(4);
        lenBuf[0] = len >> 24;
        lenBuf[1] = len >> 16;
        lenBuf[2] = len >> 8;
        lenBuf[3] = len;

        content = Buffer.concat([content, lenBuf, Buffer.from(data, "hex")]);
    }

    const chunkSize = 512;
    let dataHex = "";
    for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.subarray(i, i + chunkSize);
        dataHex += chunk.toString("hex") + " ";
    }

    return dataHex.trim();
}

const createRawCommitTx = ({
    internalPubKey,
    data,
    utxos,
    feeRatePerByte,
    reImbursementTCAddress,
    hashLockKeyPair, hashLockRedeem, hashLockScript,

    script_p2tr,
    revealVByte,
}: {
    internalPubKey: Buffer,
    data: string[],
    utxos: UTXO[],
    feeRatePerByte: number,
    reImbursementTCAddress: string,
    hashLockKeyPair: ECPairInterface,
    hashLockRedeem: Tapleaf,
    hashLockScript: Buffer,
    script_p2tr: payments.Payment,
    revealVByte: number,
}): {
    commitTxB64: string,
} => {

    // const hash_lock_privkey = "KwsMY7zgHQ3DobYpto3HFkkTh8k5Pw5FL3d8pLAqSSntF4c8WG8p";
    // const hash_lock_keypair = ECPair.fromWIF(hash_lock_privkey);
    const { address: p2pktr_addr, p2pktr: p2pk_p2tr } = generateTaprootAddressFromPubKey(internalPubKey);
    console.log("prepare inscribe event", data);

    // const dataHex = generateInscribeContent(ProtocolID, reImbursementTCAddress, data);
    // console.log("dataHex: ", dataHex);
    // Construct script to pay to hash_lock_keypair if the correct preimage/secret is provided

    // const hash_lock_script = hashLockScript;
    // console.log("hash_lock_script: ", hash_lock_script);


    const scriptTree: Taptree = hashLockRedeem;
    console.log("scriptTree: ", scriptTree);

    // const script_p2tr = payments.p2tr({
    //     internalPubkey: internalPubKey,
    //     scriptTree,
    //     redeem: hash_lock_redeem,
    //     network
    // });

    console.log("Script witnesss: ", script_p2tr.witness);

    const script_addr = script_p2tr.address ?? "";
    // let utxos = await waitUntilUTXO(p2pktr_addr)
    // const revealVByte = getRevealVirtualSize(hash_lock_redeem, script_p2tr, p2pktr_addr, hash_lock_keypair);

    /*
    =============================   COMMIT TX ==================================
    */
    let commitTX;
    //try to generate commit tx with target fee rate
    for (let nTry = 0; nTry < 100; nTry++) {
        const numberUTXO = nTry + 1;
        if (utxos.length < numberUTXO) {
            console.log("Not enough utxo");
        }
        // fake
        const { tweakedSigner: fakeSigner, keyPair: fakeKeyPair } = generateTaprootKeyPair(randomBytes(32));
        const commitVByte = getCommitVirtualSize(p2pk_p2tr, fakeKeyPair, script_addr, fakeSigner, utxos, numberUTXO, revealVByte, feeRatePerByte);
        //total fee for both commit and reveal
        const totalFee = new BigNumber((revealVByte + commitVByte) * feeRatePerByte + 1000);
        //select output
        let inputValue = BNZero;
        const useUTXO: UTXO[] = [];
        for (let i = 0; i < utxos.length; i++) {
            inputValue = inputValue.plus(utxos[i].value);
            useUTXO.push(utxos[i]);
            if (inputValue.gte(totalFee)) {
                break;
            }
        }

        const p2pk_psbt = new Psbt({ network });
        //get change if the value is greater than 1000
        p2pk_psbt.addOutput({
            address: script_addr,
            value: revealVByte * feeRatePerByte + 1000
        });

        if (inputValue.minus(totalFee).toNumber() > 1000) {
            p2pk_psbt.addOutput({
                address: p2pktr_addr,
                value: inputValue.minus(totalFee).toNumber(),
            });
        }

        for (let i = 0; i < useUTXO.length; i++) {
            p2pk_psbt.addInput({
                hash: useUTXO[i].tx_hash,
                index: useUTXO[i].tx_output_n,
                witnessUtxo: { value: useUTXO[i].value.toNumber(), script: p2pk_p2tr.output! },
                tapInternalKey: internalPubKey
            });
        }

        return { commitTxB64: p2pk_psbt.toBase64(), };

    }



    // console.log("COMMIT PSBT B64: ", p2pk_psbt.toBase64());

    // for (let i = 0; i < useUTXO.length; i++) {
    //     p2pk_psbt.signInput(i, tweakedSigner);
    // }

    // p2pk_psbt.finalizeAllInputs();
    // commitTX = p2pk_psbt.extractTransaction();
    // if (commitTX.virtualSize() == commitVByte) {
    //     console.log("Commit tx expect fee rate ", feeRatePerByte);
    //     break;
    // }



    throw new SDKError(ERROR_CODE.CREATE_COMMIT_TX_ERR);


};


const createRawRevealTx = ({
    internalPubKey,
    feeRatePerByte,
    commitTxID,
    hashLockKeyPair,
    hashLockRedeem,
    script_p2tr,
    revealVByte
}: {
    internalPubKey: Buffer,
    feeRatePerByte: number,
    commitTxID: string,
    revealVByte: number,
    hashLockKeyPair: ECPairInterface,
    hashLockRedeem: any,
    script_p2tr: payments.Payment,
}): { revealTxHex: string, revealTxID: string } => {
    const { p2pktr, address: p2pktr_addr } = generateTaprootAddressFromPubKey(internalPubKey);

    // const hashLockScript = Buffer.from(hashLockRedeemScriptHex, "hex");
    // const hash_lock_redeem = {
    //     output: hashLockScript,
    //     redeemVersion: 192,
    // };

    // const scriptTree: Taptree = hash_lock_redeem;

    // const script_p2tr = payments.p2tr({
    //     internalPubkey: internalPubKey,
    //     scriptTree,
    //     redeem: hashLockRedeem,
    //     network
    // });

    const tapLeafScript = {
        leafVersion: hashLockRedeem?.redeemVersion,
        script: hashLockRedeem?.output,
        controlBlock: script_p2tr.witness![script_p2tr.witness!.length - 1]
    };


    const psbt = new Psbt({ network });
    psbt.addInput({
        hash: commitTxID,
        index: 0,
        witnessUtxo: { value: revealVByte * feeRatePerByte + 1000, script: script_p2tr.output! },
        tapLeafScript: [
            tapLeafScript
        ]
    });

    psbt.addOutput({
        address: p2pktr_addr,
        value: 1000
    });


    // const hash_lock_keypair = ECPair.fromWIF(hashLockPriKey);
    psbt.signInput(0, hashLockKeyPair);

    // We have to construct our witness script in a custom finalizer
    const customFinalizer = (_inputIndex: number, input: any) => {
        const scriptSolution = [
            input.tapScriptSig[0].signature,
        ];
        const witness = scriptSolution
            .concat(tapLeafScript.script)
            .concat(tapLeafScript.controlBlock);

        return {
            finalScriptWitness: witnessStackToScriptWitness(witness)
        };
    };

    psbt.finalizeInput(0, customFinalizer);
    const revealTX = psbt.extractTransaction();

    return { revealTxHex: revealTX.toHex(), revealTxID: revealTX.getId() };

};

const start_taptree = async (
    {
        privateKey,
        data,
        utxos,
        feeRatePerByte,
        reImbursementTCAddress,
    }: {
        privateKey: Buffer,
        data: string[],
        utxos: UTXO[],
        feeRatePerByte: number,
        reImbursementTCAddress: string
    }

): (Promise<{
    commitTxHex: string,
    revealTxHex: string,
}>) => {
    // Create a tap tree with two spend paths
    // One path should allow spending using secret
    // The other path should pay to another pubkey

    // Make random key for hash_lock
    // Generate an address from the tweaked public key
    // const tweakedSigner = tweakSigner(keypair, { network });

    // const p2pktr = payments.p2tr({
    //     pubkey: toXOnly(tweakedSigner.publicKey),
    //     network
    // });
    // const p2pktr_addr = p2pktr.address ?? "";
    // console.log(p2pktr_addr)

    const { tweakedSigner, keyPair, p2pktr, senderAddress: p2pktr_addr } = generateTaprootKeyPair(privateKey);

    const hash_lock_keypair = ECPair.makeRandom({ network });
    console.log("prepare inscribe event", data);

    const dataHex = generateInscribeContent(ProtocolID, reImbursementTCAddress, data);
    console.log("dataHex: ", dataHex);
    // Construct script to pay to hash_lock_keypair if the correct preimage/secret is provided
    const hash_script_asm = `${toXOnly(hash_lock_keypair.publicKey).toString("hex")} OP_CHECKSIG OP_FALSE OP_IF ${Buffer.from("sbtc").toString("hex")} ${dataHex} OP_ENDIF`;
    const hash_lock_script = script.fromASM(hash_script_asm);

    const hash_lock_redeem = {
        output: hash_lock_script,
        redeemVersion: 192,
    };

    const scriptTree: Taptree = hash_lock_redeem;

    const script_p2tr = payments.p2tr({
        internalPubkey: toXOnly(keyPair.publicKey),
        scriptTree,
        redeem: hash_lock_redeem,
        network
    });

    const script_addr = script_p2tr.address ?? "";

    const p2pk_p2tr = payments.p2tr({
        internalPubkey: toXOnly(keyPair.publicKey),
        network
    });

    // let utxos = await waitUntilUTXO(p2pktr_addr)
    const revealVByte = getRevealVirtualSize(hash_lock_redeem, script_p2tr, p2pktr_addr, hash_lock_keypair);

    /*
    =============================   COMMIT TX ==================================
    */
    let commitTX;
    //try to generate commit tx with target fee rate
    for (let nTry = 0; nTry < 100; nTry++) {
        const numberUTXO = nTry + 1;
        if (utxos.length < numberUTXO) {
            console.log("Not enough utxo");
        }
        const commitVByte = getCommitVirtualSize(p2pk_p2tr, keyPair, script_addr, tweakedSigner, utxos, numberUTXO, revealVByte, feeRatePerByte);
        //total fee for both commit and reveal
        const totalFee = new BigNumber((revealVByte + commitVByte) * feeRatePerByte + 1000);
        //select output
        let inputValue = BNZero;
        const useUTXO: UTXO[] = [];
        for (let i = 0; i < utxos.length; i++) {
            inputValue = inputValue.plus(utxos[i].value);
            useUTXO.push(utxos[i]);
            if (inputValue.gte(totalFee)) {
                break;
            }
        }

        const p2pk_psbt = new Psbt({ network });
        //get change if the value is greater than 1000
        p2pk_psbt.addOutput({
            address: script_addr,
            value: revealVByte * feeRatePerByte + 1000
        });

        if (inputValue.minus(totalFee).toNumber() > 1000) {
            p2pk_psbt.addOutput({
                address: p2pktr_addr,
                value: inputValue.minus(totalFee).toNumber(),
            });
        }

        for (let i = 0; i < useUTXO.length; i++) {
            p2pk_psbt.addInput({
                hash: useUTXO[i].tx_hash,
                index: useUTXO[i].tx_output_n,
                witnessUtxo: { value: useUTXO[i].value.toNumber(), script: p2pk_p2tr.output! },
                tapInternalKey: toXOnly(keyPair.publicKey)
            });
        }

        console.log("COMMIT PSBT B64: ", p2pk_psbt.toBase64());

        for (let i = 0; i < useUTXO.length; i++) {
            p2pk_psbt.signInput(i, tweakedSigner);
        }

        p2pk_psbt.finalizeAllInputs();
        commitTX = p2pk_psbt.extractTransaction();
        if (commitTX.virtualSize() == commitVByte) {
            console.log("Commit tx expect fee rate ", feeRatePerByte);
            break;
        }
    }

    if (!commitTX) {
        throw new SDKError(ERROR_CODE.CREATE_COMMIT_TX_ERR);
    }
    /*
    =============================   REVEAL TX ==================================
    */

    const tapLeafScript = {
        leafVersion: hash_lock_redeem.redeemVersion,
        script: hash_lock_redeem.output,
        controlBlock: script_p2tr.witness![script_p2tr.witness!.length - 1]
    };

    const psbt = new Psbt({ network });
    psbt.addInput({
        hash: commitTX.getId(),
        index: 0,
        witnessUtxo: { value: revealVByte * feeRatePerByte + 1000, script: script_p2tr.output! },
        tapLeafScript: [
            tapLeafScript
        ]
    });

    psbt.addOutput({
        address: p2pktr_addr,
        value: 1000
    });

    psbt.signInput(0, hash_lock_keypair);

    // We have to construct our witness script in a custom finalizer

    const customFinalizer = (_inputIndex: number, input: any) => {
        const scriptSolution = [
            input.tapScriptSig[0].signature,
        ];
        const witness = scriptSolution
            .concat(tapLeafScript.script)
            .concat(tapLeafScript.controlBlock);

        return {
            finalScriptWitness: witnessStackToScriptWitness(witness)
        };
    };

    psbt.finalizeInput(0, customFinalizer);

    const revealTX = psbt.extractTransaction();

    // console.log(`Broadcasting Transaction Hex: ${tx.toHex()}`);
    // await broadcast(commitTX.toHex());
    // await broadcast(revealTX.toHex());
    console.log(`Success! Commit is ${commitTX.getId()} VirtualSize: ${commitTX.virtualSize()}`);
    console.log(`Success! Reveal is ${revealTX.getId()} VirtualSize: ${revealTX.virtualSize()}`);
    // execSync(`bitcoin-core.cli -regtest -rpcwallet=Test -rpccookiefile=${COOKIE} -generate 1`)

    return {
        commitTxHex: commitTX.toHex(),
        revealTxHex: revealTX.toHex(),
    };
};

function getRevealVirtualSize(hash_lock_redeem: any, script_p2tr: any, p2pktr_addr: any, hash_lock_keypair: any) {
    const tapLeafScript = {
        leafVersion: hash_lock_redeem.redeemVersion,
        script: hash_lock_redeem.output,
        controlBlock: script_p2tr.witness![script_p2tr.witness!.length - 1]
    };

    const psbt = new Psbt({ network });
    psbt.addInput({
        hash: "00".repeat(32),
        index: 0,
        witnessUtxo: { value: 1, script: script_p2tr.output! },
        tapLeafScript: [
            tapLeafScript
        ]
    });

    psbt.addOutput({
        address: p2pktr_addr,
        value: 1
    });

    psbt.signInput(0, hash_lock_keypair);

    // We have to construct our witness script in a custom finalizer

    const customFinalizer = (_inputIndex: number, input: any) => {
        const scriptSolution = [
            input.tapScriptSig[0].signature,
        ];
        const witness = scriptSolution
            .concat(tapLeafScript.script)
            .concat(tapLeafScript.controlBlock);

        return {
            finalScriptWitness: witnessStackToScriptWitness(witness)
        };
    };

    psbt.finalizeInput(0, customFinalizer);

    const tx = psbt.extractTransaction();
    return tx.virtualSize();
}

function getCommitVirtualSize(p2pk_p2tr: any, keypair: any, script_addr: any, tweakedSigner: any, utxos: any, numberUTXO: any, revealVByte: any, fee_rate: any) {
    //select output
    let inputValue = BNZero;
    const useUTXO: UTXO[] = [];
    for (let i = 0; i < numberUTXO; i++) {
        inputValue = inputValue.plus(utxos[i].value);
        useUTXO.push(utxos[i]);
    }
    const p2pk_psbt = new Psbt({ network });
    p2pk_psbt.addOutput({
        address: script_addr,
        value: inputValue.minus(1).toNumber(),
    });
    p2pk_psbt.addOutput({
        address: script_addr,
        value: 1
    });
    for (let i = 0; i < useUTXO.length; i++) {
        p2pk_psbt.addInput({
            hash: useUTXO[i].tx_hash,
            index: useUTXO[i].tx_output_n,
            witnessUtxo: { value: useUTXO[i].value.toNumber(), script: p2pk_p2tr.output! },
            tapInternalKey: toXOnly(keypair.publicKey)
        });
    }

    for (let i = 0; i < useUTXO.length; i++) {
        p2pk_psbt.signInput(i, tweakedSigner);
    }

    p2pk_psbt.finalizeAllInputs();

    const commitTX = p2pk_psbt.extractTransaction();
    return commitTX.virtualSize();
}

/**
* createInscribeTx creates commit and reveal tx to inscribe data on Bitcoin netword. 
* NOTE: Currently, the function only supports sending from Taproot address. 
* @param senderPrivateKey buffer private key of the inscriber
* @param utxos list of utxos (include non-inscription and inscription utxos)
* @param inscriptions list of inscription infos of the sender
* @param data list of hex data need to inscribe
* @param reImbursementTCAddress TC address of the inscriber to receive gas.
* @param feeRatePerByte fee rate per byte (in satoshi)
* @returns the hex commit transaction
* @returns the commit transaction id
* @returns the hex reveal transaction
* @returns the reveal transaction id
* @returns the total network fee
*/
const createInscribeTx = ({
    senderPrivateKey,
    utxos,
    inscriptions,
    data,
    reImbursementTCAddress,
    feeRatePerByte,

}: {
    senderPrivateKey: Buffer,
    utxos: UTXO[],
    inscriptions: { [key: string]: Inscription[] },
    data: string[],
    reImbursementTCAddress: string,
    feeRatePerByte: number,
}): {
    commitTxHex: string,
    commitTxID: string,
    revealTxHex: string,
    revealTxID: string,
} => {

    const { keyPair, p2pktr, senderAddress } = generateTaprootKeyPair(senderPrivateKey);
    const internalPubKey = toXOnly(keyPair.publicKey);

    // create lock script for commit tx
    const { hashLockKeyPair, hashLockRedeem, hashLockScript, hashScriptAsm, script_p2tr } = createLockScript({
        internalPubKey,
        data,
        reImbursementTCAddress
    });

    // estimate fee and select UTXOs

    const estCommitTxFee = estimateTxFee(1, 2, feeRatePerByte);

    const revealVByte = getRevealVirtualSize(hashLockRedeem, script_p2tr, senderAddress, hashLockKeyPair);
    const estRevealTxFee = revealVByte * feeRatePerByte;
    const totalFee = estCommitTxFee + estRevealTxFee;
    const totalAmount = new BigNumber(totalFee + MinSats); // MinSats for new output in the reveal tx

    const { selectedUTXOs, totalInputAmount } = selectCardinalUTXOs(utxos, inscriptions, totalAmount);

    if (script_p2tr.address === undefined || script_p2tr.address === "") {
        throw new SDKError(ERROR_CODE.INVALID_TAPSCRIPT_ADDRESS, "");
    }

    const { txHex: commitTxHex, txID: commitTxID, fee: commitTxFee, changeAmount } = createTxSendBTC({
        senderPrivateKey,
        utxos,
        inscriptions,
        paymentInfos: [{ address: script_p2tr.address || "", amount: new BigNumber(estRevealTxFee + MinSats) }],
        feeRatePerByte,
    });





    // create raw commit tx
    // const { commitTxB64, hashLockPriKey, hashLockRedeemScriptHex } = createRawCommitTx({
    //     internalPubKey,
    //     data,
    //     utxos,
    //     feeRatePerByte,
    //     reImbursementTCAddress,
    //     hashLockKeyPair, hashLockRedeem, hashLockScript,
    //     script_p2tr
    // });

    // // sign and finalize commit tx
    // const { msgTxHex: commitTxHex, msgTxID: commitTxID } = signPSBT({
    //     senderPrivateKey,
    //     psbtB64: commitTxB64,
    //     indicesToSign: [],
    // });

    // create and sign reveal tx
    const { revealTxHex, revealTxID } = createRawRevealTx({
        internalPubKey,
        feeRatePerByte,
        commitTxID,
        hashLockKeyPair,
        hashLockRedeem,
        script_p2tr,
        revealVByte
    });

    return {
        commitTxHex,
        commitTxID,
        revealTxHex,
        revealTxID
    };
};

const createLockScript = ({
    internalPubKey,
    data,
    reImbursementTCAddress,
}: {
    internalPubKey: Buffer,
    data: string[],
    reImbursementTCAddress: string
}): {
    hashLockKeyPair: ECPairInterface,
    hashScriptAsm: string,
    hashLockScript: Buffer,
    hashLockRedeem: Tapleaf,
    script_p2tr: payments.Payment,

} => {
    // const { address: p2pktr_addr } = generateTaprootAddressFromPubKey(internalPubKey);
    const hashLockKeyPair = ECPair.makeRandom({ network });
    console.log("prepare inscribe event", data);

    const dataHex = generateInscribeContent(ProtocolID, reImbursementTCAddress, data);
    console.log("dataHex: ", dataHex);
    // Construct script to pay to hash_lock_keypair if the correct preimage/secret is provided
    const hashScriptAsm = `${toXOnly(hashLockKeyPair.publicKey).toString("hex")} OP_CHECKSIG OP_FALSE OP_IF ${dataHex} OP_ENDIF`;
    console.log("hash_script_asm: ", hashScriptAsm);
    const hashLockScript = script.fromASM(hashScriptAsm);
    console.log("hash_lock_script: ", hashLockScript);

    const hashLockRedeem = {
        output: hashLockScript,
        redeemVersion: 192,
    };

    const scriptTree: Taptree = hashLockRedeem;
    console.log("scriptTree: ", scriptTree);

    const script_p2tr = payments.p2tr({
        internalPubkey: internalPubKey,
        scriptTree,
        redeem: hashLockRedeem,
        network
    });

    console.log("Script witnesss: ", script_p2tr.witness);

    // const script_addr = script_p2tr.address ?? "";

    // const p2pk_p2tr = payments.p2tr({
    //     internalPubkey: internalPubKey,
    //     network
    // });

    return {
        hashLockKeyPair,
        hashScriptAsm,
        hashLockScript,
        hashLockRedeem,
        script_p2tr
    };
};

export {
    start_taptree,
    generateInscribeContent,
    createRawRevealTx,
    createRawCommitTx,
    createInscribeTx
};
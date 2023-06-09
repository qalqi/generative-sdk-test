import BigNumber from "bignumber.js";
/**
* estimateInscribeFee estimate BTC amount need to inscribe for creating project.
* NOTE: Currently, the function only supports sending from Taproot address.
* @param htmlFileSizeByte size of html file from user (in byte)
* @param feeRatePerByte fee rate per byte (in satoshi)
* @returns the total BTC fee
*/
declare const estimateInscribeFee: ({ htmlFileSizeByte, feeRatePerByte, }: {
    htmlFileSizeByte: number;
    feeRatePerByte: number;
}) => {
    totalFee: BigNumber;
};
export { estimateInscribeFee, };

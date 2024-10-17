import { ErrorCode, ErrorUtils, TxType, hexToBytes, trimHexPrefix, ixObjectSchema, LockType } from "js-moi-utils";
import { serializePayload } from "js-moi-providers";
import { ZERO_ADDRESS } from "js-moi-constants";
import { Polorizer } from "js-polo";
/**
 * Processes the interaction object to extract and consolidate asset funds from
 * transactions and asset funds.
 *
 * @param {InteractionObject} ixObject - The interaction object containing transactions and asset funds.
 * @returns {ProcessedIxAssetFund[]} - The consolidated list of processed asset funds.
 */
const processFunds = (ixObject) => {
    const assetFunds = new Map();
    ixObject.transactions.forEach(transaction => {
        switch (transaction.type) {
            case TxType.ASSET_TRANSFER:
            case TxType.ASSET_BURN: {
                const payload = transaction.payload;
                const amount = assetFunds.get(payload.asset_id) ?? 0;
                if (typeof payload.amount === "bigint" || typeof amount === "bigint") {
                    assetFunds.set(trimHexPrefix(payload.asset_id), BigInt(payload.amount) + BigInt(amount));
                    return;
                }
                assetFunds.set(trimHexPrefix(payload.asset_id), Number(payload.amount) + Number(amount));
            }
        }
    });
    if (ixObject.funds != null) {
        // Add additional asset funds to the list if not present
        ixObject.funds.forEach(assetFund => {
            if (!assetFunds.has(trimHexPrefix(assetFund.asset_id))) {
                assetFunds.set(trimHexPrefix(assetFund.asset_id), assetFund.amount);
            }
        });
    }
    return Array.from(assetFunds, ([asset_id, amount]) => ({ asset_id, amount }));
};
/**
 * Processes a series of transactions and returns an array of processed participants.
 * Each participant is derived based on the type of transaction and its associated payload.
 *
 * @param {IxTransaction[]} steps - The array of transaction steps to process.
 * @returns {ProcessedIxParticipant[]} - The array of processed participants.
 * @throws {Error} - Throws an error if an unsupported transaction type is encountered.
 */
const processParticipants = (ixObject) => {
    const participants = new Map();
    // Add sender to participants
    participants.set(trimHexPrefix(ixObject.sender), {
        address: hexToBytes(ixObject.sender),
        lock_type: LockType.MUTATE_LOCK
    });
    // Add payer if it exists
    if (ixObject.payer != null) {
        participants.set(trimHexPrefix(ixObject.payer), {
            address: hexToBytes(ixObject.payer),
            lock_type: LockType.MUTATE_LOCK
        });
    }
    // Process transactions and add participants
    ixObject.transactions.forEach((transaction) => {
        switch (transaction.type) {
            case TxType.ASSET_CREATE:
                break;
            case TxType.ASSET_MINT:
            case TxType.ASSET_BURN: {
                const assetSupplyPayload = transaction.payload;
                const address = trimHexPrefix(assetSupplyPayload.asset_id).slice(8);
                participants.set(address, {
                    address: hexToBytes(address),
                    lock_type: LockType.MUTATE_LOCK
                });
                break;
            }
            case TxType.ASSET_TRANSFER: {
                const assetActionPayload = transaction.payload;
                participants.set(assetActionPayload.beneficiary, {
                    address: hexToBytes(assetActionPayload.beneficiary),
                    lock_type: LockType.MUTATE_LOCK
                });
                break;
            }
            case TxType.LOGIC_DEPLOY:
                break;
            case TxType.LOGIC_ENLIST:
            case TxType.LOGIC_INVOKE: {
                const logicPayload = transaction.payload;
                const address = trimHexPrefix(logicPayload.logic_id).slice(6);
                participants.set(address, {
                    address: hexToBytes(address),
                    lock_type: LockType.MUTATE_LOCK
                });
                break;
            }
            default:
                ErrorUtils.throwError("Unsupported Ix type", ErrorCode.INVALID_ARGUMENT);
        }
    });
    // Add additional participants if they exist
    if (ixObject.participants != null) {
        ixObject.participants.forEach((participant) => {
            const address = trimHexPrefix(participant.address);
            if (!participants.has(address)) {
                participants.set(address, {
                    address: hexToBytes(participant.address),
                    lock_type: participant.lock_type
                });
            }
        });
    }
    return Array.from(participants.values());
};
/**
 * Processes an array of transactions by serializing their payloads into byte form
 * and returns the processed transactions.
 *
 * @param {IxTransaction[]} transactions - Transactions to process.
 * @returns {ProcessedIxTransaction[]} - Processed transactions with serialized payloads.
 * @throws {Error} - If the payload is missing or transaction type is unsupported.
 */
const processTransactions = (transactions) => {
    return transactions.map(transaction => {
        if (!transaction.payload) {
            ErrorUtils.throwError("Payload is missing!", ErrorCode.MISSING_ARGUMENT);
        }
        const payload = serializePayload(transaction.type, transaction.payload);
        return { ...transaction, payload };
    });
};
/**
 * Processes the interaction object based on its type and returns the processed object.
 *
 * @param {InteractionObject} ixObject - The interaction object to be processed.
 * @returns {ProcessedIxObject} - The processed interaction object.
 * @throws {Error} - Throws an error if the interaction type is unsupported or if there is a missing payload.
 */
const processIxObject = (ixObject) => {
    try {
        return {
            sender: hexToBytes(ixObject.sender),
            payer: hexToBytes(ZERO_ADDRESS),
            nonce: ixObject.nonce,
            fuel_price: ixObject.fuel_price,
            fuel_limit: ixObject.fuel_limit,
            funds: processFunds(ixObject),
            transactions: processTransactions(ixObject.transactions),
            participants: processParticipants(ixObject),
        };
    }
    catch (err) {
        ErrorUtils.throwError("Failed to process interaction object", ErrorCode.UNKNOWN_ERROR, { originalError: err });
    }
};
/**
 * POLO encodes an interaction object into a Uint8Array representation.
 *
 * @param {InteractionObject} ixObject - The interaction object to be encoded.
 * @returns {Uint8Array} The encoded interaction object as a Uint8Array.
 * @throws {Error} if there is an error during encoding or if the payload is missing.
 */
export const serializeIxObject = (ixObject) => {
    try {
        const processedIxObject = processIxObject(ixObject);
        const polorizer = new Polorizer();
        polorizer.polorize(processedIxObject, ixObjectSchema);
        return polorizer.bytes();
    }
    catch (err) {
        ErrorUtils.throwError("Failed to serialize interaction object", ErrorCode.UNKNOWN_ERROR, { originalError: err });
    }
};
//# sourceMappingURL=serializer.js.map
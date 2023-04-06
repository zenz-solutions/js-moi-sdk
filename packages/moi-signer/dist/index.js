/*
    This module/directory is responsible for handling
    cryptographic activity like signing, encryption/Decryption, verification etc
*/
import * as Utils from "./utils";
import * as sr25519 from "./sr25519";
import * as ecdsa from "./ecdsa";
import * as Types from "../types/index";
export default class Signer {
    signingVault;
    sigAlgorithm;
    constructor(vault, sigAlgo) {
        const sigTypeAtts = Utils.getSigTypeAttributes(sigAlgo);
        if (sigTypeAtts[1] !== vault.curve()) {
            throw new Error("given signature algorithm does not support for this curve");
        }
        this.sigAlgorithm = sigTypeAtts[0];
        this.signingVault = vault;
    }
    Sign(message) {
        switch (this.sigAlgorithm) {
            case Types.SCHNORR: {
                return sr25519.Sign(message, this.signingVault);
            }
            case Types.ECDSA: {
                return ecdsa.Sign(message, this.signingVault);
            }
            default: {
                throw new Error("unsupported signature algorithm");
            }
        }
    }
    Verify(message, signature) {
        switch (this.sigAlgorithm) {
            case Types.SCHNORR: {
                return sr25519.Verify(message, signature, this.signingVault.publicKey());
            }
            case Types.ECDSA: {
                return ecdsa.Verify(message, signature, this.signingVault.publicKey());
            }
            default: {
                throw new Error("unsupported signature algorithm");
            }
        }
    }
}

import { Buffer } from "buffer";
import { sha256 } from "@noble/hashes/sha256";
import { sha512 } from "@noble/hashes/sha512";
import { randomBytes } from "@noble/hashes/utils";
import { pbkdf2, pbkdf2Async } from "@noble/hashes/pbkdf2";
import { wordlists, _default } from "./_wordlists";

let DEFAULT_WORDLIST = _default;
let INVALID_MNEMONIC = 'Invalid mnemonic';
let INVALID_ENTROPY = 'Invalid entropy';
let INVALID_CHECKSUM = 'Invalid mnemonic checksum';
let WORDLIST_REQUIRED = 'A wordlist is required but a default could not be found.\n' +
    'Please pass a 2048 word array explicitly.';

function normalize(str: string): string {
    return (str || '').normalize('NFKD');
}

function lpad(str: string, padString: string, length: number): string {
    while (str.length < length) {
        str = padString + str;
    }
    return str;
}

function binaryToByte(bin: string): number {
    return parseInt(bin, 2);
}

function bytesToBinary(bytes: number[]): string {
    return bytes.map((x) => lpad(x.toString(2), '0', 8)).join('');
}

function deriveChecksumBits(entropyBuffer: Uint8Array): string {
    const ENT = entropyBuffer.length * 8;
    const CS = ENT / 32;
    const hash = sha256(Uint8Array.from(entropyBuffer));
    return bytesToBinary(Array.from(hash)).slice(0, CS);
}

function salt(password: string): string {
    return 'mnemonic' + (password || '');
}

export function mnemonicToSeedSync(mnemonic: string, password?: string): Buffer {
    const mnemonicBuffer = Uint8Array.from(Buffer.from(normalize(mnemonic), 'utf8'));
    const saltBuffer = Uint8Array.from(Buffer.from(salt(normalize(password as string)), 'utf8'));
    const res = pbkdf2(sha512, mnemonicBuffer, saltBuffer, {
        c: 2048,
        dkLen: 64,
    });
    return Buffer.from(res);
}

export async function mnemonicToSeed(mnemonic: string, password?: string): Promise<Buffer> {
    try {
        const mnemonicBuffer = Uint8Array.from(Buffer.from(normalize(mnemonic), 'utf8'));
        const saltBuffer = Uint8Array.from(Buffer.from(salt(normalize(password as string)), 'utf8'));
        const res = await pbkdf2Async(sha512, mnemonicBuffer, saltBuffer, {
          c: 2048,
          dkLen: 64,
        });
        
        return Buffer.from(res)
    }catch(e) {
        throw new Error(e.message)
    }
}

export function mnemonicToEntropy(mnemonic: string, wordlist?: string[]): string {
    wordlist = wordlist || DEFAULT_WORDLIST;
    if (!wordlist) {
        throw new Error(WORDLIST_REQUIRED);
    }

    const words = normalize(mnemonic).split(' ');
    if (words.length % 3 !== 0) {
        throw new Error(INVALID_MNEMONIC);
    }

    // convert word indices to 11 bit binary strings
    const bits = words
    .map((word) => {
        const index = wordlist!.indexOf(word);
        if (index === -1) {
            throw new Error(INVALID_MNEMONIC);
        }
        return lpad(index.toString(2), '0', 11);
    })
    .join('');

    const dividerIndex = Math.floor(bits.length / 33) * 32;
    const entropyBits = bits.slice(0, dividerIndex);
    const checksumBits = bits.slice(dividerIndex);
    const entropyBytes = entropyBits.match(/(.{1,8})/g)!.map(binaryToByte);
    if (entropyBytes.length < 16) {
        throw new Error(INVALID_ENTROPY);
    }
    if (entropyBytes.length > 32) {
        throw new Error(INVALID_ENTROPY);
    }
    if (entropyBytes.length % 4 !== 0) {
        throw new Error(INVALID_ENTROPY);
    }
    const entropy = Buffer.from(entropyBytes);
    const newChecksum = deriveChecksumBits(entropy);
    if (newChecksum !== checksumBits) {
        throw new Error(INVALID_CHECKSUM);
    }

    return entropy.toString('hex');
}

export function entropyToMnemonic(entropy: Buffer | string, wordlist?: string[]): string {
    if (!Buffer.isBuffer(entropy)) {
        entropy = Buffer.from(entropy, 'hex');
    }

    wordlist = wordlist || DEFAULT_WORDLIST;
    if (!wordlist) {
        throw new Error(WORDLIST_REQUIRED);
    }
    if (entropy.length < 16) {
        throw new TypeError(INVALID_ENTROPY);
    }
    if (entropy.length > 32) {
        throw new TypeError(INVALID_ENTROPY);
    }
    if (entropy.length % 4 !== 0) {
        throw new TypeError(INVALID_ENTROPY);
    }

    const entropyBits = bytesToBinary(Array.from(entropy));
    const checksumBits = deriveChecksumBits(entropy);
    const bits = entropyBits + checksumBits;
    const chunks = bits.match(/(.{1,11})/g)!;
    const words = chunks.map((binary) => {
        const index = binaryToByte(binary);
        return wordlist![index];
    });

    return wordlist![0] === '\u3042\u3044\u3053\u304f\u3057\u3093' // Japanese wordlist
    ? words.join('\u3000')
    : words.join(' ');
}

export function generateMnemonic(
    strength?: number,
    rng?: (size: number) => Buffer,
    wordlist?: string[]
): string {
    strength = strength || 128;
    if (strength % 32 !== 0) {
        throw new TypeError(INVALID_ENTROPY);
    }
    rng = rng || ((size) => Buffer.from(randomBytes(size)));
    return entropyToMnemonic(rng(strength / 8), wordlist);
}

export function validateMnemonic(mnemonic: string, wordlist?: string[]): boolean {
    try {
        mnemonicToEntropy(mnemonic, wordlist);
    } catch (e) {
        return false;
    }
    return true;
}

export function setDefaultWordlist(language: string): void {
    const result = wordlists.wordlists[language];
    if (result) {
        DEFAULT_WORDLIST = result;
    } else {
        throw new Error('Could not find wordlist for language "' + language + '"');
    }
}

export function getDefaultWordlist(): string {
    if (!DEFAULT_WORDLIST) {
        throw new Error('No Default Wordlist set');
    }
    return Object.keys(wordlists.wordlists).filter((lang) => {
        if (lang === 'JA' || lang === 'EN') {
        return false;
        }
        return wordlists.wordlists[lang].every((word, index) => word === DEFAULT_WORDLIST[index]);
    })[0];
}

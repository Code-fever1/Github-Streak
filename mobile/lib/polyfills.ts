import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import * as ed from '@noble/ed25519';
import { sha1 } from '@noble/hashes/legacy.js';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js';

const g = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  btoa?: (data: string) => string;
  atob?: (data: string) => string;
  crypto: Crypto;
};

if (!g.Buffer) g.Buffer = Buffer;

if (typeof g.btoa !== 'function') {
  g.btoa = (data: string) => Buffer.from(data, 'binary').toString('base64');
}
if (typeof g.atob !== 'function') {
  g.atob = (data: string) => Buffer.from(data, 'base64').toString('binary');
}

function asBytes(data: BufferSource): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

const DIGESTS: Record<string, (msg: Uint8Array) => Uint8Array> = {
  'SHA-1': sha1,
  SHA1: sha1,
  'SHA-256': sha256,
  SHA256: sha256,
  'SHA-384': sha384,
  SHA384: sha384,
  'SHA-512': sha512,
  SHA512: sha512,
};

if (!g.crypto) {
  (g as { crypto: Crypto }).crypto = {} as Crypto;
}

if (typeof g.crypto.getRandomValues !== 'function') {
  throw new Error('crypto.getRandomValues is missing after polyfill');
}

if (!g.crypto.subtle) {
  Object.defineProperty(g.crypto, 'subtle', {
    configurable: true,
    value: {
      digest: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const name = (typeof algorithm === 'string' ? algorithm : algorithm.name).toUpperCase();
        const hasher = DIGESTS[name] ?? DIGESTS[name.replace('_', '-')];
        if (!hasher) throw new Error(`subtle.digest does not support ${name}`);
        return hasher(asBytes(data)).buffer;
      },
    },
  });
}

ed.hashes.sha512 = sha512;
ed.hashes.sha512Async = async (message) => sha512(message);

import { getPublicKeyAsync, utils } from '@noble/ed25519';

export interface SshKeyPair {
  privateKeyPem: string;
  publicKeyOpenSSH: string;
  comment: string;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

function sshString(data: Uint8Array | string): Uint8Array {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const out = new Uint8Array(4 + bytes.length);
  out.set(u32(bytes.length));
  out.set(bytes, 4);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function toB64(data: Uint8Array): string {
  let s = '';
  data.forEach((c) => {
    s += String.fromCharCode(c);
  });
  return btoa(s);
}

function wrap70(b64: string): string {
  return b64.match(/.{1,70}/g)?.join('\n') ?? b64;
}

function randomComment(): string {
  const id = Math.random().toString(36).slice(2, 10);
  return `streak-keeper-${id}`;
}

function encodePublic(publicKey: Uint8Array, comment: string): string {
  const blob = concat(sshString('ssh-ed25519'), sshString(publicKey));
  return `ssh-ed25519 ${toB64(blob)} ${comment}`;
}

function encodePrivate(secretKey: Uint8Array, publicKey: Uint8Array, comment: string): string {
  const magic = new TextEncoder().encode('openssh-key-v1\0');
  const pubBlob = concat(sshString('ssh-ed25519'), sshString(publicKey));
  const check = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1) >>> 0;
  const inner = concat(
    u32(check),
    u32(check),
    sshString('ssh-ed25519'),
    sshString(publicKey),
    sshString(concat(secretKey, publicKey)),
    sshString(comment),
  );
  const padLen = (8 - (inner.length % 8)) % 8;
  const pad = new Uint8Array(padLen);
  for (let i = 0; i < padLen; i++) pad[i] = i + 1;
  const raw = concat(
    magic,
    sshString('none'),
    sshString('none'),
    sshString(new Uint8Array(0)),
    u32(1),
    sshString(pubBlob),
    sshString(concat(inner, pad)),
  );
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${wrap70(toB64(raw))}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

/** New random ed25519 key for this device/user. No Node sshpk. */
export async function generateEd25519KeyPair(): Promise<SshKeyPair> {
  const secretKey = utils.randomSecretKey();
  const publicKey = await getPublicKeyAsync(secretKey);
  const comment = randomComment();
  return {
    privateKeyPem: encodePrivate(secretKey, publicKey, comment),
    publicKeyOpenSSH: encodePublic(publicKey, comment),
    comment,
  };
}

export function deployKeysUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}/settings/keys`;
}

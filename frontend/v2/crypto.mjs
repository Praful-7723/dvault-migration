// The vault key stays in memory. It is independent from the wallet, which
// authorizes registry writes. Domain-specific AAD binds payloads to their slot.
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const MAGIC = encoder.encode("DVLT");
const HEADER = 17; // magic, format byte, 96-bit IV
const TAG = 16;
const MAX_METADATA = 8192;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ENVELOPE_BYTES = MAX_FILE_BYTES + 32 * 1024;

function subtle() {
    if (!globalThis.crypto?.subtle) {
        throw new Error("Encryption needs a trusted HTTPS page or a desktop localhost session.");
    }
    return globalThis.crypto.subtle;
}

function iv() {
    return crypto.getRandomValues(new Uint8Array(12));
}

function aad(context, kind) {
    const { chainId, contract, owner, documentId, revision } = context;
    return encoder.encode(JSON.stringify([
        "dvault", 1, kind, String(chainId), contract.toLowerCase(),
        owner.toLowerCase(), documentId.toLowerCase(), String(revision)
    ]));
}

export function generateRecoveryKey() {
    subtle();
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const text = btoa(String.fromCharCode(...raw)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    raw.fill(0);
    return `DVK1-${text}`;
}

export async function importRecoveryKey(input) {
    const value = input.trim();
    if (!/^DVK1-[A-Za-z0-9_-]{43}$/.test(value)) {
        throw new Error("Enter your full Dvault recovery key. It starts with DVK1-.");
    }
    const encoded = value.slice(5).replaceAll("-", "+").replaceAll("_", "/");
    const raw = Uint8Array.from(atob(encoded + "="), (char) => char.charCodeAt(0));
    if (btoa(String.fromCharCode(...raw)) !== encoded + "=") {
        raw.fill(0);
        throw new Error("This recovery key has an invalid encoding.");
    }
    try {
        return await subtle().importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    } finally {
        raw.fill(0);
    }
}

export function randomDocumentId() {
    return hex(crypto.getRandomValues(new Uint8Array(32)));
}

function hex(bytes) {
    return "0x" + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function digestEnvelope(bytes) {
    return hex(new Uint8Array(await subtle().digest("SHA-256", bytes)));
}

export async function sealLabel(key, context, label) {
    const nonce = iv();
    const data = new Uint8Array(128);
    const { written } = encoder.encodeInto(label, data.subarray(1));
    data[0] = written;
    try {
        const sealed = await subtle().encrypt({
            name: "AES-GCM", iv: nonce, additionalData: aad({ ...context, revision: 0 }, "label")
        }, key, data);
        const bytes = new Uint8Array(156);
        bytes.set(nonce);
        bytes.set(new Uint8Array(sealed), nonce.length);
        return hex(bytes);
    } finally {
        data.fill(0);
    }
}

export async function openLabel(key, context, hexLabel) {
    if (!/^0x[0-9a-f]{312}$/i.test(hexLabel)) throw new Error("Invalid sealed title.");
    const bytes = Uint8Array.from(hexLabel.slice(2).match(/../g), (pair) => Number.parseInt(pair, 16));
    const data = new Uint8Array(await subtle().decrypt({
        name: "AES-GCM", iv: bytes.subarray(0, 12),
        additionalData: aad({ ...context, revision: 0 }, "label")
    }, key, bytes.subarray(12)));
    try {
        if (data[0] > 127) throw new Error("Invalid sealed title length.");
        return decoder.decode(data.subarray(1, 1 + data[0]));
    } finally {
        data.fill(0);
    }
}

export async function sealFile(key, context, file, note = "") {
    if (file.size > MAX_FILE_BYTES) throw new Error("Choose a file up to 20 MiB.");
    const metadata = encoder.encode(JSON.stringify({ name: file.name, type: file.type, note }));
    if (metadata.length > MAX_METADATA) throw new Error("The file name or version note is too long.");
    const data = new Uint8Array(4 + metadata.length + file.size);
    new DataView(data.buffer).setUint32(0, metadata.length);
    data.set(metadata, 4);
    const contents = new Uint8Array(await file.arrayBuffer());
    data.set(contents, 4 + metadata.length);
    contents.fill(0);
    const nonce = iv();
    try {
        const encrypted = new Uint8Array(await subtle().encrypt({
            name: "AES-GCM", iv: nonce, additionalData: aad(context, "file")
        }, key, data));
        const envelope = new Uint8Array(HEADER + encrypted.length);
        envelope.set(MAGIC);
        envelope[4] = 1;
        envelope.set(nonce, 5);
        envelope.set(encrypted, HEADER);
        return envelope;
    } finally {
        data.fill(0);
    }
}

export async function openFile(key, context, envelope, expectedDigest) {
    const bytes = new Uint8Array(envelope);
    if (bytes.length < HEADER + TAG + 4 || bytes.length > MAX_ENVELOPE_BYTES ||
        !MAGIC.every((byte, i) => bytes[i] === byte) || bytes[4] !== 1) {
        throw new Error("This payload is not a valid Dvault envelope.");
    }
    if (await digestEnvelope(bytes) !== expectedDigest.toLowerCase()) {
        throw new Error("Integrity check failed. The download differs from the on-chain fingerprint.");
    }
    let data;
    try {
        data = new Uint8Array(await subtle().decrypt({
            name: "AES-GCM", iv: bytes.subarray(5, HEADER), additionalData: aad(context, "file")
        }, key, bytes.subarray(HEADER)));
    } catch {
        throw new Error("The fingerprint matches, but this key cannot decrypt this version.");
    }
    try {
        const length = new DataView(data.buffer).getUint32(0);
        if (length > MAX_METADATA || length + 4 > data.length || data.length - length - 4 > MAX_FILE_BYTES) {
            throw new Error("The decrypted document format is invalid.");
        }
        const metadata = JSON.parse(decoder.decode(data.subarray(4, 4 + length)));
        if (typeof metadata?.name !== "string" || typeof metadata.type !== "string" || typeof metadata.note !== "string") {
            throw new Error("The decrypted document metadata is invalid.");
        }
        return { metadata, blob: new Blob([data.subarray(4 + length)], { type: "application/octet-stream" }) };
    } finally {
        data.fill(0);
    }
}

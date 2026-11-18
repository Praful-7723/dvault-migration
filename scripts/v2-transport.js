const { timingSafeEqual } = require("node:crypto");

const envelopeLimit = 20 * 1024 * 1024 + 32 * 1024;
const envelopeMagic = Buffer.from("DVLT");
const cidPattern = /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,95})$/;
const gatewayDefault = "https://gateway.pinata.cloud/ipfs/";
const publicGateway = "https://ipfs.io/ipfs/";
const rpcMethods = new Set([
    "eth_blockNumber", "eth_call", "eth_chainId", "eth_estimateGas",
    "eth_feeHistory", "eth_gasPrice", "eth_getBalance", "eth_getBlockByHash",
    "eth_getBlockByNumber", "eth_getCode", "eth_getLogs", "eth_getStorageAt",
    "eth_getTransactionByHash", "eth_getTransactionCount", "eth_getTransactionReceipt",
    "eth_maxPriorityFeePerGas", "eth_sendRawTransaction", "net_version",
    "web3_clientVersion"
]);
const walletOrigin = "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn";

class TransportError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function json(response, status, body) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    });
    response.end(JSON.stringify(body));
}

function contentType(request) {
    return request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
}

async function readBounded(stream, maxBytes, size) {
    if (Number(size) > maxBytes) {
        await stream.cancel?.();
        throw new TransportError(413, "The payload exceeds the permitted size.");
    }
    const chunks = [];
    let length = 0;
    const iterator = stream.iterator?.({ destroyOnReturn: false }) ?? stream;
    for await (const chunk of iterator) {
        length += chunk.byteLength;
        if (length > maxBytes) {
            throw new TransportError(413, "The payload exceeds the permitted size.");
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks, length);
}

function isEnvelope(bytes) {
    // A framing check only. The browser authenticates ciphertext with AES-GCM.
    return bytes.length >= 32 && bytes.subarray(0, envelopeMagic.length).equals(envelopeMagic);
}

function pinataAuth() {
    const { PINATA_JWT, PINATA_API_KEY, PINATA_SECRET_API_KEY } = process.env;
    if (PINATA_JWT) return { Authorization: `Bearer ${PINATA_JWT}` };
    if (PINATA_API_KEY && PINATA_SECRET_API_KEY) {
        return { pinata_api_key: PINATA_API_KEY, pinata_secret_api_key: PINATA_SECRET_API_KEY };
    }
    throw new TransportError(503, "Pinning is unavailable. The server needs Pinata credentials.");
}

function matchesToken(supplied, expected) {
    if (typeof supplied !== "string") return false;
    const left = Buffer.from(supplied);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
}

async function uploadEnvelope(request, response, context) {
    if (request.headers.origin !== context.origin) {
        throw new TransportError(403, "Open Dvault at its configured address to upload.");
    }
    if (context.uploadToken && !matchesToken(request.headers["x-dvault-demo-token"], context.uploadToken)) {
        throw new TransportError(401, "Enter the demo upload token provided by the host.");
    }
    if (contentType(request) !== "application/octet-stream") {
        throw new TransportError(415, "Uploads must use the Dvault encrypted format.");
    }
    const auth = pinataAuth();
    const encrypted = await readBounded(request, envelopeLimit, request.headers["content-length"]);
    if (!isEnvelope(encrypted)) {
        throw new TransportError(400, "This payload has no Dvault encrypted envelope.");
    }
    const form = new FormData();
    form.append("file", new Blob([encrypted], { type: "application/octet-stream" }), "encrypted-version.dvlt");
    form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
    const upstream = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: auth,
        body: form,
        redirect: "error",
        signal: AbortSignal.timeout(120_000)
    });
    if (!upstream.ok) {
        await upstream.body?.cancel();
        throw new TransportError(502, `Pinata could not save the encrypted version (HTTP ${upstream.status}).`);
    }
    const { IpfsHash: cid } = await upstream.json();
    if (typeof cid !== "string" || !cidPattern.test(cid)) {
        throw new TransportError(502, "Pinata did not return a supported CID.");
    }
    json(response, 200, { cid });
}

function gatewayUrls() {
    const configured = process.env.DVAULT_IPFS_GATEWAY || process.env.PINATA_GATEWAY_URL || gatewayDefault;
    const gateway = new URL(configured);
    if (gateway.protocol !== "https:" || gateway.username || gateway.password || gateway.search || gateway.hash) {
        throw new Error("The IPFS gateway must be an HTTPS URL for an IPFS path prefix.");
    }
    if (!gateway.pathname.endsWith("/")) gateway.pathname += "/";
    // A gateway may be temporarily unavailable. The browser verifies the exact
    // envelope hash against the chain regardless of where the bytes came from.
    // A dedicated gateway override controls where requests go.
    return process.env.DVAULT_IPFS_GATEWAY ? [gateway.href] : [...new Set([gateway.href, publicGateway])];
}

async function downloadEnvelope(response, cid, gateways) {
    if (!cidPattern.test(cid)) {
        throw new TransportError(400, "The encrypted version has an invalid CID.");
    }
    let corrupted = false;
    for (const gateway of gateways) {
        try {
            const upstream = await fetch(new URL(cid, gateway), {
                redirect: "error",
                signal: AbortSignal.timeout(18_000)
            });
            if (upstream.status !== 200 || !upstream.body) {
                await upstream.body?.cancel();
                continue;
            }
            const encrypted = await readBounded(upstream.body, envelopeLimit, upstream.headers.get("content-length"));
            if (!isEnvelope(encrypted)) {
                corrupted = true;
                continue;
            }
            response.writeHead(200, {
                "Content-Type": "application/octet-stream",
                "Content-Length": String(encrypted.length),
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
                "Cross-Origin-Resource-Policy": "same-origin"
            });
            response.end(encrypted);
            return;
        } catch (error) {
            if (error instanceof TransportError && error.status === 413) corrupted = true;
        }
    }
    throw new TransportError(502, corrupted
        ? "The IPFS response is not a valid encrypted version."
        : "The encrypted version is unavailable from IPFS. Try again in a moment.");
}

function validateRpcMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0") {
        return false;
    }
    const { id, method, params } = message;
    if ((id !== null && typeof id !== "string" && !Number.isSafeInteger(id)) ||
        (params !== undefined && !Array.isArray(params)) || !rpcMethods.has(method)) {
        return false;
    }
    if (method === "eth_sendRawTransaction") {
        return params?.length === 1 && typeof params[0] === "string" &&
            /^0x(?:[0-9a-f]{2})+$/i.test(params[0]);
    }
    return true;
}

async function relayRpc(request, response, context) {
    const requestOrigin = request.headers.origin;
    if (requestOrigin && requestOrigin !== context.origin && requestOrigin !== walletOrigin) {
        throw new TransportError(403, "This origin cannot use the demo RPC.");
    }
    if (requestOrigin) {
        response.setHeader("Access-Control-Allow-Origin", requestOrigin);
        response.setHeader("Vary", "Origin");
    }
    if (request.method === "OPTIONS") {
        response.writeHead(204, {
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type"
        });
        response.end();
        return;
    }
    if (request.method !== "POST" || contentType(request) !== "application/json") {
        throw new TransportError(415, "Use POST with a JSON-RPC payload.");
    }
    const body = await readBounded(request, 64 * 1024, request.headers["content-length"]);
    let payload;
    try {
        payload = JSON.parse(body.toString());
    } catch {
        return json(response, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON." } });
    }
    const messages = Array.isArray(payload) ? payload : [payload];
    if (messages.length === 0 || messages.length > 20 || !messages.every(validateRpcMessage)) {
        return json(response, 400, {
            jsonrpc: "2.0",
            id: !Array.isArray(payload) && validateRpcId(payload?.id) ? payload.id : null,
            error: { code: -32600, message: "Invalid or disabled JSON-RPC request." }
        });
    }
    const upstream = await fetch(context.upstreamRpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(15_000)
    });
    if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel();
        throw new TransportError(502, "Start the local chain to use the demo wallet.");
    }
    const result = await readBounded(upstream.body, 4 * 1024 * 1024, upstream.headers.get("content-length"));
    json(response, 200, JSON.parse(result.toString()));
}

function validateRpcId(id) {
    return typeof id === "string" || Number.isSafeInteger(id);
}

function createV2Transport(options) {
    const context = { ...options, gateways: gatewayUrls() };
    let uploads = 0;
    let downloads = 0;
    return async function handleV2Transport(request, response, route) {
        try {
            if (request.method === "GET" && route === "/api/v2/environment") {
                json(response, 200, {
                    networkRpcUrl: context.lan ? `${context.origin}/api/v2/rpc` : context.upstreamRpc,
                    registryRpcUrl: "/api/v2/rpc",
                    uploadTokenRequired: Boolean(context.uploadToken)
                });
            } else if (request.method === "POST" && route === "/api/v2/upload") {
                if (uploads >= 2) throw new TransportError(429, "Another encrypted upload is in progress. Try again.");
                uploads += 1;
                try {
                    await uploadEnvelope(request, response, context);
                } finally {
                    uploads -= 1;
                }
            } else if (request.method === "GET" && route.startsWith("/api/v2/blob/")) {
                if (downloads >= 6) throw new TransportError(429, "Several versions are loading. Try again.");
                downloads += 1;
                try {
                    await downloadEnvelope(response, route.slice("/api/v2/blob/".length), context.gateways);
                } finally {
                    downloads -= 1;
                }
            } else if (route === "/api/v2/rpc") {
                await relayRpc(request, response, context);
            } else {
                json(response, 404, { error: "Not found." });
            }
        } catch (error) {
            if (!request.complete) response.setHeader("Connection", "close");
            const status = error instanceof TransportError ? error.status : 502;
            const message = error instanceof TransportError ? error.message : "Dvault could not complete the request. Try again.";
            json(response, status, { error: message });
            request.resume();
        }
    };
}

module.exports = { createV2Transport };

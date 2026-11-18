const { createServer } = require("node:http");
const { createServer: createHttpsServer } = require("node:https");
const { isIPv4 } = require("node:net");
const { extname, resolve } = require("node:path");
const { readFile, realpath } = require("node:fs/promises");
const { createV2Transport } = require("./v2-transport");
require("dotenv").config({ quiet: true });

const root = resolve(__dirname, "..");
const assetRoot = resolve(root, "frontend/v2/assets");
const personalFontRoot = resolve(root, ".dvault-font-preview");
const personalFonts = new Map([
    ["altamis", "altamis-preview.woff2"],
    ["kid-games", "kid-games-preview.woff2"]
]);
const personalFontRoute = "/v2/local-display.woff2";
const upstreamRpc = process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545";
const legacyFiles = new Map([
    ["/", ["frontend/index.html", "text/html"]],
    ["/index.html", ["frontend/index.html", "text/html"]],
    ["/app.js", ["frontend/app.js", "text/javascript"]],
    ["/config.js", ["frontend/config.js", "text/javascript"]]
]);
const sharedFiles = new Map([
    ["/ethers.js", ["node_modules/ethers/dist/ethers.umd.min.js", "text/javascript"]]
]);
const versionedFiles = new Map([
    ["/v2/", ["frontend/v2/index.html", "text/html"]],
    ["/v2/index.html", ["frontend/v2/index.html", "text/html"]],
    ["/v2/app", ["frontend/v2/index.html", "text/html"]],
    ["/v2/app/", ["frontend/v2/index.html", "text/html"]],
    ["/v2/style.css", ["frontend/v2/style.css", "text/css"]],
    ["/v2/fonts.css", ["frontend/v2/fonts.css", "text/css"]],
    ["/v2/theme.css", ["frontend/v2/theme.css", "text/css"]],
    ["/v2/theme.mjs", ["frontend/v2/theme.mjs", "text/javascript"]],
    ["/v2/fonts-licenses/bricolage.txt", ["frontend/v2/assets/OFL-Bricolage-Grotesque.txt", "text/plain"]],
    ["/v2/fonts-licenses/geist.txt", ["frontend/v2/assets/OFL-Geist.txt", "text/plain"]],
    ["/v2/app.mjs", ["frontend/v2/app.mjs", "text/javascript"]],
    ["/v2/install.mjs", ["frontend/v2/install.mjs", "text/javascript"]],
    ["/v2/manifest.webmanifest", ["frontend/v2/manifest.webmanifest", "application/manifest+json"]],
    ["/v2/crypto.mjs", ["frontend/v2/crypto.mjs", "text/javascript"]],
    ["/v2/coins.mjs", ["frontend/v2/coins.mjs", "text/javascript"]],
    ["/v2/coin-motion.mjs", ["frontend/v2/coin-motion.mjs", "text/javascript"]],
    ["/v2/coin-canvas.mjs", ["frontend/v2/coin-canvas.mjs", "text/javascript"]],
    ["/v2/scene-loop.mjs", ["frontend/v2/scene-loop.mjs", "text/javascript"]],
    ["/v2/dither.mjs", ["frontend/v2/dither.mjs", "text/javascript"]],
    ["/v2/config.js", ["frontend/config.js", "text/javascript"]]
]);
const assetTypes = new Map([
    [".avif", "image/avif"],
    [".glb", "model/gltf-binary"],
    [".glsl", "text/plain"],
    [".ico", "image/x-icon"],
    [".jpeg", "image/jpeg"],
    [".jpg", "image/jpeg"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".webp", "image/webp"],
    [".woff2", "font/woff2"]
]);

function json(response, status, body) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    });
    response.end(JSON.stringify(body));
}

async function upload(request, response, origin) {
    const contentType = request.headers["content-type"];
    if (request.headers.origin !== origin || !contentType?.startsWith("multipart/form-data;")) {
        return json(response, 403, { error: "Upload from the local Dvault page." });
    }

    const { PINATA_JWT, PINATA_API_KEY, PINATA_SECRET_API_KEY } = process.env;
    if (!PINATA_JWT && !(PINATA_API_KEY && PINATA_SECRET_API_KEY)) {
        return json(response, 503, { error: "Add Pinata credentials to .env and restart npm run serve." });
    }

    const auth = PINATA_JWT
        ? { Authorization: `Bearer ${PINATA_JWT}` }
        : { pinata_api_key: PINATA_API_KEY, pinata_secret_api_key: PINATA_SECRET_API_KEY };
    const headers = { ...auth, "Content-Type": contentType };
    if (request.headers["content-length"]) {
        headers["Content-Length"] = request.headers["content-length"];
    }

    const result = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        body: request,
        duplex: "half",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(120_000)
    });
    if (!result.ok) {
        await result.body?.cancel();
        return json(response, 502, { error: `Pinata rejected the upload (HTTP ${result.status}). Check the key and its upload permissions.` });
    }

    const { IpfsHash } = await result.json();
    if (!/^[a-zA-Z0-9]+$/.test(IpfsHash ?? "")) {
        return json(response, 502, { error: "Pinata did not return a valid file CID." });
    }
    json(response, 200, { cid: IpfsHash });
}

function privateIPv4(host) {
    if (!isIPv4(host)) return false;
    const [first, second] = host.split(".").map(Number);
    return first === 10 || (first === 192 && second === 168) ||
        (first === 172 && second >= 16 && second <= 31);
}

async function serverConfig() {
    const lan = process.env.DVAULT_HTTPS_ORIGIN;
    if (!lan) {
        const port = Number(process.env.DVAULT_HTTP_PORT || 4173);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error("DVAULT_HTTP_PORT must be a valid TCP port.");
        }
        return { origin: `http://127.0.0.1:${port}`, host: "127.0.0.1", port };
    }

    const url = new URL(lan);
    const { DVAULT_HTTPS_CERT: certPath, DVAULT_HTTPS_KEY: keyPath, DVAULT_DEMO_TOKEN: uploadToken } = process.env;
    if (url.protocol !== "https:" || lan.replace(/\/$/, "") !== url.origin || !privateIPv4(url.hostname)) {
        throw new Error("DVAULT_HTTPS_ORIGIN must be an HTTPS origin on a private IPv4 address.");
    }
    if (!certPath || !keyPath || !/^[A-Za-z0-9_-]{24,128}$/.test(uploadToken || "")) {
        throw new Error("LAN mode needs a trusted TLS certificate, its private key, and a DVAULT_DEMO_TOKEN of 24–128 URL-safe characters.");
    }
    const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);
    return {
        origin: url.origin,
        host: url.hostname,
        port: Number(url.port || 443),
        tls: { cert, key, minVersion: "TLSv1.2" },
        uploadToken
    };
}

function versionedHeaders(config) {
    const rpcOrigin = config.tls ? "" : ` ${new URL(upstreamRpc).origin}`;
    return {
        "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; " +
            "img-src 'self' blob: data:; font-src 'self'; manifest-src 'self'; worker-src 'self' blob:; " +
            `connect-src 'self'${rpcOrigin}; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`,
        "Referrer-Policy": "no-referrer",
        "Cross-Origin-Resource-Policy": "same-origin"
    };
}

async function selectAsset(route) {
    const match = /^\/v2\/assets\/([a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127})$/.exec(route);
    if (!match) return null;
    const format = assetTypes.get(extname(match[1]));
    if (!format) return null;
    const path = await realpath(resolve(assetRoot, match[1]));
    if (path !== resolve(assetRoot, match[1])) return null;
    return [path, format];
}

async function readPersonalFont(config) {
    // The supplied demos are for the owner's local preview. Only open faces
    // are offered by the HTTPS listener, including to installed PWAs on LAN.
    if (config.host !== "127.0.0.1" || config.tls) return null;
    const file = personalFonts.get(process.env.DVAULT_PERSONAL_FONT ?? "bundled");
    if (!file) return null;
    try {
        return await readFile(resolve(personalFontRoot, file));
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

const personalFontCss = Buffer.from(`
@font-face {
    font-family: "Dvault Personal Display";
    src: url("${personalFontRoute}") format("woff2");
    font-style: normal;
    font-weight: 400;
    font-display: swap;
}
html:root {
    --font-display: "Dvault Personal Display", "Dvault Display", "Dvault UI", sans-serif;
}
html:root :is(h1, h2, .brand) {
    font-synthesis: none;
    letter-spacing: -.025em;
}
`);

async function start() {
    const config = await serverConfig();
    const expectedHost = new URL(config.origin).host;
    const versionedSecurityHeaders = versionedHeaders(config);
    const personalFont = await readPersonalFont(config);
    const handleV2 = createV2Transport({
        origin: config.origin,
        upstreamRpc,
        lan: Boolean(config.tls),
        uploadToken: config.uploadToken
    });
    const handler = async (request, response) => {
        const route = request.url.split("?")[0];
        try {
            if (request.headers.host !== expectedHost) {
                response.setHeader("Connection", "close");
                return json(response, 421, { error: "Open Dvault at its configured address." });
            }
            if (route.startsWith("/api/v2/")) {
                return await handleV2(request, response, route);
            }
            if (!config.tls && request.method === "POST" && route === "/api/upload") {
                return await upload(request, response, config.origin);
            }
            if (request.method !== "GET" && request.method !== "HEAD") {
                return json(response, 404, { error: "Not found." });
            }
            if (route === "/v2" || (config.tls && route === "/")) {
                response.writeHead(308, { "Location": "/v2/", "Cache-Control": "no-store" });
                return response.end();
            }
            const versioned = route.startsWith("/v2/");
            const file = sharedFiles.get(route) || versionedFiles.get(route) ||
                (route === personalFontRoute && personalFont ? [null, "font/woff2"] : null) ||
                (versioned ? await selectAsset(route) : !config.tls && legacyFiles.get(route));
            if (!file) return json(response, 404, { error: "Not found." });

            const [path, type] = file;
            const content = path === null ? personalFont : await readFile(resolve(root, path));
            const body = route === "/v2/fonts.css" && personalFont
                ? Buffer.concat([content, personalFontCss]) : content;
            response.writeHead(200, {
                "Content-Type": type.startsWith("text/") ? `${type}; charset=utf-8` : type,
                "Content-Length": String(body.length),
                "Cache-Control": path?.startsWith(assetRoot) ? "public, max-age=300" : "no-store",
                "X-Content-Type-Options": "nosniff",
                ...(versioned ? versionedSecurityHeaders : {})
            });
            response.end(request.method === "HEAD" ? undefined : body);
        } catch (error) {
            const missing = error.code === "ENOENT";
            const status = missing ? 404 : 502;
            const message = missing ? "File not found. Build and deploy Dvault first." : "Dvault could not complete the request.";
            json(response, status, { error: message });
        }
    };
    const options = { requestTimeout: 120_000, headersTimeout: 20_000 };
    const server = config.tls
        ? createHttpsServer({ ...options, ...config.tls }, handler)
        : createServer(options, handler);
    server.on("error", (error) => {
        console.error(`Dvault could not listen at ${config.origin} (${error.code || "server error"}).`);
        process.exitCode = 1;
    });
    server.listen(config.port, config.host, () => console.log(`Dvault is ready at ${config.origin}/v2/`));
}

start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});

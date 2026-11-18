// Cross-platform local demo launcher. No API keys are printed or passed as CLI arguments.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const readline = require("node:readline");
const { Writable } = require("node:stream");
const root = path.resolve(__dirname, "..");
const children = new Set();
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

function nodeVersion() {
    const major = Number(process.versions.node.split(".")[0]);
    if (major !== 22) throw new Error(`Use Node.js 22 LTS for this saved demo. This terminal has Node ${process.versions.node}.`);
}

function npmCli() {
    const candidates = [process.env.npm_execpath,
        path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
        path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js")];
    const found = candidates.find((item) => item && item.endsWith(".js") && fs.existsSync(item));
    if (!found) throw new Error("npm is missing. Install the standard Node.js 22 LTS distribution, then rerun this command.");
    return found;
}

function run(args, options = {}) {
    const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit", env: process.env, ...options });
    children.add(child);
    const done = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => {
            children.delete(child);
            if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") resolve();
            else reject(new Error(`${path.basename(args[0])} exited with code ${code}.`));
        });
    });
    return { child, done };
}

function checkStorage() {
    const guard = path.join(os.homedir(), ".local/bin/ssd-run");
    if (process.platform === "darwin" && fs.existsSync(guard)) {
        const result = spawnSync(guard, ["--check"], { stdio: "inherit" });
        if (result.status !== 0) throw new Error("The storage guard failed. Connect ExternalSSD and keep the required free space before installing dependencies.");
    }
    if (process.platform === "darwin" && fs.existsSync("/Volumes/ExternalSSD")) {
        return "/Volumes/ExternalSSD/Dev/caches/npm";
    }
    return path.join(root, ".npm-cache");
}

async function ensureConfiguration() {
    const envPath = path.join(root, ".env");
    const bundlePath = path.join(root, "migration-config.enc.json");
    if (fs.existsSync(envPath) || !fs.existsSync(bundlePath)) return;
    const lockPath = path.join(root, ".dvault-unlock.lock");
    let owned = false;
    const deadline = Date.now() + 300000;
    while (!owned && !fs.existsSync(envPath)) {
        try {
            const fd = fs.openSync(lockPath, "wx");
            fs.writeFileSync(fd, JSON.stringify({ pid: process.pid }));
            fs.closeSync(fd);
            owned = true;
        } catch (error) {
            if (error.code !== "EEXIST") throw error;
            try {
                const other = JSON.parse(fs.readFileSync(lockPath, "utf8"));
                try { process.kill(other.pid, 0); }
                catch (status) { if (status.code === "ESRCH") { fs.unlinkSync(lockPath); continue; } }
            } catch { /* Another terminal may be opening its prompt. */ }
            if (Date.now() > deadline) throw new Error("Unlock configuration in the first terminal, then retry here.");
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    if (!owned) return;
    try {
        if (fs.existsSync(envPath)) return;
        let password = process.env.DVAULT_MIGRATION_PASSWORD;
        if (!password) {
            if (!process.stdin.isTTY) throw new Error("First run needs the migration unlock code. Run this in an interactive terminal, or set DVAULT_MIGRATION_PASSWORD for an agent.");
            process.stdout.write("Migration unlock code (input hidden): ");
            const muted = new Writable({ write(chunk, encoding, next) { next(); } });
            muted.isTTY = true;
            const prompt = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
            password = await new Promise((resolve, reject) => {
                prompt.once("SIGINT", () => { prompt.close(); reject(new Error("Migration unlock cancelled.")); });
                prompt.once("close", () => reject(new Error("Migration unlock cancelled.")));
                prompt.question("", resolve);
            });
            prompt.close();
            process.stdout.write("\n");
        }
        const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
        const normalized = password.replace(/[-\s]/g, "").toUpperCase();
        const key = crypto.scryptSync(normalized, Buffer.from(bundle.salt, "base64"), 32);
        const cipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(bundle.iv, "base64"));
        cipher.setAuthTag(Buffer.from(bundle.tag, "base64"));
        let plaintext;
        try { plaintext = Buffer.concat([cipher.update(Buffer.from(bundle.ciphertext, "base64")), cipher.final()]); }
        catch { throw new Error("That migration code did not unlock the configuration. No files were changed. Rerun and paste the correct code."); }
        fs.writeFileSync(envPath, plaintext, { flag: "wx", mode: 0o600 });
        console.log("Complete local configuration restored. No API-key entry is needed.");
    } finally { fs.rmSync(lockPath, { force: true }); }
}

async function prepare() {
    nodeVersion();
    const lock = fs.readFileSync(path.join(root, "package-lock.json"));
    const marker = path.join(root, "node_modules/.dvault-install-sha256");
    const installed = fs.existsSync(path.join(root, "node_modules/hardhat/internal/cli/cli.js")) &&
        fs.existsSync(path.join(root, "node_modules/ethers/package.json"));
    if (!installed || !fs.existsSync(marker) || fs.readFileSync(marker, "utf8").trim() !== digest(lock)) {
        const cache = checkStorage();
        const installLock = path.join(root, ".dvault-install.lock");
        let acquired = false;
        const deadline = Date.now() + 180000;
        while (!acquired) {
            try {
                const fd = fs.openSync(installLock, "wx");
                fs.writeFileSync(fd, JSON.stringify({ pid: process.pid }));
                fs.closeSync(fd);
                acquired = true;
            } catch (error) {
                if (error.code !== "EEXIST") throw error;
                try {
                    const other = JSON.parse(fs.readFileSync(installLock, "utf8"));
                    try { process.kill(other.pid, 0); }
                    catch (status) { if (status.code === "ESRCH") { fs.unlinkSync(installLock); continue; } }
                } catch { /* The first terminal may still be writing its lock. */ }
                if (Date.now() > deadline) throw new Error("The other terminal is still installing dependencies. Let it finish, then rerun this command.");
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        try {
            if (!fs.existsSync(marker) || fs.readFileSync(marker, "utf8").trim() !== digest(lock)) {
                console.log("Installing the locked dependencies for this operating system (first run only)…");
                await run([npmCli(), "ci", "--cache", cache, "--no-audit", "--no-fund"]).done;
                fs.writeFileSync(marker, digest(lock) + "\n");
            }
        } finally { fs.rmSync(installLock, { force: true }); }
    }
    await ensureConfiguration();
    require(path.join(root, "node_modules/dotenv")).config({ path: path.join(root, ".env"), quiet: true });
    process.env.DVAULT_HTTP_PORT ||= "4174";
    process.env.LOCALHOST_RPC_URL ||= "http://127.0.0.1:8545";
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "demo-artifacts/manifest.json"), "utf8"));
    for (const item of manifest.contracts) {
        const actual = digest(fs.readFileSync(path.join(root, item.source)));
        if (actual !== item.sourceSha256) throw new Error("Contract source differs from the bundled artifacts. Run npm run compile, then npm run bundle:artifacts.");
        const data = fs.readFileSync(path.join(root, "demo-artifacts", item.artifact));
        if (digest(data) !== item.artifactSha256) throw new Error("A bundled contract artifact failed its checksum. Restore it from Git.");
        const target = path.join(root, "artifacts", item.source, item.artifact);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
    }
    if (!fs.existsSync(path.join(root, ".env"))) {
        console.log("No local .env found. The UI and blockchain can run; IPFS uploads need the private migration copy's configuration.");
    }
}

async function rpcReady() {
    try {
        const response = await fetch(process.env.LOCALHOST_RPC_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
            signal: AbortSignal.timeout(1500)
        });
        const data = await response.json();
        if (data.result && Number(data.result) !== 31337) throw new Error("The configured RPC is a different chain. Dvault expects local chain 31337.");
        return Number(data.result) === 31337;
    } catch (error) {
        if (error.message?.includes("different chain")) throw error;
        return false;
    }
}

async function waitForChain(seconds = 30) {
    const until = Date.now() + seconds * 1000;
    while (Date.now() < until) {
        if (await rpcReady()) return;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("The local blockchain is not ready. Leave Terminal 1 running npm run node, then rerun npm run app in Terminal 2.");
}

function hardhat(args) {
    return run([path.join(root, "node_modules/hardhat/internal/cli/cli.js"), ...args]);
}

async function chain() {
    if (await rpcReady()) {
        console.log(`Existing chain reused at ${process.env.LOCALHOST_RPC_URL}. It was not restarted or reset.`);
        return null;
    }
    const url = new URL(process.env.LOCALHOST_RPC_URL);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Automatic startup only supports a loopback RPC. Start the configured external RPC separately.");
    const child = hardhat(["node", "--hostname", "127.0.0.1", "--port", url.port || "8545"]);
    return child;
}

function openBrowser(url) {
    if (process.env.DVAULT_NO_OPEN === "1" || process.env.CI) return;
    const command = process.platform === "darwin" ? ["open", [url]]
        : process.platform === "win32" ? [process.env.ComSpec || "cmd.exe", ["/d", "/c", "start", "", url]]
        : ["xdg-open", [url]];
    const child = spawn(command[0], command[1], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
}

async function app() {
    await waitForChain();
    await hardhat(["run", "scripts/deploy.js", "--network", "localhost", "--no-compile"]).done;
    const origin = process.env.DVAULT_HTTPS_ORIGIN || `http://127.0.0.1:${process.env.DVAULT_HTTP_PORT}`;
    const target = origin + "/v2/";
    try {
        const response = await fetch(target, { signal: AbortSignal.timeout(1000) });
        if (response.ok && (await response.text()).includes("Dvault —")) {
            console.log(`Dvault is already available at ${target}`);
            openBrowser(target);
            return;
        }
        throw new Error("The preview port is occupied by a different service. Choose another DVAULT_HTTP_PORT.");
    } catch (error) {
        if (error.message?.includes("different service")) throw error;
    }
    const server = run([path.join(root, "scripts/serve.js")]);
    let settled = false;
    server.done.then(() => { settled = true; }).catch(() => { settled = true; });
    for (let i = 0; i < 40; i++) {
        if (settled) throw new Error("The web server stopped before it became ready.");
        try {
            const response = await fetch(target, { signal: AbortSignal.timeout(1000) });
            if (response.ok) {
                console.log(`Open Dvault: ${target}`);
                openBrowser(target);
                await server.done;
                return;
            }
        } catch { /* Wait for the first listener. */ }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    server.child.kill();
    throw new Error("The preview server did not become ready. Read the server error above.");
}

function stopChildren() {
    for (const child of children) child.kill();
}
process.on("SIGINT", () => { stopChildren(); process.exit(130); });
process.on("SIGTERM", () => { stopChildren(); process.exit(143); });

async function main() {
    await prepare();
    const mode = process.argv[2] || "demo";
    if (mode === "prepare") return;
    if (mode === "node") { const running = await chain(); if (running) await running.done; return; }
    if (mode === "app") return app();
    if (mode === "demo") {
        const running = await chain();
        try { await app(); } finally { if (running) running.child.kill(); }
        return;
    }
    throw new Error("Use npm run demo, npm run node, or npm run app.");
}
main().catch((error) => { console.error(`Dvault: ${error.message}`); stopChildren(); process.exitCode = 1; });

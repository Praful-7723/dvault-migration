import {
    MAX_FILE_BYTES, generateRecoveryKey, importRecoveryKey, randomDocumentId,
    sealLabel, openLabel, sealFile, openFile, digestEnvelope
} from "./crypto.mjs";

const $ = (id) => document.getElementById(id);
const { ethers } = window;
const config = window.BLOCKCHAIN_DRIVE_CONFIG ?? {};
const chainId = Number(config.chainId ?? 31337);
const chainHex = `0x${chainId.toString(16)}`;
const keyDialog = $("key-dialog");
const composer = $("upload-form");
const historyView = $("document-history");
const submitButton = $("upload-submit");
const pageSize = 20;
const isAppPath = () => /^\/v2\/app\/?$/.test(location.pathname);
let isApp = isAppPath();
const transition = $("entry-transition");
const syncEntryMotion = () => {
    transition.dataset.paused = String(document.hidden);
    document.body.dataset.motionPaused = String(document.hidden);
};
document.addEventListener("visibilitychange", syncEntryMotion);
syncEntryMotion();
let landingScene;
let stopDither;
let stopWorkspaceDither;

function showSurface(surface) {
    document.body.dataset.surface = surface;
    $("app-frame").hidden = surface !== "app";
    $("welcome").hidden = surface !== "landing";
    transition.hidden = surface !== "entry";
    document.querySelector(".topbar").inert = surface === "entry";
    document.querySelector(".skip").inert = surface === "entry";
    requestAnimationFrame(syncBorderMotion);
}

async function renderLanding() {
    try {
        const brandImage = $("entry-face");
        const { mountCoins, mountDither } = await import("./coins.mjs");
        if ($("welcome").hidden) return;
        stopDither = mountDither($("landing-dither"));
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        await brandImage.decode();
        if ($("welcome").hidden) return;
        landingScene = mountCoins($("entry-coin"), { brandImage });
    } catch {
        // The same purple medallion remains available as a static view.
    }
}

async function enterVault(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!transition.hidden || isApp) return;
    const destination = event.currentTarget.href;
    landingScene?.destroy();
    stopDither?.();
    showSurface("entry");
    $("entry-heading").focus({ preventScroll: true });

    let registryChecked = false;
    const registry = probeRegistry().finally(() => { registryChecked = true; });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (!registryChecked) {
        transition.dataset.waiting = "true";
        $("entry-registry-status").textContent = "Checking the demo registry…";
    }
    await registry;

    history.pushState(null, "", destination);
    isApp = true;
    showSurface("app");
    startWorkspace({ registryChecked: true });
    focusSection("library-heading");
}

showSurface(isApp ? "app" : "landing");
if (!isApp) {
    $("enter-vault").addEventListener("click", enterVault);
    requestAnimationFrame(renderLanding);
}
window.addEventListener("popstate", () => {
    if (isAppPath() !== isApp) location.reload();
});

function focusSection(id) {
    const heading = $(id);
    const panel = heading.closest(".workspace-card");
    const focus = () => {
        if (!panel) heading.scrollIntoView({ block: "nearest" });
        heading.focus({ preventScroll: true });
    };
    if (panel && expandedPanel !== panel.id && (matchMedia("(max-width: 640px)").matches || expandedPanel)) {
        resizePanel(panel.id, false);
        if (panelTransition?.updateCallbackDone) panelTransition.updateCallbackDone.then(focus).catch(() => {});
        else focus();
        return;
    }
    focus();
}

const setupDialog = $("setup-dialog");
const accountDialog = $("account-dialog");
const setupStages = [
    ["Authorize this vault", "Your wallet signs version records and identifies the account that saved them.",
        "Use MetaMask on desktop or the MetaMask app’s browser on your phone.", "Continue in MetaMask"],
    ["Protect your documents", "Your Dvault recovery key encrypts and opens your files. Create one now or use the key you saved.",
        "Keep the recovery key somewhere private. You’ll need it to open files on another device.", "Set up recovery key"],
    ["Save your first document", "Choose a file and Dvault will encrypt it on this device before upload. Use MetaMask to confirm its version record.",
        "Uploading a change later adds another version to its history.", "Add a document"]
];
let resumeSetupEpoch = null;
const state = {
    account: null, read: null, writer: null, key: null, docs: [], total: 0,
    document: null, versions: [], versionsTotal: 0, epoch: 0, libraryFetch: 0,
    historyFetch: 0, busy: false, walletBusy: false, libraryBusy: false, historyBusy: false,
    picked: null, target: null, epochLabel: "",
    pendingMemory: new Map(), dismissed: false, provider: null, result: null
};
let scene;
let activeStep = 0;
let toastTimer;

let configRequest;
let discoveredWallet;
const watchedWallets = new WeakSet();

async function environment() {
    if (configRequest) return configRequest;
    configRequest = (async () => {
        try {
            const response = await fetch("/api/v2/environment", { cache: "no-store", signal: AbortSignal.timeout(4500) });
            if (!response.ok) return null;
            const settings = await response.json();
            return settings.networkRpcUrl ? settings : null;
        } catch {
            return null;
        }
    })();
    const result = await configRequest;
    if (!result) configRequest = null;
    return result;
}

function findWallet() {
    if (state.provider) return state.provider;
    const injected = window.ethereum;
    const providers = injected?.providers;
    return discoveredWallet ?? (Array.isArray(providers) ? providers.find((item) => item?.isMetaMask) : undefined) ?? injected;
}

function setOnlineStatus(message, detail, kind = "") {
    feedback("service-status", message, kind);
    $("service-detail").textContent = kind === "error" ? detail : "";
    $("service-detail").hidden = kind !== "error";
    $("retry-connection").hidden = kind !== "error";
}

async function probeRegistry() {
    $("retry-connection").disabled = true;
    setOnlineStatus("Checking registry", "Contacting the Dvault server…");
    try {
        const settings = await environment();
        if (!settings) throw new Error("Dvault server is offline. Check that the preview server is running.");
        if (!/^0x[0-9a-f]{40}$/i.test(config.versionVaultAddress ?? "")) throw new Error("Vault contract configuration is missing.");
        async function rpc(method, params) {
            const response = await fetch(settings.registryRpcUrl || "/api/v2/rpc", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
                signal: AbortSignal.timeout(4300)
            });
            const result = await response.json();
            if (!response.ok || result.error || !result.result) throw new Error("The blockchain relay is not responding.");
            return result.result;
        }
        const [chain, code] = await Promise.all([rpc("eth_chainId", []), rpc("eth_getCode", [config.versionVaultAddress, "latest"])]);
        if (Number(chain) !== chainId) throw new Error("The RPC returned a different network than the configured demo chain.");
        if (code === "0x") throw new Error("The network is online, but the vault contract is missing.");
        setOnlineStatus("Registry online", `Chain ${chainId} · contract reachable`, "verified");
    } catch (error) {
        configRequest = null;
        const message = error.name === "TimeoutError" ? "The registry check timed out. Retry when the network is ready." : error.message;
        setOnlineStatus("Registry unavailable", message, "error");
    } finally {
        $("retry-connection").disabled = false;
    }
}

function watchWallet(provider) {
    if (!provider || watchedWallets.has(provider)) return;
    watchedWallets.add(provider);
    for (const event of ["accountsChanged", "chainChanged", "disconnect"]) {
        provider.on?.(event, () => {
            if (state.dismissed || state.walletBusy || (state.provider && state.provider !== provider)) return;
            if (accountDialog.open) accountDialog.close();
            clearPrivateState();
            state.account = null;
            state.read = null;
            state.writer = null;
            state.provider = null;
            refreshChrome();
            syncWallet();
        });
    }
}

function feedback(id, message = "", kind = "") {
    const node = $(id);
    node.textContent = message;
    node.dataset.kind = kind;
    if (id === "upload-feedback") syncWorkspacePresentation();
}

function toast(message) {
    const node = $("toast");
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 2800);
}

function setStep(step) {
    activeStep = step;
    scene?.setStep(step);
}

async function startProcessArt() {
    let graphics;
    try {
        graphics = await import("./coins.mjs");
        stopWorkspaceDither ??= graphics.mountDither($("workspace-dither"), { variant: "dashboard" });
    } catch (error) {
        console.warn("Dvault could not load its decorative graphics.", error);
        return;
    }
    function startScene() {
        try {
            scene = graphics.mountCoins($("coin-scene"));
            scene?.setStep(activeStep);
            scene?.setBusy(!$("upload-visual").hidden && state.busy);
        } catch (error) {
            // Keep the static workflow icons if graphics cannot initialize.
            const canvas = $("coin-scene");
            canvas.dataset.renderer = "fallback";
            canvas.dataset.fallbackReason = "initialization-error";
            console.warn("Dvault is showing its workflow fallback because the 3D scene could not initialize.", error);
        }
    }

    if (!("IntersectionObserver" in window)) {
        startScene();
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        startScene();
    }, { rootMargin: "40px" });
    observer.observe($("hero-art"));
}

function short(value) {
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function userRejected(error) {
    const code = error?.code ?? error?.info?.error?.code;
    return code === 4001 || code === "ACTION_REJECTED";
}

function context(documentId, revision, owner = state.account) {
    return { chainId, contract: config.versionVaultAddress, owner, documentId, revision };
}

function pendingSlot() {
    return state.account && state.epochLabel
        ? `dvault.v2.pending:${chainId}:${config.versionVaultAddress}:${state.epochLabel}:${state.account.toLowerCase()}`
        : null;
}

function readPending() {
    const slot = pendingSlot();
    if (!slot) return null;
    if (state.pendingMemory.has(slot)) return state.pendingMemory.get(slot);
    try {
        return JSON.parse(localStorage.getItem(slot));
    } catch {
        return null;
    }
}

function persistPending(slot, record) {
    if (!slot) return false;
    try {
        if (record) localStorage.setItem(slot, JSON.stringify(record));
        else localStorage.removeItem(slot);
        state.pendingMemory.delete(slot);
        return true;
    } catch {
        state.pendingMemory.set(slot, record);
        return false;
    }
}

function putPending(slot, record) {
    if (persistPending(slot, record)) return;
    $("recovery-strip").querySelector("p").textContent =
        "Browser storage is unavailable. Keep this tab open until the proof is confirmed.";
}

let draftDatabase;
function drafts() {
    draftDatabase ??= new Promise((resolve, reject) => {
        const request = indexedDB.open("dvault-v2-encrypted-drafts", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("envelopes");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Close older Dvault tabs and try again."));
    }).catch((error) => {
        draftDatabase = null;
        throw error;
    });
    return draftDatabase;
}

async function draftOperation(mode, action) {
    const db = await drafts();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("envelopes", mode);
        const request = action(tx.objectStore("envelopes"));
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error);
    });
}

function deleteDraft(record) {
    return draftOperation("readwrite", (store) => store.delete(record.digest)).catch(() => {});
}

function resetUpload() {
    composer.reset();
    feedback("upload-input-feedback");
    $("proof-error-details").hidden = true;
    $("proof-error-details").open = false;
    $("proof-error-copy").textContent = "";
    $("discard").hidden = true;
    $("discard").dataset.confirm = "";
    $("discard").textContent = "Discard pending upload";
    $("file-fields").hidden = false;
    $("upload-inputs").hidden = false;
    $("composer-actions").append(submitButton);
    submitButton.hidden = false;
    $("view-upload-result").hidden = true;
    state.result = null;
    submitButton.firstElementChild.textContent = "Encrypt and save";
    $("upload-destination").textContent = "";
    $("progress-file").textContent = "";
    $("progress-file").hidden = true;
    state.picked = null;
    state.target = null;
    updateFile();
    showProgress(0, "");
}

function resetKeyForm() {
    $("key-form").reset();
    $("new-key-output").textContent = "";
    $("new-key-panel").hidden = true;
    $("key-input").parentElement.hidden = false;
    $("key-input").required = true;
    $("key-help").open = false;
    feedback("key-recovery-status");
    feedback("key-feedback");
}

function clearPrivateState() {
    state.epoch += 1;
    state.key = null;
    state.docs = [];
    state.total = 0;
    state.document = null;
    state.versions = [];
    state.versionsTotal = 0;
    state.libraryBusy = false;
    state.historyBusy = false;
    $("search").value = "";
    $("versions").replaceChildren();
    $("document-heading").textContent = "Document";
    $("document-subtitle").textContent = "";
    feedback("document-feedback");
    if (keyDialog.open) keyDialog.close();
    composer.hidden = true;
    $("close-composer").hidden = true;
    $("composer-empty").hidden = false;
    historyView.hidden = true;
    $("history-empty").hidden = false;
    $("append-version").hidden = true;
    resetUpload();
    resetKeyForm();
}

function renderSetup() {
    const phase = !state.account ? 0 : !state.key ? 1 : 2;
    const [title, copy, tip, action] = setupStages[phase];
    $("setup-title").textContent = title;
    $("setup-copy").textContent = copy;
    $("setup-tip").textContent = tip;
    $("setup-next").textContent = state.walletBusy ? "Waiting for wallet…" : action;
    $("setup-next").disabled = state.walletBusy;
    for (const step of setupDialog.querySelectorAll("[data-setup-step]")) {
        const index = Number(step.dataset.setupStep);
        step.dataset.state = index < phase ? "complete" : index === phase ? "current" : "next";
        if (index === phase) step.setAttribute("aria-current", "step");
        else step.removeAttribute("aria-current");
    }
}

function openSetup() {
    feedback("setup-feedback");
    renderSetup();
    if (!setupDialog.open) setupDialog.showModal();
    $("setup-next").focus();
}

function refreshChrome() {
    const connected = Boolean(state.account);
    const unlocked = Boolean(state.key);
    document.body.dataset.vaultState = unlocked ? "ready" : connected ? "locked" : "guest";
    const wallet = $("wallet-button");
    wallet.hidden = !isApp;
    wallet.dataset.state = state.walletBusy ? "waiting" : connected ? "connected" : "disconnected";
    wallet.textContent = state.walletBusy ? "Checking wallet" : connected ? "Wallet connected" : "Connect wallet";
    wallet.setAttribute("aria-label", connected ? "Wallet connected, account details" : wallet.textContent);
    wallet.disabled = state.walletBusy || state.busy;
    $("library-bar").hidden = !unlocked;
    $("lock-button").hidden = !unlocked;
    $("lock-button").disabled = state.busy;
    $("refresh").hidden = !unlocked;
    $("refresh").disabled = state.libraryBusy || state.busy;
    $("search").disabled = !unlocked;
    $("new-document").hidden = !unlocked;
    $("new-document").disabled = state.busy || state.walletBusy;
    $("empty-action").disabled = state.busy || state.walletBusy;
    $("workspace-state").hidden = !connected;
    $("workspace-state").textContent = unlocked ? "Vault unlocked" : "Vault locked";
    $("library-status").textContent = `${state.total} ${state.total === 1 ? "document" : "documents"}`;
    $("composer-empty").textContent = unlocked ? "Choose Add document or open a document to save a new version."
        : "Unlock your vault to upload.";
    const pending = unlocked && readPending();
    $("recovery-strip").hidden = !pending || !composer.hidden || state.busy;
    if (pending) {
        $("resume").textContent = pending.txHash ? "Check confirmation" : pending.cid ? "Review pending file" : "Review encrypted draft";
        $("recovery-strip").querySelector("p").textContent = pending.cid
            ? "Stored on IPFS. The proof is still pending."
            : "The encrypted draft is on this device.";
    }
    if (setupDialog.open) renderSetup();
    renderLibrary();
}

async function syncWallet(requestAccess = false) {
    if (state.walletBusy) return;
    state.walletBusy = true;
    refreshChrome();
    feedback("wallet-feedback");
    try {
        const injected = findWallet();
        watchWallet(injected);
        if (!injected) {
            if (requestAccess) throw new Error("Open Dvault in a desktop browser with MetaMask or in the MetaMask mobile browser.");
            return;
        }
        const settings = await environment();
        if (!settings) throw new Error("Couldn’t reach the Dvault server. Reload the page to try again.");
        if (!ethers || !config.versionVaultAddress || !config.versionVaultAbi?.length) {
            throw new Error("The V2 contract is missing. Run npm run deploy and reload.");
        }
        let accounts = await injected.request({ method: requestAccess ? "eth_requestAccounts" : "eth_accounts" });
        let current = Number(await injected.request({ method: "eth_chainId" }));
        if (requestAccess && current !== chainId) {
            try {
                await injected.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
            } catch (error) {
                if (![4902, -32603].includes(error?.code) && error?.data?.originalError?.code !== 4902) throw error;
                await injected.request({
                    method: "wallet_addEthereumChain",
                    params: [{ chainId: chainHex, chainName: "Dvault Hardhat Demo", rpcUrls: [settings.networkRpcUrl],
                        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 } }]
                });
                if (Number(await injected.request({ method: "eth_chainId" })) !== chainId) {
                    await injected.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
                }
            }
            current = Number(await injected.request({ method: "eth_chainId" }));
            accounts = await injected.request({ method: "eth_accounts" });
        }
        if (!accounts.length || current !== chainId || state.dismissed) {
            if (state.account) clearPrivateState();
            state.account = null;
            state.read = null;
            state.writer = null;
            if (requestAccess) throw new Error("Select your demo account and switch MetaMask to the Dvault demo chain.");
            return;
        }
        const account = ethers.getAddress(accounts[0]);
        if (state.account === account && state.read) return;
        clearPrivateState();
        const wallet = new ethers.BrowserProvider(injected);
        const rpcUrl = new URL(settings.registryRpcUrl || settings.networkRpcUrl, location.origin).href;
        const rpc = new ethers.JsonRpcProvider(rpcUrl, chainId, {
            staticNetwork: true, batchMaxCount: 1
        });
        const [code, signer, anchor] = await Promise.all([
            rpc.getCode(config.versionVaultAddress),
            wallet.getSigner(account),
            rpc.getBlock(config.versionVaultStartBlock ?? 0)
        ]);
        if (code === "0x" || !anchor?.hash) {
            throw new Error("The demo chain is available, but its V2 contract is missing. Run npm run deploy again.");
        }
        const currentAccounts = await injected.request({ method: "eth_accounts" });
        const currentChain = Number(await injected.request({ method: "eth_chainId" }));
        if (currentAccounts[0]?.toLowerCase() !== account.toLowerCase() || currentChain !== chainId) {
            throw new Error("Your wallet changed during connection. Select the demo account and reconnect.");
        }
        state.account = account;
        state.provider = injected;
        state.epochLabel = anchor.hash;
        state.read = new ethers.Contract(config.versionVaultAddress, config.versionVaultAbi, rpc);
        state.writer = new ethers.Contract(config.versionVaultAddress, config.versionVaultAbi, signer);

    } catch (error) {
        state.account = null;
        state.provider = null;
        state.read = null;
        state.writer = null;
        clearPrivateState();
        feedback("wallet-feedback", userRejected(error)
            ? "Wallet request cancelled. Connect again when you’re ready."
            : (error?.message?.length < 190 ? error.message : "Couldn’t connect to the demo network. Check the app server, Hardhat, and your wallet."));
    } finally {
        state.walletBusy = false;
        refreshChrome();
    }
}

async function disconnect() {
    state.dismissed = true;
    if (accountDialog.open) accountDialog.close();
    clearPrivateState();
    state.account = null;
    state.provider = null;
    state.read = null;
    state.writer = null;
    refreshChrome();
    feedback("wallet-feedback");
    setStep(0);
    $("wallet-button").focus();
    toast("Wallet disconnected from this vault");
}

function openKey(fromSetup = false) {
    resumeSetupEpoch = fromSetup ? state.epoch : null;
    resetKeyForm();
    keyDialog.showModal();
    $("key-input").focus();
}

function primary() {
    if (!state.account) {
        openSetup();
    } else if (!state.key) {
        openKey();
    } else {
        beginUpload();
    }
}

async function unlock(event) {
    event.preventDefault();
    const submit = $("unlock-submit");
    if (submit.disabled) return;
    const epoch = state.epoch;
    submit.disabled = true;
    try {
        const created = !$("new-key-panel").hidden;
        if (created && !$("key-saved").checked) {
            throw new Error("Save your recovery key before continuing.");
        }
        const key = await importRecoveryKey(created ? $("new-key-output").textContent : $("key-input").value);
        const [records, total] = await state.read.listDocuments(state.account, 0, pageSize);
        if (epoch !== state.epoch || !keyDialog.open) return;
        if (records.length) {
            if (created) throw new Error("This account has saved documents. Use the original key to unlock them.");
            try {
                await openLabel(key, context(records[0].id, 0), records[0].sealedLabel);
            } catch {
                throw new Error("This recovery key doesn’t unlock the documents registered by this wallet.");
            }
        } else if (readPending()?.sealedLabel) {
            const pending = readPending();
            if (created) throw new Error("This account has an unfinished upload. Use its original key.");
            try {
                await openLabel(key, context(pending.id, 0), pending.sealedLabel);
            } catch {
                throw new Error("This recovery key doesn’t unlock the pending document.");
            }
        }
        if (epoch !== state.epoch || !keyDialog.open) return;
        const docs = await decodeDocuments(records, key);
        if (epoch !== state.epoch || !keyDialog.open) return;
        state.key = key;
        state.docs = docs;
        state.total = Number(total);
        keyDialog.close();
        refreshChrome();
        toast("Vault unlocked");
    } catch (error) {
        if (epoch === state.epoch) feedback("key-feedback",
            error?.message?.length < 155 ? error.message : "Couldn’t read the vault from the chain. Check your connection.", "error");
    } finally {
        submit.disabled = false;
    }
}

async function decodeDocuments(records, key) {
    const owner = state.account;
    return Promise.all(records.map(async (record) => {
        let name;
        try {
            name = await openLabel(key, context(record.id, 0, owner), record.sealedLabel);
        } catch {
            name = null;
        }
        return {
            id: record.id,
            name: name || null,
            count: Number(record.versionCount),
            updatedAt: Number(record.updatedAt)
        };
    }));
}

async function loadLibrary(more = false) {
    if (!state.key || state.libraryBusy) return;
    const epoch = state.epoch;
    const ticket = ++state.libraryFetch;
    const current = () => epoch === state.epoch && ticket === state.libraryFetch;
    const offset = more ? state.docs.length : 0;
    state.libraryBusy = true;
    feedback("library-feedback", "Reading the registry…");
    refreshChrome();
    try {
        const [records, total] = await state.read.listDocuments(state.account, offset, pageSize);
        if (!current()) return;
        const decoded = await decodeDocuments(records, state.key);
        if (!current()) return;
        state.docs = more ? [...state.docs, ...decoded.filter((record) => !state.docs.some(({ id }) => id === record.id))] : decoded;
        state.total = Number(total);
        feedback("library-feedback");
    } catch {
        if (current()) feedback("library-feedback", "Couldn’t read the registry. Use Refresh to try again.", "error");
    } finally {
        if (current()) {
            state.libraryBusy = false;
            refreshChrome();
        }
    }
}

function create(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
}

function renderLibrary() {
    const query = $("search").value.trim().toLowerCase();
    const docs = state.docs.filter((doc) => !query || doc.name?.toLowerCase().includes(query));
    const empty = $("empty");
    empty.hidden = docs.length > 0;
    $("more-documents").hidden = !state.key || state.docs.length >= state.total;
    $("more-documents").disabled = state.libraryBusy;
    if (!empty.hidden) {
        const disconnected = !state.account;
        const locked = !state.key;
        $("empty-title").textContent = disconnected ? "Wallet required" : locked ? "Recovery key required" : query ? "No matches" : "No documents yet";
        $("empty-copy").textContent = disconnected ? "Connect a wallet to access your vault."
            : locked ? "Open your documents with your recovery key."
            : query ? "Try another name or load more documents." : "Add a file to start its version history.";
        $("empty-action").hidden = disconnected || !locked;
    }
    const list = $("document-list");
    // Keep focus on the selected document when status labels update.
    const focusedId = document.activeElement?.dataset.document;
    list.replaceChildren();
    for (const doc of docs) {
        const item = create("li");
        const button = create("button", "document-row");
        button.type = "button";
        button.dataset.document = doc.id;
        if (state.document?.id === doc.id) button.setAttribute("aria-current", "true");
        const icon = create("span", "doc-icon");
        icon.setAttribute("aria-hidden", "true");
        const title = create("span", "doc-title", doc.name || "Locked document " + short(doc.id));
        const count = create("span", "doc-meta", `${doc.count} ${doc.count === 1 ? "version" : "versions"}`);
        const arrow = create("span", "doc-next", "→");
        arrow.setAttribute("aria-hidden", "true");
        button.append(icon, title, count, arrow);
        button.addEventListener("click", () => openDocument(doc));
        item.append(button);
        list.append(item);
        if (doc.id === focusedId) button.focus({ preventScroll: true });
    }
    syncWorkspacePresentation();
}

function updateFile() {
    const file = state.picked;
    $("file-name").textContent = file?.name ?? "Choose a file or drop it here";
    $("file-detail").textContent = file ? `${new Intl.NumberFormat().format(file.size)} bytes · Ready to encrypt` : "Up to 20 MiB";
    $("drop-zone").classList.toggle("has-file", Boolean(file));
}

function chooseFile(file) {
    if (file?.size > MAX_FILE_BYTES) {
        $("file-input").value = "";
        state.picked = null;
        updateFile();
        setProgressFile();
        feedback("upload-input-feedback", "Choose a file up to 20 MiB.", "error");
        return;
    }
    state.picked = file ?? null;
    feedback("upload-input-feedback");
    updateFile();
    showProgress(0, "");
    setProgressFile(file?.name);
}

function setProgressFile(name, revision) {
    const label = $("progress-file");
    label.textContent = name ? `${name}${revision ? ` · Version ${revision}` : ""}` : "";
    label.hidden = !name;
    $("process-empty").hidden = Boolean(name) || !$("upload-visual").hidden;
    syncWorkspacePresentation();
}

const uploadStates = {
    encrypt: ["Encrypting on this device", "lock"],
    transfer: ["Uploading encrypted bytes", "upload"],
    pin: ["Waiting for IPFS storage", "box"],
    stored: ["Encrypted file stored", "box"],
    sign: ["Waiting for wallet approval", "sign"],
    confirm: ["Confirming the proof", "network"],
    done: ["Proof recorded", "shield"],
    pending: ["File stored · Proof not recorded", "box"],
    draft: ["Encrypted draft · Upload paused", "lock"],
    error: ["Action needed", "history"]
};

function showProgress(stage, text, kind = "", phase = ["encrypt", "transfer", "sign", "done"][stage]) {
    if (text && phase === "stored") playSaveMilestone("stored");
    else if (text && phase === "done") playSaveMilestone("recorded");
    else if (!text || kind === "error" || ["pending", "draft", "error"].includes(phase)) clearSaveMilestone();
    for (const item of document.querySelectorAll("[data-progress]")) {
        const step = Number(item.dataset.progress);
        item.dataset.state = step < stage ? "done" : step === stage && text ? (kind === "error" || kind === "paused" ? kind : "working") : "";
        if (step === stage && text) item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
    }
    const visual = $("upload-visual");
    visual.hidden = !text;
    visual.dataset.phase = phase;
    $("save-panel").dataset.phase = text ? phase : "idle";
    $("process-empty").hidden = Boolean(text) || !$("progress-file").hidden;
    const [title, mark] = uploadStates[visual.dataset.phase] ?? uploadStates.encrypt;
    $("upload-state-title").textContent = title;
    visual.querySelector(".upload-mark use").setAttribute("href", `/v2/assets/proof-icons.svg#${mark}`);
    $("transfer-status").hidden = phase !== "transfer" || kind === "error";
    feedback("upload-feedback", text, kind);
    setStep(phase === "pending" ? 1 : Math.min(stage, 2));
    scene?.setBusy(Boolean(text) && state.busy && !["pending", "draft", "done", "error"].includes(phase));
    syncWorkspacePresentation();
}

function sendEnvelope(envelope, token, needsToken, epoch) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/v2/upload");
        request.responseType = "json";
        request.timeout = 135_000;
        request.setRequestHeader("Content-Type", "application/octet-stream");
        if (needsToken) request.setRequestHeader("X-Dvault-Demo-Token", token);
        const meter = $("transfer-progress");
        meter.removeAttribute("value");
        $("transfer-amount").textContent = "Sending…";
        request.upload.onprogress = (event) => {
            if (epoch !== state.epoch || !event.lengthComputable) return;
            const percent = Math.min(100, Math.round(event.loaded * 100 / event.total));
            meter.value = percent;
            $("transfer-amount").textContent = `${percent}%`;
        };
        request.upload.onload = () => {
            if (epoch === state.epoch) showProgress(1, "Transfer complete. The server is pinning the encrypted bytes to IPFS.", "", "pin");
        };
        request.onload = () => {
            if (request.status < 200 || request.status >= 300) {
                reject(new Error(request.response?.error || "Storage service rejected the upload. Your encrypted draft is still saved."));
                return;
            }
            resolve(request.response);
        };
        request.onerror = () => reject(new Error("Connection lost. Retry to send the saved encrypted draft."));
        request.ontimeout = () => reject(new Error("Storage request timed out. Retry to send the saved encrypted draft."));
        request.onabort = () => reject(new Error("Upload was interrupted. Your encrypted draft is still saved."));
        request.send(envelope);
    });
}

function uploadBusy(busy) {
    state.busy = busy;
    for (const node of composer.querySelectorAll("button, input")) node.disabled = busy;
    submitButton.disabled = busy;
    $("close-composer").disabled = busy;
    $("discard").disabled = busy;
    $("append-version").disabled = busy || !state.document?.name;
    if (!busy) scene?.setBusy(false);
    refreshChrome();
}

function showPending(pending, message, failed = false) {
    $("file-fields").hidden = true;
    $("upload-inputs").hidden = Boolean(pending.cid);
    $("demo-token").required = !pending.cid && !$("token-field").hidden;
    $("discard").hidden = Boolean(pending.txHash);
    (pending.cid ? $("progress-actions") : $("composer-actions")).prepend(submitButton);
    submitButton.hidden = false;
    submitButton.firstElementChild.textContent = pending.txHash ? "Check confirmation" : pending.cid ? (failed ? "Retry blockchain proof" : "Approve blockchain proof") : "Retry encrypted upload";
    const phase = pending.txHash ? "confirm" : pending.cid ? "pending" : "draft";
    showProgress(pending.cid ? 2 : 1, message || (pending.txHash
        ? "Check whether the transaction has been confirmed."
        : pending.cid ? "Sign the version proof to finish."
            : "Retry to upload the same encrypted bytes."), failed ? "error" : "paused", phase);
}

async function beginUpload(target = null, { focusId = "composer-heading" } = {}) {
    if (state.busy || !state.key) return;
    const epoch = state.epoch;
    if (!composer.hidden && !state.result && state.target?.id === target?.id && !readPending()) {
        focusSection("composer-heading");
        return;
    }
    if (!composer.hidden && state.picked && !state.result && !readPending()) {
        feedback("upload-input-feedback", "Close this upload before changing its destination.", "error");
        focusSection("composer-heading");
        return;
    }
    resetUpload();
    const pending = readPending();
    state.target = target;
    $("upload-heading").textContent = pending ? "Finish pending upload" : target ? "New version" : "New document";
    $("upload-destination").textContent = !pending && target ? target.name : "";
    $("composer-empty").hidden = true;
    composer.hidden = false;
    $("close-composer").hidden = false;
    focusSection(focusId);
    const settings = await environment();
    if (epoch !== state.epoch || composer.hidden) return;
    $("token-field").hidden = !settings?.uploadTokenRequired;
    $("demo-token").required = Boolean(settings?.uploadTokenRequired) && !pending;
    if (pending) {
        showPending(pending);
        let label = state.docs.find(({ id }) => id === pending.id)?.name;
        if (!label && pending.sealedLabel) {
            try { label = await openLabel(state.key, context(pending.id, 0), pending.sealedLabel); } catch { /* Keep the draft name private. */ }
        }
        if (epoch === state.epoch && !composer.hidden && !state.picked) setProgressFile(label || "Encrypted draft", pending.revision);
    }
}

function hideComposer() {
    composer.hidden = true;
    $("close-composer").hidden = true;
    $("composer-empty").hidden = false;
    submitButton.hidden = true;
}

function closeComposer() {
    if (state.busy) return;
    hideComposer();
    if (!state.result && !readPending()) resetUpload();
    refreshChrome();
    if (!$("task-banner").hidden) $("task-action").focus();
    else focusSection("library-heading");
}

async function verifyWallet(record) {
    const [accounts, current] = await Promise.all([
        state.provider.request({ method: "eth_accounts" }),
        state.provider.request({ method: "eth_chainId" })
    ]);
    if (accounts[0]?.toLowerCase() !== record.owner.toLowerCase() || Number(current) !== chainId) {
        throw new Error("Return to the original wallet and demo network to record this proof.");
    }
}

async function prepareUpload(slot, epoch) {
    const file = state.picked;
    if (!file) throw new Error("Choose a document first.");
    const settings = await environment();
    if (!settings) throw new Error("The Dvault server is unavailable. Reload and try again.");
    const target = state.target;
    const id = target?.id ?? randomDocumentId();
    const revision = (target?.count ?? 0) + 1;
    const owner = state.account;
    const key = state.key;
    const slotContext = context(id, revision, owner);
    const note = $("version-note").value.trim();
    const record = { id, revision, owner };
    showProgress(0, "The original stays on this device.");
    focusSection("progress-heading");
    const [envelope, sealedLabel] = await Promise.all([
        sealFile(key, slotContext, file, note),
        target ? Promise.resolve(null) : sealLabel(key, slotContext, file.name)
    ]);
    record.digest = await digestEnvelope(envelope);
    if (sealedLabel) record.sealedLabel = sealedLabel;
    if (epoch !== state.epoch) throw new Error("Wallet changed. Reopen the vault and try again.");
    try {
        await draftOperation("readwrite", (store) => store.put(envelope, record.digest));
    } catch {
        throw new Error("Enable browser storage or make space before uploading. The file hasn’t been sent.");
    }
    if (epoch !== state.epoch) {
        await deleteDraft(record);
        throw new Error("Wallet changed. Reopen the vault and try again.");
    }
    if (!persistPending(slot, record)) {
        state.pendingMemory.delete(slot);
        await deleteDraft(record);
        throw new Error("Enable browser storage before uploading. The file hasn’t been sent.");
    }
    return record;
}

async function pinDraft(record, slot, epoch) {
    const settings = await environment();
    if (!settings || epoch !== state.epoch) throw new Error("Reconnect your vault before uploading.");
    const envelope = await draftOperation("readonly", (store) => store.get(record.digest));
    if (!envelope) throw new Error("The encrypted draft is missing. Discard it and select the original file again.");
    if (await digestEnvelope(envelope) !== record.digest) throw new Error("The stored draft fingerprint changed. Discard it and select the original file again.");
    if (epoch !== state.epoch) throw new Error("Wallet changed before upload.");
    const token = $("demo-token").value.trim();
    showProgress(1, "Sending the encrypted file. Your original document stays on this device.", "", "transfer");
    const result = await sendEnvelope(envelope, token, settings.uploadTokenRequired, epoch);
    if (!/^[a-z0-9]{46,100}$/i.test(result?.cid ?? "")) throw new Error("The storage service returned an invalid CID.");
    if (epoch === state.epoch) showProgress(1, "IPFS returned a content ID. Your wallet will now register the version proof.", "", "stored");
    record.cid = result.cid;
    if (persistPending(slot, record)) await deleteDraft(record);
    return record;
}

async function chainState(record, read) {
    const existing = await read.getDocument(record.id);
    const count = Number(existing.count);
    if (count >= record.revision) {
        const version = await read.getVersion(record.id, record.revision);
        if (existing.owner.toLowerCase() === record.owner.toLowerCase() &&
            version.digest.toLowerCase() === record.digest && version.cid === record.cid) {
            return "recorded";
        }
        throw new Error("This revision already has another proof. Discard this pending proof and start again from the latest version.");
    }
    if (count !== record.revision - 1 || (count && existing.owner.toLowerCase() !== record.owner.toLowerCase())) {
        throw new Error("The document history changed. Refresh the vault before trying again.");
    }
    return "available";
}

async function recordProof(record, slot, epoch, read, writer) {
    if (await chainState(record, read) === "recorded") return true;
    const rpc = read.runner;
    if (!record.txHash) {
        if (epoch !== state.epoch || !state.key) throw new Error("Unlock the original vault to sign this proof.");
        await verifyWallet(record);
        if (epoch !== state.epoch) throw new Error("Wallet changed before signing. Unlock the original vault to retry.");
        showProgress(2, "Encrypted file pinned. Confirm the proof in your wallet.");
        const tx = record.revision === 1
            ? await writer.createDocument(record.id, record.sealedLabel, record.cid, record.digest)
            : await writer.appendVersion(record.id, record.revision - 1, record.cid, record.digest);
        record.txHash = tx.hash;
        putPending(slot, record);
    }
    if (epoch === state.epoch) showProgress(2, "Transaction submitted. Waiting for the blockchain…", "", "confirm");
    const receipt = await rpc.waitForTransaction(record.txHash, 1, 25_000);
    if (receipt?.status === 0) {
        delete record.txHash;
        putPending(slot, record);
        throw new Error("The transaction reverted. Your file is pinned. You can retry the proof.");
    }
    if (await chainState(record, read) === "recorded") return true;
    if (receipt?.status === 1) {
        delete record.txHash;
        putPending(slot, record);
        throw new Error("The transaction didn’t record this proof. Check the version and retry.");
    }
    return false;
}

async function submitUpload(event) {
    event.preventDefault();
    if (state.busy || !state.key) return;
    const epoch = state.epoch;
    const slot = pendingSlot();
    const { read, writer } = state;
    let pending = readPending();
    if (!pending && !state.picked) {
        feedback("upload-input-feedback", "Choose a document first.", "error");
        $("file-input").focus();
        return;
    }
    feedback("upload-input-feedback");
    $("proof-error-details").hidden = true;
    $("proof-error-copy").textContent = "";
    uploadBusy(true);
    const attempt = async () => {
        pending = readPending() || pending;
        pending ??= await prepareUpload(slot, epoch);
        if (epoch !== state.epoch) return;
        const selectedName = state.picked?.name || state.docs.find(({ id }) => id === pending.id)?.name;
        if (selectedName) setProgressFile(selectedName, pending.revision);
        if (!pending.cid) await pinDraft(pending, slot, epoch);
        if (epoch !== state.epoch) return;
        const recorded = await recordProof(pending, slot, epoch, read, writer);
        if (recorded) {
            putPending(slot, null);
            await deleteDraft(pending);
        }
        if (epoch !== state.epoch) return;
        if (!recorded) {
            showPending(pending, "Transaction still pending. Check confirmation again shortly.");
            return;
        }
        showProgress(3, "Compare saved bytes when you verify and download a version.", "verified");
        hideComposer();
        $("discard").hidden = true;
        state.result = { id: pending.id, revision: pending.revision };
        $("view-upload-result").hidden = false;
        if (state.document?.id === pending.id) loadVersions();
        loadLibrary();
    };
    try {
        if (navigator.locks?.request) {
            await navigator.locks.request(slot, { ifAvailable: true }, async (lock) => {
                if (!lock) throw new Error("Another tab is working on this vault. Finish the upload there.");
                if (epoch === state.epoch) await attempt();
            });
        } else {
            await attempt();
        }
    } catch (error) {
        if (epoch !== state.epoch) return;
        pending = readPending() || pending;
        if (pending) {
            const specific = error?.message?.length < 195 ? error.message : null;
            const message = userRejected(error)
                ? "Wallet confirmation cancelled. Your encrypted file is pinned. Sign the proof when you’re ready."
                : pending.txHash ? "Transaction submitted. Check confirmation before trying to sign again."
                : specific || (pending.cid ? "Proof recording failed. Sign the proof again when you’re ready."
                    : "Couldn’t pin this draft. Retry to send the same encrypted bytes.");
            const diagnosis = describeSaveError(error, pending, message);
            $("proof-error-copy").textContent = diagnosis.detail;
            $("proof-error-details").hidden = !diagnosis.detail;
            showPending(pending, diagnosis.message, !userRejected(error) && !pending.txHash);
        } else {
            const stage = Number($("save-panel").querySelector("[aria-current=step]")?.dataset.progress ?? 0);
            const message = error?.message?.length < 155 ? error.message : null;
            const diagnosis = describeSaveError(error, {}, message || "Couldn’t encrypt or pin the file. Check the connection and retry.");
            $("proof-error-copy").textContent = diagnosis.detail;
            $("proof-error-details").hidden = !diagnosis.detail;
            showProgress(stage, diagnosis.message, "error", "error");
        }
    } finally {
        uploadBusy(false);
        if (state.result) $("view-upload-result").focus();
        else if (epoch === state.epoch && readPending()) focusSection("progress-heading");
    }
}

function discardPending() {
    const pending = readPending();
    if (!pending || pending.txHash || state.busy) return;
    if ($("discard").dataset.confirm !== "true") {
        $("discard").dataset.confirm = "true";
        $("discard").textContent = "Confirm discard";
        feedback("upload-feedback", "The encrypted copy may remain on IPFS. Discarding only clears this browser’s unfinished proof.");
        return;
    }
    putPending(pendingSlot(), null);
    deleteDraft(pending);
    closeComposer();
    toast("Unfinished proof cleared on this device");
}

function formatTime(timestamp) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp * 1000);
}

function versionRow(version) {
    const row = create("li", "version");
    const head = create("div", "version-head");
    const time = create("time", "", formatTime(version.timestamp));
    time.dateTime = new Date(version.timestamp * 1000).toISOString();
    head.append(create("strong", "", `Version ${version.number}`), time);
    const detail = create("details");
    const summary = create("summary", "", "Blockchain proof");
    const proof = create("dl");
    const txValue = create("dd", "", "Open proof to load");
    proof.append(
        create("dt", "", "Document ID"), create("dd", "", state.document.id),
        create("dt", "", "Encrypted CID"), create("dd", "", version.cid),
        create("dt", "", "Ciphertext SHA-256"), create("dd", "", version.digest),
        create("dt", "", "Transaction hash"), txValue
    );
    const note = create("p", "version-note");
    note.hidden = true;
    const actions = create("div", "version-actions");
    const download = create("button", "button button-small", "Verify & download");
    const copy = create("button", "button button-small", "Copy CID");
    download.type = copy.type = "button";
    download.addEventListener("click", () => downloadVersion(version, download, note));
    copy.addEventListener("click", async () => {
        if (await copyText(version.cid)) {
            copy.textContent = "CID copied";
            setTimeout(() => { copy.textContent = "Copy CID"; }, 1400);
        }
    });
    const comparison = create("div", "version-comparison");
    comparison.hidden = true;
    actions.append(download, copy);
    if (version.number > 1) {
        const compare = create("button", "button button-small", "Compare with previous");
        compare.type = "button";
        compare.addEventListener("click", () => compareVersion(version, compare, comparison));
        actions.append(compare);
    }
    detail.append(summary, proof);
    detail.addEventListener("toggle", async () => {
        if (!detail.open || version.txHash) return;
        const id = state.document?.id;
        const read = state.read;
        const account = state.account;
        if (!read || !id) return;
        try {
            txValue.textContent = "Reading the version event…";
            const filter = read.filters.VersionRecorded(account, id, version.number);
            const [event] = await read.queryFilter(filter, config.versionVaultStartBlock ?? 0, "latest");
            version.txHash = event?.transactionHash;
            txValue.textContent = version.txHash || "Transaction event unavailable";
        } catch {
            txValue.textContent = "Couldn’t read the event. Reopen proof to retry.";
        }
    });
    row.append(head, detail, note, actions, comparison);
    return row;
}

async function loadVersions(more = false, highlight = null) {
    if (!state.document || state.historyBusy) return;
    const epoch = state.epoch;
    const ticket = ++state.historyFetch;
    const id = state.document.id;
    const active = () => epoch === state.epoch && ticket === state.historyFetch && state.document?.id === id;
    const offset = more ? state.versions.length : 0;
    state.historyBusy = true;
    $("more-versions").disabled = true;
    feedback("document-feedback", "Reading version history…");
    try {
        const [records, total] = await state.read.listVersions(id, offset, pageSize);
        if (!active()) return;
        if (more && Number(total) !== state.versionsTotal) {
            $("versions").replaceChildren();
            state.versions = [];
            state.historyBusy = false;
            return loadVersions();
        }
        const decoded = records.map((entry, index) => ({
            number: Number(total) - offset - index, cid: entry.cid,
            digest: entry.digest, timestamp: Number(entry.timestamp)
        }));
        state.versions = more ? [...state.versions, ...decoded] : decoded;
        state.versionsTotal = Number(total);
        state.document.count = Number(total);
        $("document-subtitle").textContent = `${total} ${total === 1n ? "version" : "versions"} · Append-only registry`;
        if (!more) $("versions").replaceChildren();
        for (const item of decoded) {
            const row = versionRow(item);
            $("versions").append(row);
            if (item.number === highlight) row.classList.add("is-recorded");
        }
        $("more-versions").hidden = state.versions.length >= state.versionsTotal;
        feedback("document-feedback", highlight ? `Version ${highlight} confirmed on-chain. Verify & download to check the stored bytes.` : "", highlight ? "verified" : "");
    } catch {
        if (active()) feedback("document-feedback", "Couldn’t read the version history. Select this document again to retry.", "error");
    } finally {
        if (active()) {
            state.historyBusy = false;
            $("more-versions").disabled = false;
        }
    }
}

function openDocument(doc, highlight = null) {
    if (!state.key) return;
    state.historyBusy = false;
    state.document = { ...doc };
    state.versions = [];
    state.versionsTotal = 0;
    $("versions").replaceChildren();
    $("more-versions").hidden = true;
    $("append-version").disabled = !doc.name;
    $("document-heading").textContent = doc.name || "Locked document";
    $("document-subtitle").textContent = "";
    $("history-empty").hidden = true;
    $("append-version").hidden = false;
    historyView.hidden = false;
    renderLibrary();
    focusSection("history-heading");
    loadVersions(false, highlight);
}

async function fetchVerifiedFile(key, scope, version) {
    const response = await fetch(`/api/v2/blob/${encodeURIComponent(version.cid)}`, {
        cache: "no-store", signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok) throw new Error("Couldn’t retrieve this ciphertext from IPFS. Try again shortly.");
    return openFile(key, scope, await response.arrayBuffer(), version.digest);
}

function isComparable({ metadata, blob }) {
    return blob.size <= 256 * 1024 && (/^text\//i.test(metadata.type) ||
        /\.(txt|md|csv|log|json|xml)$/i.test(metadata.name));
}

function diffLines(older, newer) {
    const before = older.replaceAll("\r\n", "\n").split("\n");
    const after = newer.replaceAll("\r\n", "\n").split("\n");
    if (before.length > 500 || after.length > 500) {
        throw new Error("The inline comparison supports up to 500 lines. Download both versions to compare them.");
    }
    const stride = after.length + 1;
    const lengths = new Uint16Array((before.length + 1) * stride);
    for (let i = before.length - 1; i >= 0; i--) {
        for (let j = after.length - 1; j >= 0; j--) {
            lengths[i * stride + j] = before[i] === after[j]
                ? 1 + lengths[(i + 1) * stride + j + 1]
                : Math.max(lengths[(i + 1) * stride + j], lengths[i * stride + j + 1]);
        }
    }
    const changes = [];
    let i = 0;
    let j = 0;
    while (i < before.length || j < after.length) {
        if (i < before.length && j < after.length && before[i] === after[j]) {
            i += 1;
            j += 1;
        } else if (j < after.length && (i === before.length ||
            lengths[i * stride + j + 1] > lengths[(i + 1) * stride + j])) {
            changes.push({ kind: "added", line: j + 1, text: after[j++] });
        } else {
            changes.push({ kind: "removed", line: i + 1, text: before[i++] });
        }
    }
    return changes;
}

async function compareVersion(version, button, panel) {
    if (!state.key || !state.document || button.disabled) return;
    if (!panel.hidden) {
        panel.hidden = true;
        panel.replaceChildren();
        button.textContent = "Compare with previous";
        return;
    }
    const epoch = state.epoch;
    const id = state.document.id;
    const { read, key } = state;
    const previousNumber = version.number - 1;
    const currentScope = context(id, version.number);
    const previousScope = context(id, previousNumber);
    const isCurrent = () => epoch === state.epoch && !historyView.hidden && panel.isConnected && state.document?.id === id;
    button.disabled = true;
    feedback("document-feedback", "Verifying and decrypting both versions on this device…");
    try {
        const previous = await read.getVersion(id, previousNumber);
        const [before, after] = await Promise.all([
            fetchVerifiedFile(key, previousScope, previous), fetchVerifiedFile(key, currentScope, version)
        ]);
        if (!isCurrent()) return;
        if (!isComparable(before) || !isComparable(after)) {
            throw new Error("Inline comparison supports text files up to 256 KiB. Download both verified versions to compare other file types.");
        }
        const changes = diffLines(await before.blob.text(), await after.blob.text());
        if (!isCurrent()) return;
        panel.append(create("strong", "", `Changes from v${previousNumber} to v${version.number}`));
        if (after.metadata.note) panel.append(create("p", "version-note", after.metadata.note));
        if (changes.length) {
            const list = create("ul", "diff-lines");
            for (const { kind, line, text } of changes) {
                const item = create("li", kind, `${kind === "added" ? "+" : "−"} ${line}  ${text}`);
                item.setAttribute("aria-label", `${kind} line ${line}: ${text}`);
                list.append(item);
            }
            panel.append(list);
        } else {
            panel.append(create("p", "version-note", "No text lines changed."));
        }
        panel.hidden = false;
        button.textContent = "Hide comparison";
        feedback("document-feedback", "Both versions matched their on-chain fingerprints.", "verified");
    } catch (error) {
        if (isCurrent()) feedback("document-feedback", error?.message?.length < 175
            ? error.message : "Couldn’t compare these versions.", "error");
    } finally {
        button.disabled = false;
    }
}

async function downloadVersion(version, button, note) {
    if (!state.key || !state.document || button.disabled) return;
    const epoch = state.epoch;
    const id = state.document.id;
    const readContext = context(id, version.number);
    const key = state.key;
    const current = () => epoch === state.epoch && state.document?.id === id && !historyView.hidden;
    button.disabled = true;
    feedback("document-feedback", "Retrieving ciphertext and checking its on-chain fingerprint…");
    try {
        const { metadata, blob } = await fetchVerifiedFile(key, readContext, version);
        if (!current()) return;
        note.textContent = metadata.note ? `Version note · ${metadata.note}` : "No version note";
        note.hidden = false;
        const url = URL.createObjectURL(blob);
        const anchor = create("a");
        anchor.href = url;
        anchor.download = metadata.name.replace(/[\x00-\x1f/\\]/g, "_") || "document";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        feedback("document-feedback", `Version ${version.number} matched the on-chain fingerprint and decrypted on this device.`, "verified");
    } catch (error) {
        if (current()) feedback("document-feedback", error?.message?.length < 170 ? error.message : "Couldn’t verify this version. Try again.", "error");
    } finally {
        button.disabled = false;
    }
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        toast("Copied to clipboard");
        return true;
    } catch {
        toast("Clipboard unavailable. Select and copy the text.");
        return false;
    }
}

for (const button of document.querySelectorAll("[data-step]")) {
    button.addEventListener("click", () => setStep(Number(button.dataset.step)));
}
for (const button of document.querySelectorAll("[data-close]")) {
    button.addEventListener("click", () => button.closest("dialog").close());
}
$("privacy-button").addEventListener("click", () => $("help-dialog").showModal());
async function requestWalletAccess() {
    feedback("setup-feedback");
    state.dismissed = false;
    await syncWallet(true);
    if (!setupDialog.open) return;
    if (!state.account) {
        feedback("setup-feedback", $("wallet-feedback").textContent, "error");
    }
    $("setup-next").focus();
}

$("wallet-button").addEventListener("click", () => {
    if (!state.account) {
        openSetup();
        requestWalletAccess();
        return;
    }
    $("account-address").textContent = state.account;
    if (!accountDialog.open) accountDialog.showModal();
});
$("disconnect-wallet").addEventListener("click", disconnect);
for (const id of ["empty-action", "new-document"]) $(id).addEventListener("click", primary);

$("setup-next").addEventListener("click", async () => {
    feedback("setup-feedback");
    if (!state.account) {
        await requestWalletAccess();
    } else if (!state.key) {
        setupDialog.close();
        openKey(true);
    } else {
        setupDialog.close();
        beginUpload();
    }
});

setupDialog.addEventListener("close", () => {
    if (state.account && !keyDialog.open && composer.hidden) {
        focusSection("library-heading");
    }
});
$("lock-button").addEventListener("click", () => {
    clearPrivateState();
    refreshChrome();
    setStep(0);
    toast("Vault locked");
});
async function recoveryKeyStatus() {
    const [, total] = await state.read.listDocuments(state.account, 0, 1);
    if (total > 0n) return "saved";
    if (readPending()) return "pending";
    return "empty";
}

$("key-form").addEventListener("submit", unlock);
$("key-help").addEventListener("toggle", async (event) => {
    if (!event.currentTarget.open || !state.read) return;
    const epoch = state.epoch;
    const current = () => epoch === state.epoch && keyDialog.open && $("key-help").open;
    feedback("key-recovery-status", "Checking this demo account…");
    try {
        const status = await recoveryKeyStatus();
        if (!current()) return;
        const copy = {
            empty: "This account has no saved files or unfinished upload. Choose Create a recovery key to keep using it.",
            saved: "This account has saved files. Use the key you originally saved to open them.",
            pending: "This account has an unfinished upload on this device. It still uses the key you created for it."
        };
        feedback("key-recovery-status", copy[status]);
    } catch {
        if (current()) feedback("key-recovery-status", "Couldn’t check this account. Check the demo connection and reopen this help.");
    }
});
$("generate-key").addEventListener("click", async () => {
    if (!$("new-key-panel").hidden) {
        resetKeyForm();
        $("generate-key").textContent = "Create a recovery key";
        return;
    }
    const epoch = state.epoch;
    const button = $("generate-key");
    button.disabled = true;
    try {
        const status = await recoveryKeyStatus();
        if (epoch !== state.epoch || !keyDialog.open) return;
        if (status !== "empty") {
            $("key-help").open = true;
            throw new Error("This demo account already uses a recovery key.");
        }
        $("key-help").open = false;
        $("new-key-output").textContent = generateRecoveryKey();
        $("new-key-panel").hidden = false;
        $("key-input").parentElement.hidden = true;
        $("key-input").required = false;
        button.textContent = "Use an existing key";
        feedback("key-feedback");
    } catch (error) {
        if (epoch === state.epoch) feedback("key-feedback", error?.message?.length < 155 ? error.message : "Couldn’t check the vault. Try again.", "error");
    } finally {
        button.disabled = false;
    }
});
$("copy-key").addEventListener("click", () => copyText($("new-key-output").textContent));
keyDialog.addEventListener("close", () => {
    if (!keyDialog.open) {
        resetKeyForm();
        $("generate-key").textContent = "Create a recovery key";
        const goBack = state.account && resumeSetupEpoch === state.epoch;
        resumeSetupEpoch = null;
        if (goBack) openSetup();
    }
});
$("file-input").addEventListener("change", (event) => chooseFile(event.target.files[0]));
const drop = $("drop-zone");
drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!state.busy) drop.classList.add("dragging");
});
drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("dragging");
    if (!state.busy) chooseFile(event.dataTransfer.files[0]);
});
$("upload-form").addEventListener("submit", submitUpload);
$("view-upload-result").addEventListener("click", async () => {
    const item = state.result;
    const epoch = state.epoch;
    if (!item || !state.key) return;
    try {
        let doc = state.docs.find(({ id }) => id === item.id);
        if (!doc) {
            const record = await state.read.getDocument(item.id);
            const name = await openLabel(state.key, context(item.id, 0), record.sealedLabel);
            doc = { id: item.id, name, count: Number(record.count) };
        }
        if (epoch !== state.epoch || state.result !== item) return;
        openDocument(doc, item.revision);
    } catch {
        if (epoch === state.epoch) feedback("upload-feedback", "The proof was saved. Refresh the document list to open it.", "verified");
    }
});
$("resume").addEventListener("click", () => beginUpload());
$("discard").addEventListener("click", discardPending);
$("close-composer").addEventListener("click", closeComposer);
$("refresh").addEventListener("click", () => loadLibrary());
$("search").addEventListener("input", renderLibrary);
$("more-documents").addEventListener("click", () => loadLibrary(true));
$("more-versions").addEventListener("click", () => loadVersions(true));
$("append-version").addEventListener("click", () => beginUpload(state.document));
function startWorkspace({ registryChecked = false } = {}) {
    startProcessArt();
    $("retry-connection").addEventListener("click", () => {
        configRequest = null;
        probeRegistry();
        syncWallet();
    });
    window.addEventListener("online", probeRegistry);
    window.addEventListener("offline", () => setOnlineStatus("Device offline", "Reconnect to your network and retry.", "error"));
    window.addEventListener("ethereum#initialized", () => {
        watchWallet(findWallet());
        syncWallet();
    }, { once: true });
    window.addEventListener("eip6963:announceProvider", (event) => {
        if (event.detail?.info?.rdns !== "io.metamask" || typeof event.detail?.provider?.request !== "function") return;
        discoveredWallet = event.detail.provider;
        watchWallet(discoveredWallet);
        if (!state.account && !state.walletBusy) syncWallet();
    });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    refreshChrome();
    if (!registryChecked) probeRegistry();
    syncWallet();
}

// Presentation only: panel geometry, focus, and views of the existing save state.
// Wallet requests, encryption, persistence, API calls and proof transactions stay above.
let expandedPanel = null;
let panelTransition = null;
let panelRequest = 0;
const borderMotions = new Map();
const borderPreference = matchMedia("(prefers-reduced-motion: reduce)");
let milestoneTimer;
let milestoneAnimation;

function resizePanel(id, focusControl = true) {
    const panel = $(id);
    if (!panel?.classList.contains("workspace-card")) return;
    const before = panel.getBoundingClientRect();
    const next = expandedPanel === id ? null : id;
    const request = ++panelRequest;
    expandedPanel = next;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    panelTransition?.skipTransition?.();
    const apply = () => {
        if (request !== panelRequest) return;
        $("app-frame").dataset.expandedPanel = next || "";
        for (const card of document.querySelectorAll(".workspace-card")) {
            card.inert = Boolean(next && card.id !== next);
            const control = card.querySelector(".panel-resize");
            const active = next === card.id;
            control.setAttribute("aria-expanded", String(active));
            control.querySelector(".panel-resize-label").textContent = active ? "Restore" : "Expand";
            const label = `${active ? "Restore" : "Expand"} ${card.querySelector("h1,h2").textContent}`;
            control.setAttribute("aria-label", label);
        }
        syncBorderMotion();
    };
    const focus = () => {
        const control = panel.querySelector(".panel-resize");
        if (focusControl && request === panelRequest && document.activeElement !== control) control.focus({ preventScroll: true });
    };
    if (!reduce && typeof document.startViewTransition === "function" && !document.hidden) {
        panelTransition = document.startViewTransition(apply);
        panelTransition.finished.then(focus).catch(() => {});
    } else {
        apply();
        const after = panel.getBoundingClientRect();
        if (!reduce && !document.hidden && before.width && before.height && after.width && after.height) {
            panel.animate([
                { transformOrigin: "0 0", transform: `translate(${before.left-after.left}px,${before.top-after.top}px) scale(${before.width/after.width},${before.height/after.height})`, opacity: .7 },
                { transformOrigin: "0 0", transform: "none", opacity: 1 }
            ], { duration: 380, easing: "cubic-bezier(.22,.8,.25,1)" });
        }
        focus();
    }
}

function revealPanel(id) {
    if (expandedPanel !== id) resizePanel(id);
    else $(id).querySelector(".panel-resize").focus({ preventScroll: true });
}

async function reviewCurrentTask() {
    if (state.result) {
        $("view-upload-result").click();
        revealPanel("history-panel");
    } else {
        const pending = state.key && readPending();
        if (pending && !state.busy && composer.hidden) {
            const epoch = state.epoch;
            const previous = { kind: $("upload-feedback").dataset.kind, message: $("upload-feedback").textContent, detail: $("proof-error-copy").textContent };
            await beginUpload(null, { focusId: "progress-heading" });
            if (epoch !== state.epoch) return;
            if (previous.kind === "error") {
                showPending(pending, previous.message, !pending.txHash);
                $("proof-error-copy").textContent = previous.detail;
                $("proof-error-details").hidden = !previous.detail;
            }
        }
        revealPanel("save-panel");
    }
}

function describeSaveError(error, pending, fallback) {
    const code = error?.code ?? error?.info?.error?.code;
    const reason = error?.reason || error?.info?.error?.message || error?.shortMessage || (error?.message?.length < 195 ? error.message : "");
    const detail = [code ? `Error code: ${String(code).slice(0,40)}` : "", reason ? String(reason).slice(0,240).replace(/0x[0-9a-f]{64,}/gi,"[transaction data]") : ""].filter(Boolean).join(" · ");
    let message = fallback;
    if (userRejected(error)) message = "Wallet approval was cancelled. Your encrypted file is saved; approve its blockchain proof when you’re ready.";
    else if (pending.txHash) message = "A transaction was submitted. Its result is not confirmed yet. Check confirmation before sending another proof.";
    else if (code === "CALL_EXCEPTION") message = "The contract rejected this proof. Your encrypted file is stored. Review the details before retrying.";
    else if (code === "INSUFFICIENT_FUNDS") message = "This wallet needs local test ETH for the proof transaction. Your encrypted file is stored.";
    else if (["NONCE_EXPIRED","REPLACEMENT_UNDERPRICED"].includes(code)) message = "The wallet reported a transaction-sequence conflict. Check its activity on the local demo network before retrying.";
    else if (["NETWORK_ERROR","TIMEOUT","SERVER_ERROR"].includes(code)) message = "The registry could not confirm the request. Check the local blockchain connection, then retry.";
    else if (pending.cid && !reason) message = "Your encrypted file is stored, but its blockchain proof was not recorded. No specific error was returned by the wallet.";
    return { message, detail };
}

function presentText(id, value) {
    const node = $(id);
    if (node.textContent !== value) node.textContent = value;
}

function syncWorkspacePresentation() {
    const ready = Boolean(state.key);
    const pending = ready ? readPending() : null;
    const phase = $("save-panel").dataset.phase || "idle";
    const failure = ready && $("upload-feedback").dataset.kind === "error";
    const query = $("search").value.trim().toLowerCase();
    const hasDocuments = state.total > 0 || state.docs.length > 0;
    $("library").dataset.hasDocuments = String(hasDocuments);
    $("app-frame").dataset.libraryPopulated = String(hasDocuments);
    for (const id of ["composer-gate","history-gate","activity-gate"]) {
        $(id).hidden = ready;
        presentText(id,!state.account ? "Connect wallet" : "Unlock vault");
    }
    $("library-bar").hidden = !ready || (!hasDocuments && !query && !state.libraryBusy && $("library-feedback").dataset.kind !== "error");
    $("library-bar").dataset.empty = String(!hasDocuments);
    $("library-status").textContent = `${state.total} registered${pending ? " · 1 pending" : ""}`;
    const pendingName = pending ? state.picked?.name || state.docs.find(doc => doc.id === pending.id)?.name || $("progress-file").textContent || "Encrypted file" : "Encrypted file";
    $("pending-document").hidden = !pending || Boolean(query && !pendingName.toLowerCase().includes(query));
    $("pending-document-name").textContent = pendingName;
    $("pending-document-status").textContent = pending?.txHash ? "Transaction submitted · Check confirmation" : pending?.cid ? "Stored on IPFS · Blockchain proof needed" : "Encrypted draft · Upload unfinished";
    if (pending && !query && !state.docs.length) $("empty").hidden = true;
    if (!$("empty").hidden) {
        $("empty-action").hidden = Boolean(query);
        $("empty-action").textContent = !state.account ? "Connect wallet" : !ready ? "Unlock vault" : "Add your first file";
    }
    const handedOff = !composer.hidden && $("upload-inputs").hidden;
    $("composer-handoff").hidden = !handedOff;
    composer.classList.toggle("is-handed-off", handedOff);
    $("composer-heading").textContent = handedOff ? "Upload complete" : "Upload file";
    $("history-empty").textContent = !state.account ? "Connect your wallet to access version history."
        : !ready ? "Unlock your vault to view version history."
        : pending && !hasDocuments ? "Confirm the pending proof to create your first version record."
        : !hasDocuments ? "Your confirmed versions will appear here."
        : "Select a document to inspect its versions.";
    $("save-panel").dataset.outcome = failure ? "error" : phase === "done" ? "success" : pending ? "pending" : "idle";
    const active = ready && (pending || state.busy || failure || state.result);
    $("task-banner").hidden = !active;
    $("task-banner").dataset.kind = failure ? "error" : state.result ? "success" : "working";
    presentText("task-title", !active ? "" : failure ? "Your file needs attention" : state.result ? "Version recorded" : state.busy ? "Saving your document" : pending?.txHash ? "Check the submitted transaction" : pending?.cid ? "File stored. Finish its blockchain proof." : "Your encrypted draft is ready to resume");
    presentText("task-copy", !active ? "" : failure ? "The save is unfinished. Open the activity to review the error and next step." : state.result ? "Your version now has a verifiable blockchain record." : state.busy ? $("upload-state-title").textContent : pending?.cid ? "The encrypted file is preserved; you don’t need to upload it again." : "Continue with the encrypted bytes already saved on this device.");
    presentText("task-action", state.result ? "View record" : state.busy ? "View progress" : failure ? "Review & retry" : "Review file");
    if (!ready) {
        $("proof-error-details").hidden = true;
        $("proof-error-copy").textContent = "";
    }
}

function initializePanels() {
    for (const panel of document.querySelectorAll(".workspace-card")) {
        const body = panel.querySelector(".panel-body");
        body.id ||= `${panel.id}-body`;
        const button = create("button", "panel-resize");
        button.type = "button";
        button.setAttribute("aria-label", `Expand ${panel.querySelector("h1,h2").textContent}`);
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-controls", body.id);
        const icon = create("span", "panel-resize-icon");
        icon.setAttribute("aria-hidden", "true");
        button.append(icon);
        button.append(create("span", "panel-resize-label", "Expand"));
        button.addEventListener("click", (event) => resizePanel(panel.id, event.detail === 0));
        panel.querySelector(".workspace-card-heading").append(button);
    }
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && expandedPanel && !document.querySelector("dialog[open]")) {
            event.preventDefault();
            resizePanel(expandedPanel);
        }
    });
    $("task-action").addEventListener("click", reviewCurrentTask);
    $("pending-document").addEventListener("click", reviewCurrentTask);
    $("show-save-activity").addEventListener("click", () => revealPanel("save-panel"));
    for (const id of ["composer-gate","history-gate","activity-gate"]) $(id).addEventListener("click",primary);
    syncWorkspacePresentation();
}

function clearSaveMilestone() {
    clearTimeout(milestoneTimer);
    milestoneAnimation?.cancel();
    $("save-milestone").hidden = true;
}

function playSaveMilestone(kind) {
    clearSaveMilestone();
    if (document.hidden || document.body.dataset.surface !== "app") return;
    const cue = $("save-milestone");
    cue.dataset.kind = kind;
    cue.hidden = false;
    $("milestone-title").textContent = kind === "stored" ? "Encrypted file uploaded" : "Version recorded";
    $("milestone-copy").textContent = kind === "stored" ? "Blockchain confirmation comes next." : "Its blockchain proof is now available.";
    if (!borderPreference.matches) milestoneAnimation = cue.animate([
        { opacity:0,transform:"translateY(10px) scale(.96)" },
        { opacity:1,transform:"none" }
    ], { duration:420,easing:"cubic-bezier(.2,.8,.25,1)" });
    milestoneTimer = setTimeout(() => { cue.hidden = true; },1900);
}

function traceKeyframes(width, height, radius = 14) {
    const w = Math.max(2,width-2), h = Math.max(2,height-2), r = Math.min(radius,w/3,h/3), d = r*Math.SQRT1_2;
    const points = [[r,1,0],[w-r,1,0],[w-r+d,r-d,45],[w,r,90],[w,h-r,90],[w-r+d,h-r+d,135],[w-r,h,180],[r,h,180],[r-d,h-r+d,225],[1,h-r,270],[1,r,270],[r-d,r-d,315],[r,1,360]];
    const distances = points.map((p,i) => i ? Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1]) : 0);
    const total = distances.reduce((sum,n) => sum+n,0);
    let distance = 0;
    return points.map(([x,y,angle],i) => {
        distance += distances[i];
        return { offset:distance/total,transform:`translate(${x-22}px,${y-1}px) rotate(${angle}deg)`,opacity:.75 };
    });
}

function syncBorderMotion() {
    const active = !document.hidden && !borderPreference.matches && document.body.dataset.surface === "app";
    for (const [panel,record] of borderMotions) {
        const w = panel.clientWidth, h = panel.clientHeight;
        if (!active || panel.inert || !w || !h) {
            record.animation?.pause();
            continue;
        }
        if (!record.animation || Math.abs(w-record.width)>.5 || Math.abs(h-record.height)>.5) {
            const progress = record.animation ? ((Number(record.animation.currentTime) || 0) % record.duration) / record.duration : record.phase;
            record.animation?.cancel();
            const radius = Math.max(2,parseFloat(getComputedStyle(panel).borderTopLeftRadius)-1 || 14);
            record.animation = record.trace.animate(traceKeyframes(w,h,radius),{ duration:record.duration,iterations:Infinity,direction:record.reverse ? "reverse" : "normal",easing:"linear" });
            record.animation.currentTime = progress*record.duration;
            record.width = w;
            record.height = h;
        }
        if (record.animation.playState !== "running") record.animation.play();
    }
}

function initializePanelMotion() {
    const seed = Math.random()>.5 ? 1 : 0;
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(syncBorderMotion) : null;
    document.querySelectorAll(".workspace-card").forEach((panel,index) => {
        const trace = create("span","panel-border-trace");
        trace.setAttribute("aria-hidden","true");
        panel.append(trace);
        const reverse = Boolean((index+seed)%2);
        panel.dataset.borderDirection = reverse ? "counterclockwise" : "clockwise";
        borderMotions.set(panel,{ trace,reverse,duration:12000+index*1600+Math.random()*2400,phase:Math.random(),width:0,height:0,animation:null });
        observer?.observe(panel);
    });
    document.addEventListener("visibilitychange",syncBorderMotion);
    document.addEventListener("visibilitychange",() => { if (document.hidden) clearSaveMilestone(); });
    borderPreference.addEventListener("change",() => {
        syncBorderMotion();
        if (borderPreference.matches) milestoneAnimation?.cancel();
    });
    if (!observer) window.addEventListener("resize",syncBorderMotion);
    syncBorderMotion();
}

initializePanels();
initializePanelMotion();
matchMedia("(max-width: 640px)").addEventListener("change", (event) => {
    if (event.matches && isApp && !expandedPanel && !composer.hidden && !composer.classList.contains("is-handed-off")) revealPanel("file-composer");
});
if (isApp) startWorkspace();

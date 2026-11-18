const { ethers } = window;
const config = window.BLOCKCHAIN_DRIVE_CONFIG || {};

const connectButton = document.getElementById("connectButton");
const disconnectButton = document.getElementById("disconnectButton");
const infoButton = document.getElementById("infoButton");
const closeInfoButton = document.getElementById("closeInfoButton");
const infoOverlay = document.getElementById("infoOverlay");
const successOverlay = document.getElementById("successOverlay");
const successVaultButton = document.getElementById("successVaultButton");
const closeSuccessButton = document.getElementById("closeSuccessButton");
const refreshButton = document.getElementById("refreshButton");
const uploadButton = document.getElementById("uploadButton");
const pickFileButton = document.getElementById("pickFileButton");
const heroUploadButton = document.getElementById("heroUploadButton");
const heroVaultButton = document.getElementById("heroVaultButton");
const homeNavButton = document.getElementById("homeNavButton");
const vaultNavButton = document.getElementById("vaultNavButton");
const copyRpcButton = document.getElementById("copyRpcButton");
const copyKeyButton = document.getElementById("copyKeyButton");
const copyLastTxButton = document.getElementById("copyLastTxButton");
const sortNewestButton = document.getElementById("sortNewestButton");
const sortOldestButton = document.getElementById("sortOldestButton");
const heroDitherElement = document.getElementById("heroDither");
const liquidChromeBackgroundElement = document.getElementById("liquidChromeBackground");

const homeScreen = document.getElementById("homeScreen");
const vaultScreen = document.getElementById("vaultScreen");
const uploadPanel = document.getElementById("uploadPanel");
const fileInput = document.getElementById("fileInput");
const fileNamePreview = document.getElementById("fileNamePreview");
const filesListElement = document.getElementById("filesList");
const statusBox = document.getElementById("statusBox");
const walletBadge = document.getElementById("walletBadge");
const walletBadgeText = document.getElementById("walletBadgeText");
const networkBadgeText = document.getElementById("networkBadgeText");
const walletSummary = document.getElementById("walletSummary");
const miniWalletLabel = document.getElementById("miniWalletLabel");
const contractSummary = document.getElementById("contractSummary");
const latestTxSummary = document.getElementById("latestTxSummary");
const walletAddressElement = document.getElementById("walletAddress");
const networkNameElement = document.getElementById("networkName");
const fileStorageAddressElement = document.getElementById("fileStorageAddress");
const accessControlAddressElement = document.getElementById("accessControlAddress");
const latestTxHashElement = document.getElementById("latestTxHash");
const successMessage = document.getElementById("successMessage");
const networkSettingsText = document.getElementById("networkSettingsText");
const starterPrivateKey = document.getElementById("starterPrivateKey");
const feedbackOverlay = document.getElementById("feedbackOverlay");
const bootOverlay = document.getElementById("bootOverlay");

const DITHER_VERTEX_SHADER = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

const DITHER_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uSpeed;
uniform float uBlockSize;
uniform float uIntensity;

varying vec2 vUv;

float dither8x8(vec2 position) {
    int x = int(mod(position.x, 8.0));
    int y = int(mod(position.y, 8.0));
    int index = x + y * 8;

    float m[64];
    m[0]=0.0;  m[1]=32.0; m[2]=8.0;  m[3]=40.0; m[4]=2.0;  m[5]=34.0; m[6]=10.0; m[7]=42.0;
    m[8]=48.0; m[9]=16.0; m[10]=56.0; m[11]=24.0; m[12]=50.0; m[13]=18.0; m[14]=58.0; m[15]=26.0;
    m[16]=12.0; m[17]=44.0; m[18]=4.0;  m[19]=36.0; m[20]=14.0; m[21]=46.0; m[22]=6.0;  m[23]=38.0;
    m[24]=60.0; m[25]=28.0; m[26]=52.0; m[27]=20.0; m[28]=62.0; m[29]=30.0; m[30]=54.0; m[31]=22.0;
    m[32]=3.0;  m[33]=35.0; m[34]=11.0; m[35]=43.0; m[36]=1.0;  m[37]=33.0; m[38]=9.0;  m[39]=41.0;
    m[40]=51.0; m[41]=19.0; m[42]=59.0; m[43]=27.0; m[44]=49.0; m[45]=17.0; m[46]=57.0; m[47]=25.0;
    m[48]=15.0; m[49]=47.0; m[50]=7.0;  m[51]=39.0; m[52]=13.0; m[53]=45.0; m[54]=5.0;  m[55]=37.0;
    m[56]=63.0; m[57]=31.0; m[58]=55.0; m[59]=23.0; m[60]=61.0; m[61]=29.0; m[62]=53.0; m[63]=21.0;

    for (int i = 0; i < 64; i++) {
        if (i == index) {
            return m[i] / 64.0;
        }
    }

    return 0.0;
}

vec3 permute(vec3 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
    const vec4 C = vec4(
        0.211324865405187,
        0.366025403784439,
        -0.577350269189626,
        0.024390243902439
    );

    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);

    vec3 p = permute(
        permute(i.y + vec3(0.0, i1.y, 1.0)) +
        i.x + vec3(0.0, i1.x, 1.0)
    );

    vec3 m = max(
        0.5 - vec3(
            dot(x0, x0),
            dot(x12.xy, x12.xy),
            dot(x12.zw, x12.zw)
        ),
        0.0
    );

    m = m * m;
    m = m * m;

    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 a0 = x - floor(x + 0.5);
    vec3 g;

    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;

    return 130.0 * dot(m, g);
}

void main() {
    vec2 uv = vUv;
    float ratio = uResolution.x / max(uResolution.y, 1.0);
    vec2 pos = vec2(uv.x * ratio, uv.y);

    float dist = distance(uv, uMouse);
    pos += (uv - uMouse) * smoothstep(0.5, 0.0, dist) * 0.2;

    float t = uTime * uSpeed * 0.2;
    float n = snoise(pos * 1.5 + t);
    float n2 = snoise(pos * 2.0 - t + n);
    float brightness = n2 * 0.5 + 0.5;

    vec2 screenPos = gl_FragCoord.xy / uBlockSize;
    float threshold = dither8x8(screenPos);
    float dithered = brightness > (threshold * uIntensity) ? 1.0 : 0.0;

    vec3 finalColor = mix(uColor1, uColor2, dithered);
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const LIQUID_CHROME_VERTEX_SHADER = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

const LIQUID_CHROME_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uDistort;
uniform vec3 uBaseColor;
uniform float uAmplitude;

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    uv.x *= uResolution.x / max(uResolution.y, 1.0);

    vec2 mouse = uMouse;
    mouse.x *= uResolution.x / max(uResolution.y, 1.0);
    float dist = distance(uv, mouse);
    float influence = smoothstep(0.6, 0.0, dist);

    for (float i = 1.0; i < 8.0; i++) {
        uv.x += (uAmplitude / i) * cos(i * 2.5 * uv.y + uTime + (uDistort * influence * 2.0));
        uv.y += (uAmplitude / i) * cos(i * 1.5 * uv.x + uTime + (uDistort * influence * 2.0));
    }

    vec2 grid = uv * 3.0;
    float height = sin(grid.x + grid.y);

    vec3 col = uBaseColor;
    col *= smoothstep(-1.0, 1.0, height);

    float specular = smoothstep(0.8, 1.0, sin(uv.x * 10.0 + uv.y * 10.0));
    col += vec3(1.0) * specular * 0.8;

    col.r += uDistort * 0.02;
    col.b -= uDistort * 0.02;

    gl_FragColor = vec4(col, 1.0);
}
`;

let browserProvider;
let signer;
let fileStorageContract;
let latestTransactionHash = "";
let filesCache = [];
let currentSort = "newest";
let toastTimeout;
const bootStartedAt = performance.now();

const requiredChainId = Number(config.chainId || 31337);
const requiredHexChainId = `0x${requiredChainId.toString(16)}`;

function initHeroDither({ Renderer, Geometry, Program, Mesh, Vec2, Color }) {
    if (!heroDitherElement) {
        return;
    }

    const hostElement = heroDitherElement.closest(".hero") || heroDitherElement.parentElement;

    if (!hostElement) {
        return;
    }

    const mousePos = new Vec2(0.5, 0.5);
    const targetMousePos = new Vec2(0.5, 0.5);
    const renderer = new Renderer({
        alpha: true,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio || 1, 2)
    });
    const gl = renderer.gl;

    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";
    heroDitherElement.appendChild(gl.canvas);

    const geometry = new Geometry(gl, {
        position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
        uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) }
    });

    const program = new Program(gl, {
        vertex: DITHER_VERTEX_SHADER,
        fragment: DITHER_FRAGMENT_SHADER,
        uniforms: {
            uTime: { value: 0 },
            uResolution: { value: new Vec2(1, 1) },
            uMouse: { value: mousePos },
            uColor1: { value: new Color("#040506") },
            uColor2: { value: new Color("#f2f4f8") },
            uSpeed: { value: 0.8 },
            uBlockSize: { value: 2.0 },
            uIntensity: { value: 1.18 }
        }
    });

    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
        const rect = heroDitherElement.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        renderer.setSize(width, height);
        program.uniforms.uResolution.value.set(gl.canvas.width, gl.canvas.height);
    };

    const handlePointerMove = (event) => {
        const rect = heroDitherElement.getBoundingClientRect();

        if (!rect.width || !rect.height) {
            return;
        }

        const x = (event.clientX - rect.left) / rect.width;
        const y = 1 - (event.clientY - rect.top) / rect.height;
        targetMousePos.set(
            Math.min(Math.max(x, 0), 1),
            Math.min(Math.max(y, 0), 1)
        );
    };

    const handlePointerLeave = () => {
        targetMousePos.set(0.5, 0.5);
    };

    window.addEventListener("resize", resize);
    hostElement.addEventListener("pointermove", handlePointerMove);
    hostElement.addEventListener("pointerleave", handlePointerLeave);
    resize();

    let requestId = 0;

    const update = (time) => {
        requestId = window.requestAnimationFrame(update);
        mousePos.lerp(targetMousePos, 0.05);
        program.uniforms.uTime.value = time * 0.001;
        renderer.render({ scene: mesh });
    };

    requestId = window.requestAnimationFrame(update);
}

function initLiquidChromeBackground({ Renderer, Triangle, Program, Mesh, Vec2 }) {
    if (!liquidChromeBackgroundElement) {
        return;
    }

    const renderer = new Renderer({
        alpha: true,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio || 1, 2)
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";
    liquidChromeBackgroundElement.appendChild(gl.canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
        vertex: LIQUID_CHROME_VERTEX_SHADER,
        fragment: LIQUID_CHROME_FRAGMENT_SHADER,
        uniforms: {
            uTime: { value: 0 },
            uResolution: { value: new Vec2(1, 1) },
            uMouse: { value: new Vec2(0.5, 0.5) },
            uDistort: { value: 0 },
            uBaseColor: { value: new Float32Array([0.5, 0.5, 0.55]) },
            uAmplitude: { value: 0.6 }
        }
    });

    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
        const rect = liquidChromeBackgroundElement.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        renderer.setSize(width, height);
        program.uniforms.uResolution.value.set(width, height);
    };

    window.addEventListener("resize", resize);
    resize();

    let animationId = 0;
    let time = 0;

    const update = () => {
        animationId = window.requestAnimationFrame(update);
        program.uniforms.uDistort.value += (0 - program.uniforms.uDistort.value) * 0.05;
        time += 0.005 * 0.8;
        program.uniforms.uTime.value = time;
        renderer.render({ scene: mesh });
    };

    animationId = window.requestAnimationFrame(update);
}

function shortenValue(value, start = 8, end = 6) {
    if (!value || value.length <= start + end) {
        return value || "Not available";
    }

    return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function isUserRejectedError(error) {
    if (!error) {
        return false;
    }

    const message = String(error.message || "").toLowerCase();
    return (
        error.code === 4001 ||
        error.code === "ACTION_REJECTED" ||
        message.includes("user rejected") ||
        message.includes("action_rejected") ||
        message.includes("rejected the request")
    );
}

function getFriendlyErrorMessage(error) {
    if (isUserRejectedError(error)) {
        return "Transaction cancelled in MetaMask. Nothing was stored on-chain.";
    }

    const rawMessage = String(error?.shortMessage || error?.reason || error?.message || "Something went wrong.");
    return rawMessage.length > 220 ? `${rawMessage.slice(0, 217)}...` : rawMessage;
}

function getFriendlyErrorTitle(error) {
    return isUserRejectedError(error) ? "Transaction cancelled" : "Transaction failed";
}

function updateFilePickerName() {
    if (!fileNamePreview) {
        return;
    }

    fileNamePreview.textContent = fileInput?.files?.[0]?.name || "No file selected";
}

function getLocalNetworkText() {
    return [
        "Network Name: Hardhat Localhost",
        `RPC URL: ${config.localhostRpcUrl || "http://127.0.0.1:8545"}`,
        `Chain ID: ${requiredChainId}`,
        "Currency Symbol: ETH"
    ].join("\n");
}

function hideBootOverlay() {
    if (!bootOverlay || bootOverlay.classList.contains("hidden")) {
        return;
    }

    const elapsed = performance.now() - bootStartedAt;
    const waitTime = Math.max(0, 850 - elapsed);

    window.setTimeout(() => {
        bootOverlay.classList.add("hidden");
    }, waitTime);
}

function setStatus(message, type = "neutral") {
    statusBox.className = `status-box ${type}`;
    statusBox.innerHTML = message;
}

function setUploadLoadingState(message) {
    setStatus(
        `<span class="loader"><span></span><span></span><span></span></span> ${message}`,
        "uploading"
    );
}

function showToast(type, title, text, duration = 4000) {
    clearTimeout(toastTimeout);
    feedbackOverlay.innerHTML = `
        <div class="feedback-toast ${type}">
            <div class="feedback-head">
                <div class="feedback-icon">${type === "success" ? "OK" : type === "error" ? "!" : "i"}</div>
                <div class="feedback-title">${title}</div>
            </div>
            <div class="feedback-text">${text}</div>
        </div>
    `;

    toastTimeout = window.setTimeout(() => {
        feedbackOverlay.innerHTML = "";
    }, duration);
}

function setConnectButtonState(connected) {
    connectButton.className = `btn ${connected ? "btn-green" : "btn-blue"}`;
    connectButton.textContent = connected ? "Connected Wallet" : "Connect Wallet";
}

function setWalletVisual(connected, text) {
    walletBadge.classList.toggle("connected", connected);
    walletBadgeText.textContent = text;
    setConnectButtonState(connected);
}

function updateTransaction(hash = "") {
    latestTransactionHash = hash;
    latestTxSummary.textContent = hash ? shortenValue(hash, 12, 8) : "No transaction yet";
    latestTxHashElement.textContent = hash || "No transaction yet";
}

function updateStaticDetails() {
    const fileStorageAddress = config.fileStorageAddress || "Not deployed yet";
    const accessControlAddress = config.accessControlAddress || "Not deployed yet";

    fileStorageAddressElement.textContent = fileStorageAddress;
    accessControlAddressElement.textContent = accessControlAddress;
    contractSummary.textContent = shortenValue(fileStorageAddress, 10, 8);
    networkSettingsText.textContent = getLocalNetworkText();
}

function resetUi() {
    browserProvider = undefined;
    signer = undefined;
    fileStorageContract = undefined;
    filesCache = [];
    walletSummary.textContent = "Not connected";
    walletAddressElement.textContent = "Not connected";
    miniWalletLabel.textContent = "No wallet session";
    networkNameElement.textContent = "Not connected";
    networkBadgeText.textContent = "Hardhat Localhost";
    updateTransaction("");
    setWalletVisual(false, "Disconnected");
    uploadPanel.classList.add("hidden");
    if (fileInput) {
        fileInput.value = "";
    }
    updateFilePickerName();
    renderFiles();
}

function showScreen(screen) {
    const isHome = screen === "home";
    homeScreen.classList.toggle("active", isHome);
    vaultScreen.classList.toggle("active", !isHome);
    homeNavButton.classList.toggle("active", isHome);
    vaultNavButton.classList.toggle("active", !isHome);
    document.documentElement.classList.toggle("home-locked", isHome);
    document.body.classList.toggle("home-locked", isHome);
    document.querySelector(".shell")?.classList.toggle("home-locked", isHome);
}

function openInfo() {
    infoOverlay.classList.add("open");
    infoOverlay.setAttribute("aria-hidden", "false");
}

function closeInfo() {
    infoOverlay.classList.remove("open");
    infoOverlay.setAttribute("aria-hidden", "true");
}

function openSuccess() {
    successOverlay.classList.add("open");
    successOverlay.setAttribute("aria-hidden", "false");
}

function closeSuccess() {
    successOverlay.classList.remove("open");
    successOverlay.setAttribute("aria-hidden", "true");
}

function applySortButtons() {
    sortNewestButton.classList.toggle("active", currentSort === "newest");
    sortOldestButton.classList.toggle("active", currentSort === "oldest");
}

function normalizeFiles(files) {
    return files.map((file) => ({
        cid: file.cid,
        fileName: file.fileName,
        owner: file.owner,
        timestamp: Number(file.timestamp)
    }));
}

function sortFiles(files) {
    return [...files].sort((a, b) => {
        if (currentSort === "newest") {
            return b.timestamp - a.timestamp;
        }

        return a.timestamp - b.timestamp;
    });
}

function renderFiles() {
    applySortButtons();
    filesListElement.innerHTML = "";

    if (!filesCache.length) {
        filesListElement.innerHTML = `
            <div class="empty-state">
                No files available yet. Connect the wallet, upload a file, then open Storage.
            </div>
        `;
        return;
    }

    const files = sortFiles(filesCache);

    for (const file of files) {
        const card = document.createElement("article");
        card.className = "file-card";

        const gatewayUrl = `${config.pinataGateway || "https://gateway.pinata.cloud/ipfs/"}${file.cid}`;
        const uploadedAt = new Date(file.timestamp * 1000).toLocaleString();

        card.innerHTML = `
            <strong class="file-name"></strong>
            <div class="meta-list">
                <span class="meta-line"><strong>CID:</strong> <span class="file-cid"></span></span>
                <span class="meta-line"><strong>Owner:</strong> ${file.owner}</span>
                <span class="meta-line"><strong>Uploaded:</strong> ${uploadedAt}</span>
            </div>
            <div class="file-actions">
                <a class="btn btn-green" target="_blank" rel="noreferrer">View Doc</a>
                <button class="btn btn-ghost copy-cid-button">Copy CID</button>
            </div>
        `;

        card.querySelector(".file-name").textContent = file.fileName;
        card.querySelector(".file-cid").textContent = file.cid;
        const viewLink = card.querySelector("a");
        const url = URL.canParse(gatewayUrl) ? new URL(gatewayUrl) : null;
        if (url && ["https:", "http:"].includes(url.protocol)) {
            viewLink.href = url.href;
        }
        card.querySelector(".copy-cid-button").dataset.cid = file.cid;

        filesListElement.appendChild(card);
    }

    const copyButtons = filesListElement.querySelectorAll(".copy-cid-button");
    for (const button of copyButtons) {
        button.addEventListener("click", () =>
            runWithUiLock(() =>
                copyText(button.dataset.cid, "CID copied to clipboard.")
            )
        );
    }
}

async function copyText(value, message) {
    if (!value || value === "No transaction yet") {
        throw new Error("Nothing available to copy yet.");
    }

    await navigator.clipboard.writeText(value);
    setStatus(message, "success");
    showToast("info", "Copied", message, 2400);
}

async function getActiveChainId() {
    if (!window.ethereum) {
        return null;
    }

    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    return Number.parseInt(chainIdHex, 16);
}

async function ensureLocalChain() {
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: requiredHexChainId }]
        });
    } catch (error) {
        if (error.code !== 4902) {
            throw error;
        }

        await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
                {
                    chainId: requiredHexChainId,
                    chainName: "Hardhat Localhost",
                    nativeCurrency: {
                        name: "ETH",
                        symbol: "ETH",
                        decimals: 18
                    },
                    rpcUrls: [config.localhostRpcUrl || "http://127.0.0.1:8545"]
                }
            ]
        });
    }
}

async function connectWallet() {
    if (!window.ethereum) {
        throw new Error(
            "MetaMask was not detected. Open this page in Chrome or Brave with the MetaMask extension installed."
        );
    }

    if (!config.fileStorageAddress || !config.fileStorageAbi?.length) {
        throw new Error("Contracts are not deployed yet. Run the local deploy command first.");
    }

    await ensureLocalChain();

    browserProvider = new ethers.BrowserProvider(window.ethereum);
    await browserProvider.send("eth_requestAccounts", []);
    signer = await browserProvider.getSigner();
    fileStorageContract = new ethers.Contract(
        config.fileStorageAddress,
        config.fileStorageAbi,
        signer
    );

    const walletAddress = await signer.getAddress();
    const chainId = await getActiveChainId();

    walletSummary.textContent = shortenValue(walletAddress, 10, 8);
    walletAddressElement.textContent = walletAddress;
    miniWalletLabel.textContent = "Wallet session active";
    networkNameElement.textContent =
        chainId === requiredChainId
            ? `Hardhat Localhost (${requiredChainId})`
            : `Connected to chain ${chainId}`;
    networkBadgeText.textContent =
        chainId === requiredChainId ? "Hardhat Localhost" : `Chain ${chainId}`;

    uploadPanel.classList.remove("hidden");
    setWalletVisual(true, "Connected");
    setStatus("Wallet connected. Upload is now unlocked.", "success");
    showToast("success", "Wallet connected successfully", "You can now upload files to Dvault.", 4000);
    await fetchFiles(false);
}

async function tryRevokePermissions() {
    if (!window.ethereum) {
        return false;
    }

    try {
        await window.ethereum.request({
            method: "wallet_revokePermissions",
            params: [{ eth_accounts: {} }]
        });
        return true;
    } catch (error) {
        return false;
    }
}

async function disconnectWallet() {
    const revoked = await tryRevokePermissions();
    resetUi();

    if (revoked) {
        setStatus("Wallet disconnected from this site.", "success");
        showToast("error", "Wallet disconnected", "The wallet session has been cleared from Dvault.", 4000);
        return;
    }

    setStatus(
        "App session cleared. If MetaMask still reconnects automatically, disconnect this site from MetaMask permissions.",
        "neutral"
    );
    showToast("error", "Wallet disconnected", "Session cleared. MetaMask permissions may still need manual disconnect.", 4000);
}

async function syncFromWallet() {
    updateStaticDetails();

    if (!window.ethereum) {
        resetUi();
        setStatus(
            "MetaMask is required for wallet connection in this interface.",
            "error"
        );
        return;
    }

    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    const chainId = await getActiveChainId();

    if (!accounts.length) {
        resetUi();
        setStatus("Connect the wallet to begin.", "neutral");
        return;
    }

    if (chainId !== requiredChainId) {
        resetUi();
        walletSummary.textContent = shortenValue(accounts[0], 10, 8);
        walletAddressElement.textContent = accounts[0];
        networkNameElement.textContent = `Connected to chain ${chainId}`;
        networkBadgeText.textContent = `Chain ${chainId}`;
        setStatus(
            "MetaMask is connected to the wrong network. Switch to Hardhat Localhost.",
            "error"
        );
        return;
    }

    browserProvider = new ethers.BrowserProvider(window.ethereum);
    signer = await browserProvider.getSigner();
    fileStorageContract = new ethers.Contract(
        config.fileStorageAddress,
        config.fileStorageAbi,
        signer
    );

    walletSummary.textContent = shortenValue(accounts[0], 10, 8);
    walletAddressElement.textContent = accounts[0];
    miniWalletLabel.textContent = "Wallet session active";
    networkNameElement.textContent = `Hardhat Localhost (${requiredChainId})`;
    networkBadgeText.textContent = "Hardhat Localhost";
    uploadPanel.classList.remove("hidden");
    setWalletVisual(true, "Connected");

    await fetchFiles(false);
}

async function uploadToPinata(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("pinataMetadata", JSON.stringify({ name: file.name }));

    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error);
    }

    return result.cid;
}

async function fetchFiles(showStatus = true) {
    if (!fileStorageContract) {
        renderFiles();
        if (showStatus) {
            setStatus("Connect the wallet to load your files.", "neutral");
        }
        return;
    }

    const files = await fileStorageContract.getFiles();
    filesCache = normalizeFiles(files);
    renderFiles();

    if (showStatus) {
        setStatus("Storage refreshed from the blockchain.", "success");
    }
}

async function uploadFile() {
    if (!fileStorageContract) {
        await connectWallet();
    }

    if (!fileInput.files.length) {
        throw new Error("Choose a file before uploading.");
    }

    const file = fileInput.files[0];

    setUploadLoadingState("Uploading the file to IPFS...");
    const cid = await uploadToPinata(file);

    try {
        setUploadLoadingState("IPFS upload complete. Waiting for blockchain verification...");
        const tx = await fileStorageContract.uploadFile(cid, file.name);
        updateTransaction(tx.hash);
        await tx.wait();
    } catch (error) {
        updateTransaction("");

        if (isUserRejectedError(error)) {
            setStatus("Transaction cancelled in MetaMask. The file was not verified on-chain.", "error");
            showToast(
                "error",
                "Transaction cancelled",
                "MetaMask approval was cancelled, so the blockchain record was not created.",
                4200
            );
            return;
        }

        throw error;
    }

    await fetchFiles(false);
    successMessage.textContent =
        `The file "${file.name}" is now pinned to IPFS and verified on-chain.`;
    setStatus(`Upload complete. CID stored on-chain: ${cid}`, "success");
    fileInput.value = "";
    updateFilePickerName();
    openSuccess();
}

function handleHeroUpload() {
    if (uploadPanel.classList.contains("hidden")) {
        runWithUiLock(connectWallet);
        return;
    }

    const uploadInputRect = uploadPanel.getBoundingClientRect();
    window.scrollTo({
        top: window.scrollY + uploadInputRect.top - 90,
        behavior: "smooth"
    });
}

async function runWithUiLock(action) {
    const buttons = [
        connectButton,
        disconnectButton,
        infoButton,
        closeInfoButton,
        refreshButton,
        uploadButton,
        pickFileButton,
        heroUploadButton,
        heroVaultButton,
        homeNavButton,
        vaultNavButton,
        copyRpcButton,
        copyKeyButton,
        copyLastTxButton,
        sortNewestButton,
        sortOldestButton,
        successVaultButton,
        closeSuccessButton
    ];

    try {
        for (const button of buttons) {
            button.disabled = true;
        }

        await action();
    } catch (error) {
        console.error(error);
        const friendlyMessage = getFriendlyErrorMessage(error);
        setStatus(friendlyMessage, "error");
        showToast("error", getFriendlyErrorTitle(error), friendlyMessage, 4200);
    } finally {
        for (const button of buttons) {
            button.disabled = false;
        }
    }
}

connectButton.addEventListener("click", () => runWithUiLock(connectWallet));
disconnectButton.addEventListener("click", () => runWithUiLock(disconnectWallet));
infoButton.addEventListener("click", openInfo);
closeInfoButton.addEventListener("click", closeInfo);
refreshButton.addEventListener("click", () => runWithUiLock(() => fetchFiles(true)));
uploadButton.addEventListener("click", () => runWithUiLock(uploadFile));
pickFileButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", updateFilePickerName);
heroUploadButton.addEventListener("click", handleHeroUpload);
heroVaultButton.addEventListener("click", () => showScreen("vault"));
homeNavButton.addEventListener("click", () => showScreen("home"));
vaultNavButton.addEventListener("click", () => showScreen("vault"));
successVaultButton.addEventListener("click", () => {
    closeSuccess();
    showScreen("vault");
});
closeSuccessButton.addEventListener("click", closeSuccess);
copyRpcButton.addEventListener("click", () =>
    runWithUiLock(() =>
        copyText(getLocalNetworkText(), "Local network settings copied.")
    )
);
copyKeyButton.addEventListener("click", () =>
    runWithUiLock(() =>
        copyText(starterPrivateKey.textContent, "Starter wallet private key copied.")
    )
);
copyLastTxButton.addEventListener("click", () =>
    runWithUiLock(() =>
        copyText(latestTransactionHash, "Latest transaction hash copied.")
    )
);
sortNewestButton.addEventListener("click", () => {
    currentSort = "newest";
    renderFiles();
});
sortOldestButton.addEventListener("click", () => {
    currentSort = "oldest";
    renderFiles();
});

infoOverlay.addEventListener("click", (event) => {
    if (event.target === infoOverlay) {
        closeInfo();
    }
});

successOverlay.addEventListener("click", (event) => {
    if (event.target === successOverlay) {
        closeSuccess();
    }
});

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeInfo();
        closeSuccess();
    }
});

if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => {
        runWithUiLock(syncFromWallet);
    });
    window.ethereum.on("chainChanged", () => {
        runWithUiLock(syncFromWallet);
    });
}

showScreen("home");
updateStaticDetails();
resetUi();
setStatus("Connect the wallet to begin.", "neutral");
updateFilePickerName();
syncFromWallet().catch((error) => {
    console.error(error);
});

hideBootOverlay();

import("https://esm.sh/ogl@1.0.11").then((ogl) => {
    for (const initialize of [initLiquidChromeBackground, initHeroDither]) {
        try {
            initialize(ogl);
        } catch (error) {
            console.warn("Dvault background effect is unavailable.", error);
        }
    }
}).catch((error) => {
    console.warn("Dvault background library could not load.", error);
});

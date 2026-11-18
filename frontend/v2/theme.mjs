const storageKey = "dvault.theme";
const root = document.documentElement;
const control = document.getElementById("theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
const preference = window.matchMedia("(prefers-color-scheme: light)");

function readPreference() {
    try {
        return localStorage.getItem(storageKey);
    } catch {
        return null;
    }
}

function explicitTheme(value) {
    return value === "light" || value === "dark" ? value : null;
}

let choice = explicitTheme(readPreference());

function renderTheme() {
    const theme = choice ?? (preference.matches ? "light" : "dark");
    const next = theme === "light" ? "dark" : "light";
    root.dataset.theme = theme;
    themeColor?.setAttribute("content", theme === "light" ? "#f5f1fa" : "#0b0a0d");
    control?.setAttribute("aria-label", `Switch to ${next} mode`);
    control?.setAttribute("title", `Switch to ${next} mode`);
}

const soundToggle = document.getElementById("sound-toggle");
let muted = false;
let audio;
try { muted = localStorage.getItem("dvault.muted") === "true"; } catch { /* Default to sound. */ }

function renderSound() {
    soundToggle?.setAttribute("aria-pressed", String(muted));
    soundToggle?.setAttribute("aria-label", muted ? "Unmute interface sound" : "Mute interface sound");
    soundToggle?.setAttribute("title", muted ? "Unmute interface sound" : "Mute interface sound");
}

async function clickSound(up) {
    if (muted) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        audio ??= new AudioContext();
        if (audio.state !== "running") await audio.resume();
        const now = audio.currentTime;
        const tone = audio.createOscillator();
        const amp = audio.createGain();
        tone.type = "sine";
        tone.frequency.setValueAtTime(up ? 640 : 470, now);
        tone.frequency.exponentialRampToValueAtTime(up ? 980 : 310, now + 0.064);
        amp.gain.setValueAtTime(0.001, now);
        amp.gain.exponentialRampToValueAtTime(0.086, now + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.001, now + 0.084);
        tone.connect(amp);
        amp.connect(audio.destination);
        tone.start(now);
        tone.stop(now + 0.093);
    } catch { /* Theme switching still works when audio is unavailable. */ }
}

soundToggle?.addEventListener("click", () => {
    muted = !muted;
    try { localStorage.setItem("dvault.muted", String(muted)); } catch { /* Session only. */ }
    renderSound();
    if (!muted) clickSound(true);
});
renderSound();

control?.addEventListener("click", () => {
    choice = root.dataset.theme === "light" ? "dark" : "light";
    clickSound(choice === "light");
    try {
        localStorage.setItem(storageKey, choice);
    } catch {
        // An explicit choice stays in effect for this page even if storage is disabled.
    }
    renderTheme();
});

if (typeof preference.addEventListener === "function") {
    preference.addEventListener("change", renderTheme);
} else {
    preference.addListener?.(renderTheme);
}

window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) {
        choice = explicitTheme(event.key === null ? readPreference() : event.newValue);
        renderTheme();
    }
});

renderTheme();

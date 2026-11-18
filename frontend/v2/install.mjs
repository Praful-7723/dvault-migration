const button = document.querySelector("#install-app");
const guidance = document.querySelector("#install-guidance");

if (button && guidance && window.isSecureContext) {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let deferredPrompt;
    let installCompleted = false;

    function isInstalled() {
        return installCompleted || standalone.matches || navigator.standalone === true;
    }

    function showGuidance(message = "") {
        guidance.textContent = message;
        guidance.hidden = !message;
        if (button.hasAttribute("aria-expanded")) {
            button.setAttribute("aria-expanded", String(Boolean(message)));
        }
    }

    function updateInstallControl() {
        button.hidden = isInstalled() || (!deferredPrompt && !isAppleMobile);
        if (isInstalled()) showGuidance();
        if (!button.hidden && isAppleMobile && !deferredPrompt) {
            button.setAttribute("aria-controls", guidance.id);
            button.setAttribute("aria-expanded", String(!guidance.hidden));
        } else {
            button.removeAttribute("aria-controls");
            button.removeAttribute("aria-expanded");
        }
    }

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredPrompt = event;
        updateInstallControl();
    });
    window.addEventListener("appinstalled", () => {
        installCompleted = true;
        deferredPrompt = undefined;
        updateInstallControl();
    });
    standalone.addEventListener("change", updateInstallControl);

    button.addEventListener("click", async () => {
        if (isInstalled()) return;
        if (!deferredPrompt) {
            if (isAppleMobile) {
                showGuidance(guidance.hidden
                    ? "In Safari, tap Share, then Add to Home Screen. Enable Open as Web App if shown. For mobile wallet signing, open Dvault in the MetaMask app browser."
                    : "");
            }
            return;
        }

        const prompt = deferredPrompt;
        deferredPrompt = undefined;
        button.disabled = true;
        try {
            const result = await prompt.prompt();
            if (result?.outcome === "accepted") installCompleted = true;
        } catch {
            showGuidance("Use your browser’s menu to install Dvault if available.");
        } finally {
            button.disabled = false;
            updateInstallControl();
        }
    });

    updateInstallControl();
}

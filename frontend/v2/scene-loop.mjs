// A bounded animation clock shared by the lightweight Canvas effects.
export function watchScene(canvas, paint, { fps = 30, resize = () => {}, maxWidth = 1200, maxHeight = 1000 } = {}) {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let disposed = false;
    let frame = 0;
    let previous = 0;
    let elapsed = 0;
    let sized = false;
    const still = () => motion.matches;

    function redraw() {
        if (sized && !disposed && !document.hidden) paint(0, elapsed, still());
    }
    function tick(now) {
        frame = 0;
        if (disposed || !visible || document.hidden || still()) return;
        if (!previous || now - previous >= 1000 / fps) {
            const delta = previous ? Math.min(.1, (now - previous) / 1000) : 0;
            elapsed += delta;
            previous = now;
            if (sized) paint(delta, elapsed, false);
        }
        frame = requestAnimationFrame(tick);
    }
    function activity() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        previous = 0;
        if (disposed) return;
        if (visible && !document.hidden && !still()) frame = requestAnimationFrame(tick);
        redraw();
    }
    function measure() {
        if (disposed) return;
        const { width, height } = canvas.getBoundingClientRect();
        if (width < 2 || height < 2) return;
        const ratio = Math.min(devicePixelRatio || 1, 1.5, maxWidth / width, maxHeight / height);
        const pixelWidth = Math.max(1, Math.round(width * ratio));
        const pixelHeight = Math.max(1, Math.round(height * ratio));
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
        sized = true;
        resize(width, height, pixelWidth / width, pixelHeight / height);
        redraw();
    }
    const sizes = new ResizeObserver(measure);
    const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        activity();
    });
    sizes.observe(canvas);
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", activity);
    motion.addEventListener("change", activity);
    measure();
    return {
        redraw,
        destroy() {
            disposed = true;
            if (frame) cancelAnimationFrame(frame);
            sizes.disconnect();
            intersection.disconnect();
            document.removeEventListener("visibilitychange", activity);
            motion.removeEventListener("change", activity);
        }
    };
}

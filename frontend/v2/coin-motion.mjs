const TAU = Math.PI * 2;
const wrap = (value) => Math.atan2(Math.sin(value), Math.cos(value));

// The GPU and Canvas renderers use the same poses and stage transitions.
export function createCoinMotion(hero = false) {
    let selected = 0;
    let leaving = 0;
    let switched = -1;
    let clock = 0;
    const positions = [0, 1, -1];
    const yaws = positions.map((p) => p * .56 - .16);
    return {
        setStep(index) {
            if (!Number.isInteger(index) || index < 0 || index > 2) return false;
            if (index !== selected) {
                leaving = selected;
                selected = index;
                switched = clock;
            }
            return true;
        },
        pose(index, elapsed, delta, still = false) {
            clock = elapsed;
            if (hero) return {
                x: 0, y: still ? 0 : Math.sin(elapsed * 1.22) * .06, z: 0,
                scale: 1.21, pitch: -.14, yaw: -.35 + elapsed * .51, roll: -.13
            };
            const rank = (index - selected + 4) % 3 - 1;
            positions[index] = still ? rank : positions[index] + (rank - positions[index]) * (1 - Math.exp(-delta * 7));
            const p = positions[index];
            const edge = Math.min(1, Math.abs(p));
            const focused = 1 - edge;
            const phase = elapsed * 1.08 + index * 1.9;
            const transition = Math.max(0, Math.min(1, (elapsed - switched) / .52));
            const lift = still ? 0 : Math.sin(Math.PI * transition);
            const arc = index === selected ? lift * .39 : index === leaving ? -lift * .34 : 0;
            const yawTarget = rank === 0 ? Math.sin(phase * .69) * .35 - .18 : elapsed * (.42 + index * .052) + rank * .67;
            yaws[index] = still ? p * .52 - .18 : wrap(yaws[index] + wrap(yawTarget - yaws[index]) * (1 - Math.exp(-delta * 6)));
            return {
                x: p * 1.28,
                y: .02 + (edge - p) * .13 + arc + (still ? 0 : Math.sin(phase) * .079),
                z: -.72 + focused * 1.16 + (index === selected ? lift * .49 : 0),
                scale: .80 + focused * .27,
                pitch: -.07 - p * .26 + (still ? 0 : Math.cos(phase) * .105),
                yaw: yaws[index],
                roll: p * -.32 + (still ? 0 : Math.sin(phase * .71) * .06)
            };
        }
    };
}

export const coinOutline = (symbol, count = 80) => Array.from({ length: count }, (_, i) => {
    const t = i * TAU / count;
    const x = Math.cos(t), y = Math.sin(t);
    const exponent = [4.7, 1.34, 2][symbol];
    const radius = (Math.abs(x) ** exponent + Math.abs(y) ** exponent) ** (-1 / exponent);
    return [radius * x * (symbol === 0 ? .87 : symbol === 1 ? 1.04 : 1), radius * y * (symbol === 0 ? .87 : symbol === 1 ? 1.12 : 1)];
});

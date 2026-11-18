import { createCoinMotion } from "./coin-motion.mjs";
import { mountCanvasCoins } from "./coin-canvas.mjs";

// Custom WebGL proof marks with an animated Canvas renderer when GPU setup fails.
const vertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute float aFinish;
    uniform mat4 uModel;
    uniform mat4 uProjection;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vLocal;
    varying float vFinish;
    varying float vFaceNormal;
    void main() {
        vec4 world = uModel * vec4(aPosition, 1.0);
        vPosition = world.xyz;
        vNormal = mat3(uModel) * aNormal;
        vLocal = aPosition;
        vFinish = aFinish;
        vFaceNormal = aNormal.z;
        gl_Position = uProjection * vec4(world.xy, world.z - 7.0, 1.0);
    }
`;

const fragmentShader = `
    precision mediump float;
    uniform vec3 uMetal;
    uniform vec3 uAccent;
    uniform vec3 uCamera;
    uniform float uTime;
    uniform float uGlyph;
    uniform bool uBranded;
    uniform sampler2D uBrand;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vLocal;
    varying float vFinish;
    varying float vFaceNormal;

    float stroke(vec2 p, vec2 from, vec2 to, float width) {
        vec2 delta = to - from;
        float t = clamp(dot(p - from, delta) / dot(delta, delta), 0.0, 1.0);
        return 1.0 - smoothstep(width - 0.007, width + 0.007, length(p - from - delta * t));
    }

    float symbolMask(vec2 p) {
        if (uGlyph < 0.5) {
            vec2 q = abs(p - vec2(0.0, -0.055)) - vec2(0.195, 0.135);
            float roundedBox = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.035;
            float body = 1.0 - smoothstep(0.017, 0.032, abs(roundedBox));
            float bow = 1.0 - smoothstep(0.016, 0.030, abs(length(p - vec2(0.0, 0.113)) - 0.148));
            bow *= smoothstep(0.096, 0.110, p.y);
            float keyhole = 1.0 - smoothstep(0.026, 0.040, length(p - vec2(0.0, -0.054)));
            return max(max(body, bow), keyhole);
        }
        if (uGlyph < 1.5) {
            float diamond = abs(p.x) + abs(p.y);
            return 1.0 - smoothstep(0.019, 0.034, abs(diamond - 0.31));
        }
        return max(
            stroke(p, vec2(-0.23, -0.01), vec2(-0.070, -0.167), 0.033),
            stroke(p, vec2(-0.070, -0.167), vec2(0.250, 0.185), 0.033)
        );
    }

    void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(uCamera - vPosition);
        vec3 reflected = reflect(-view, n);
        float fresnel = pow(1.0 - abs(dot(n, view)), 3.1);

        // Three softboxes reflected in polished chrome, including a ruby side light.
        float softbox = exp(-12.0 * abs(reflected.y - 0.47 + 0.21 * reflected.x));
        float rimLight = exp(-23.0 * abs(reflected.y + 0.56 - 0.22 * reflected.x));
        float topLight = smoothstep(-0.22, 0.88, reflected.y) * 0.36;
        float redLight = pow(max(dot(reflected, normalize(vec3(-0.9, -0.21, 0.20))), 0.0), 8.0);
        float redBounce = pow(max(dot(reflected, normalize(vec3(0.62, -0.57, -0.35))), 0.0), 13.0);
        float edgeStripe = exp(-28.0 * abs(vLocal.z - 0.018));
        vec3 chrome = uMetal * (0.105 + topLight + 0.89 * softbox + 0.78 * rimLight + 0.16 * fresnel);
        chrome += uAccent * (0.92 * redLight + 0.65 * redBounce);

        float sweep = exp(-8.0 * abs(vLocal.x - vLocal.y * 0.69 - cos(uTime * 0.49) * 0.94));
        float faceGradient = smoothstep(-0.87, 0.97, vLocal.y);
        vec3 obsidian = vec3(0.014, 0.012, 0.020) + uMetal * (0.046 * faceGradient + 0.064 * softbox);
        obsidian += uAccent * (0.045 * redLight + 0.042 * redBounce + 0.021 * sweep);
        vec3 relief = mix(uMetal * (0.49 + 0.22 * faceGradient), uAccent, 0.21 + 0.25 * redLight);
        relief += uMetal * (0.20 * softbox + 0.15 * rimLight);

        vec3 color;
        if (vFinish > 4.5) {
            // Meshy geometry stays intact. Paint the material boundary and the
            // engraving continuously in local coordinates, never per triangle.
            float radius = length(vLocal.xy);
            float rim = max(smoothstep(0.76, 0.94, radius), smoothstep(0.54, 0.90, 1.0 - abs(vFaceNormal)));
            vec3 rimColor = chrome + uAccent * edgeStripe * (0.11 + 0.55 * redLight);
            color = mix(obsidian, rimColor, rim);
            vec2 p = vec2(vLocal.x * (vLocal.z < 0.0 ? -1.0 : 1.0), vLocal.y);
            float face = smoothstep(0.4, 0.75, abs(vFaceNormal)) * (1.0 - smoothstep(0.54, 0.73, radius));
            float shadow = symbolMask(p - vec2(0.011, -0.014)) * face;
            vec3 engraving = mix(uMetal * 0.80, uAccent * 0.78, redLight * 0.23 + 0.09);
            engraving += vec3(0.12) * softbox;
            color = mix(color, vec3(0.012), shadow * 0.48);
            color = mix(color, engraving, symbolMask(p) * face);
        } else if (vFinish < 0.5) {
            color = chrome + uAccent * edgeStripe * (0.10 + 0.71 * redLight + 0.17 * redBounce);
        } else if (vFinish < 1.5) {
            color = obsidian;
            if (uBranded) {
                // Looking at the reverse flips the local x axis. Flip its
                // texture coordinates too so the logo remains upright.
                vec2 uv = vec2(vLocal.x * sign(vFaceNormal), -vLocal.y) / 1.65 + 0.5;
                // Follow the document silhouette in the original identity
                // artwork, including its folded upper corner.
                vec2 bounds = abs(uv - vec2(0.502, 0.497)) - vec2(0.171, 0.181);
                float outline = length(max(bounds, 0.0)) + min(max(bounds.x, bounds.y), 0.0) - 0.108;
                float fold = (uv.x - uv.y - 0.387) * 0.7071;
                float distanceToLogo = max(outline, fold);
                float alpha = 1.0 - smoothstep(-0.003, 0.006, distanceToLogo);
                vec3 brand = texture2D(uBrand, uv).rgb;
                float edge = exp(-abs(distanceToLogo) * 160.0);
                vec3 edgeLight = uAccent * edge * (0.08 + 0.10 * softbox);
                brand *= 0.85 + 0.14 * max(dot(n, normalize(vec3(-0.4, 0.7, 0.8))), 0.0);
                brand += uMetal * softbox * 0.045;
                color = mix(obsidian + edgeLight, brand, alpha);
            }
        } else if (vFinish < 2.5) {
            color = chrome * 1.07 + uMetal * 0.15;
        } else if (vFinish < 3.5) {
            color = obsidian * 0.66;
        } else {
            color = relief;
        }
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
`;

const metals = [
    { base: [0.99, 0.45, 0.64], accent: [1, 0.035, 0.2] },
    { base: [0.80, 0.68, 1], accent: [0.51, 0.28, 1] },
    { base: [0.82, 1, 0.91], accent: [0.22, 0.92, 0.69] }
];
const modelUrls = [[2, "/v2/assets/meshy-verify.glb"]];

const TAU = Math.PI * 2;
const segments = 128;
const depth = 0.106;

function coinMesh(symbol, branded = false) {
    const vertices = [];
    const addVertex = ([x, y, z], [nx, ny, nz], finish) => {
        vertices.push(x, y, z, nx, ny, nz, finish);
    };

    function flat(points, z, finish) {
        const normal = [0, 0, Math.sign(z)];
        for (let i = 1; i < points.length - 1; i += 1) {
            for (const [x, y] of [points[0], points[i], points[i + 1]]) {
                addVertex([x, y, z], normal, finish);
            }
        }
    }

    function ring(inner, outer, z, finish, count = segments) {
        const normal = [0, 0, Math.sign(z)];
        for (let i = 0; i < count; i += 1) {
            const a = i * TAU / count;
            const b = (i + 1) * TAU / count;
            const point = (r, t) => [r * Math.cos(t), r * Math.sin(t), z];
            const ia = point(inner, a);
            const ib = point(inner, b);
            const oa = point(outer, a);
            const ob = point(outer, b);
            for (const p of [ia, oa, ob, ia, ob, ib]) {
                addVertex(p, normal, finish);
            }
        }
    }

    // Two smooth rolled rims surround an inset glass face.
    function lathe(profile) {
        for (let k = 1; k < profile.length; k += 1) {
            const [radiusA, zA] = profile[k - 1];
            const [radiusB, zB, finish] = profile[k];
            const dr = radiusB - radiusA;
            const dz = zB - zA;
            const magnitude = Math.hypot(dr, dz);

            function edgeVertex(radius, z, angle) {
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const radial = Math.abs(dz) / magnitude;
                const vertical = -dr / magnitude;
                addVertex(
                    [radius * cos, radius * sin, z],
                    [radial * cos, radial * sin, vertical],
                    finish
                );
            }

            for (let i = 0; i < segments; i += 1) {
                const a = i * TAU / segments;
                const b = (i + 1) * TAU / segments;
                edgeVertex(radiusA, zA, a);
                edgeVertex(radiusB, zB, a);
                edgeVertex(radiusB, zB, b);
                edgeVertex(radiusA, zA, a);
                edgeVertex(radiusB, zB, b);
                edgeVertex(radiusA, zA, b);
            }
        }
    }

    const circle = (x, y, r, count = 48) => Array.from({ length: count }, (_, i) => {
        const a = i * TAU / count;
        return [x + r * Math.cos(a), y + r * Math.sin(a)];
    });
    const segment = (a, b, width, z, finish) => {
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const x = (a[1] - b[1]) / d * width / 2;
        const y = (b[0] - a[0]) / d * width / 2;
        flat([[a[0] - x, a[1] - y], [b[0] - x, b[1] - y], [b[0] + x, b[1] + y], [a[0] + x, a[1] + y]], z, finish);
    };

    lathe([
        [0.895, -depth, 2],
        [0.918, -0.131, 2],
        [0.95, -0.138, 2],
        [0.976, -0.12, 0],
        [0.995, -0.08, 0],
        [1.0, -0.047, 0],
        [1.0, 0.047, 0],
        [0.995, 0.08, 0],
        [0.976, 0.12, 0],
        [0.95, 0.138, 2],
        [0.918, 0.131, 2],
        [0.895, depth, 2]
    ]);

    for (const face of [-1, 1]) {
        flat(circle(0, 0, 0.928, segments), face * depth, 1);
        ring(0.846, 0.911, face * 0.11, 3);
        ring(0.862, 0.882, face * 0.113, 2);
        ring(0.815, 0.822, face * 0.109, 2);

        // The raised face glyphs remain recognizable when the coin turns.
        const motif = (points, zOffset, finish) => {
            flat(points.map(([x, y]) => [x * face * 1.22, y * 1.22]), zOffset * face, finish);
        };
        const glyphLine = (a, b, width, zOffset, finish) => {
            segment([a[0] * face * 1.22, a[1] * 1.22], [b[0] * face * 1.22, b[1] * 1.22], width, zOffset * face, finish);
        };

        if (branded) continue;
        if (symbol === 0) {
            motif(circle(0, 0.106, 0.156), 0.117, 4);
            motif([[-0.097, 0.066], [0.097, 0.066], [0.165, -0.229], [-0.165, -0.229]], 0.117, 4);
            motif(circle(0, 0.106, 0.111), 0.119, 3);
            motif([[-0.057, 0.066], [0.057, 0.066], [0.104, -0.186], [-0.104, -0.186]], 0.119, 3);
            glyphLine([-0.056, -0.185], [0.056, -0.185], 0.012, 0.121, 4);
        } else if (symbol === 1) {
            const top = [0, 0.32];
            const tr = [0.27, 0.16];
            const br = [0.27, -0.154];
            const bottom = [0, -0.313];
            const bl = [-0.27, -0.154];
            const tl = [-0.27, 0.16];
            const joint = [0, 0.008];
            motif([top, tr, br, bottom, bl, tl], 0.116, 1);
            motif([top, tr, joint, tl], 0.119, 2);
            motif([tr, br, bottom, joint], 0.118, 3);
            for (const [a, b] of [[top, tr], [tr, br], [br, bottom], [bottom, bl], [bl, tl], [tl, top], [tl, joint], [tr, joint], [joint, bottom]]) {
                glyphLine(a, b, 0.026, 0.122, 4);
            }
        } else {
            const shield = [[0, 0.315], [0.247, 0.243], [0.247, -0.005], [0.186, -0.172], [0, -0.32], [-0.186, -0.172], [-0.247, -0.005], [-0.247, 0.243]];
            motif(shield, 0.116, 2);
            motif(shield.map(([x, y]) => [x * 0.85, y * 0.85]), 0.118, 3);
            glyphLine([-0.111, 0.004], [-0.027, -0.092], 0.058, 0.121, 4);
            glyphLine([-0.044, -0.089], [0.129, 0.101], 0.058, 0.121, 4);
        }
    }

    // The key uses a rounded square, storage a bevelled diamond, and the
    // verification seal stays circular. Keep the relief geometry undistorted.
    const exponent = [4.7, 1.34, 2][symbol];
    for (let at = 0; at < vertices.length; at += 7) {
        const x = vertices[at], y = vertices[at + 1];
        const radius = Math.hypot(x, y);
        if (radius > 0.46 && symbol !== 2) {
            const outline = (Math.abs(x / radius) ** exponent + Math.abs(y / radius) ** exponent) ** (-1 / exponent);
            const blend = Math.min(1, (radius - 0.46) / 0.36);
            const factor = 1 + (outline - 1) * blend * blend;
            vertices[at] *= factor * (symbol === 1 ? 1.04 : 0.87);
            vertices[at + 1] *= factor * (symbol === 1 ? 1.12 : 0.87);
        }
        vertices[at + 2] *= [1.35, 1.85, 0.79][symbol];
    }
    return new Float32Array(vertices);
}

const glbLimit = 4 * 1024 * 1024;
const vertexLimit = 144000;
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => {
    const length = Math.hypot(...v);
    return Number.isFinite(length) && length > 0 ? v.map((x) => x / length) : [0, 0, 1];
};

function transformVector(matrix, [x, y, z], w) {
    return [
        x * matrix[0] + y * matrix[4] + z * matrix[8] + w * matrix[12],
        x * matrix[1] + y * matrix[5] + z * matrix[9] + w * matrix[13],
        x * matrix[2] + y * matrix[6] + z * matrix[10] + w * matrix[14]
    ];
}

function nodeMatrix(node) {
    if (node.matrix) {
        if (node.matrix.length !== 16 || !node.matrix.every(Number.isFinite)) throw new Error("Invalid model transform");
        return node.matrix;
    }
    const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
    const [sx, sy, sz] = node.scale ?? [1, 1, 1];
    const [tx, ty, tz] = node.translation ?? [0, 0, 0];
    return [
        (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
        2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
        2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
        tx, ty, tz, 1
    ];
}

function multiplyTransform(parent, child) {
    const result = child.slice();
    for (let start = 0; start < 16; start += 4) {
        const out = transformVector(parent, child.slice(start, start + 3), child[start + 3]);
        result.splice(start, 3, ...out);
    }
    return result;
}

function modelAccessors(model, data) {
    const formats = new Map([
        [5121, [1, "getUint8"]],
        [5123, [2, "getUint16"]],
        [5125, [4, "getUint32"]],
        [5126, [4, "getFloat32"]]
    ]);
    return (index, vector) => {
        const entry = model.accessors?.[index];
        const section = model.bufferViews?.[entry?.bufferView];
        const format = formats.get(entry?.componentType);
        if (!format || !section || section.buffer !== 0 || entry.sparse ||
            entry.type !== (vector ? "VEC3" : "SCALAR") || (entry.componentType === 5126) !== vector ||
            !Number.isInteger(entry.count) || entry.count < 1 || entry.count > vertexLimit) {
            throw new Error("Unsupported model accessor");
        }
        const [width, read] = format;
        const packed = width * (vector ? 3 : 1);
        const stride = section.byteStride ?? packed;
        const viewOffset = section.byteOffset ?? 0;
        const entryOffset = entry.byteOffset ?? 0;
        const viewEnd = viewOffset + section.byteLength;
        const start = viewOffset + entryOffset;
        if (![stride, viewOffset, entryOffset, viewEnd].every(Number.isSafeInteger) ||
            stride < packed || viewOffset < 0 || entryOffset < 0 || viewEnd > data.byteLength ||
            start + stride * (entry.count - 1) + packed > viewEnd) {
            throw new Error("Invalid model accessor range");
        }
        return {
            count: entry.count,
            get(i) {
                if (!Number.isInteger(i) || i < 0 || i >= entry.count) throw new Error("Invalid model index");
                const offset = start + i * stride;
                return vector
                    ? [data[read](offset, true), data[read](offset + width, true), data[read](offset + width * 2, true)]
                    : data[read](offset, true);
            }
        };
    };
}

function glbTriangles(buffer) {
    const data = new DataView(buffer);
    if (data.byteLength < 32 || data.byteLength > glbLimit ||
        data.getUint32(0, true) !== 0x46546c67 || data.getUint32(4, true) !== 2 ||
        data.getUint32(8, true) !== data.byteLength ||
        data.getUint32(16, true) !== 0x4e4f534a) throw new Error("Invalid GLB header");
    const jsonLength = data.getUint32(12, true);
    const binHeader = 20 + jsonLength;
    if (binHeader + 8 > data.byteLength || data.getUint32(binHeader + 4, true) !== 0x004e4942) {
        throw new Error("GLB must contain embedded mesh data");
    }
    const model = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
    const view = new DataView(buffer, binHeader + 8, data.getUint32(binHeader, true));
    if (model.buffers?.length !== 1 || model.buffers[0]?.uri) throw new Error("External model buffers are disabled");
    const accessor = modelAccessors(model, view);
    const triangles = [];
    let visits = 0;

    function visit(index, parent, depth) {
        const node = model.nodes?.[index];
        if (!node || depth > 24 || ++visits > 128) throw new Error("Invalid model node hierarchy");
        const matrix = multiplyTransform(parent, nodeMatrix(node));
        for (const primitive of model.meshes?.[node.mesh]?.primitives ?? []) {
            if ((primitive.mode ?? 4) !== 4) throw new Error("Model requires triangles");
            const positions = accessor(primitive.attributes?.POSITION, true);
            const normals = primitive.attributes?.NORMAL === undefined ? null : accessor(primitive.attributes.NORMAL, true);
            const indices = primitive.indices === undefined ? null : accessor(primitive.indices, false);
            const count = indices?.count ?? positions.count;
            if (count % 3 || triangles.length + count > vertexLimit) throw new Error("Model exceeds render limits");

            const basis = [matrix.slice(0, 3), matrix.slice(4, 7), matrix.slice(8, 11)];
            const inverseTranspose = [cross(basis[1], basis[2]), cross(basis[2], basis[0]), cross(basis[0], basis[1])];
            const determinant = dot(basis[0], inverseTranspose[0]);
            if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new Error("Invalid model scale");
            const normalMatrix = inverseTranspose.flatMap((col) => [...col.map((n) => n / determinant), 0]);
            for (let i = 0; i < count; i += 3) {
                const corners = [i, i + 1, i + 2].map((j) => indices ? indices.get(j) : j);
                const points = corners.map((j) => transformVector(matrix, positions.get(j), 1));
                if (!points.flat().every(Number.isFinite)) throw new Error("Invalid model position");
                const [p, q, r] = points;
                const flat = unit(cross(q.map((v, k) => v - p[k]), r.map((v, k) => v - p[k])));
                corners.forEach((vertexIndex, k) => {
                    const normal = normals ? unit(transformVector(normalMatrix, normals.get(vertexIndex), 0)) : flat;
                    triangles.push({ point: points[k], normal });
                });
            }
        }
        for (const child of node.children ?? []) visit(child, matrix, depth + 1);
    }

    for (const index of model.scenes?.[model.scene ?? 0]?.nodes ?? []) visit(index, identity, 0);
    if (triangles.length < 90) throw new Error("Model has insufficient geometry");
    return triangles;
}

// A round coin can be exported standing upright or lying down. Diagonalize the
// position covariance to find its thin axis without relying on exporter metadata.
function coinAxes(vertices) {
    const mean = [0, 0, 0];
    for (const { point } of vertices) for (let i = 0; i < 3; i++) mean[i] += point[i] / vertices.length;
    const matrix = Array.from({ length: 3 }, () => [0, 0, 0]);
    for (const { point } of vertices) {
        const delta = point.map((value, i) => value - mean[i]);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) matrix[i][j] += delta[i] * delta[j];
    }
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let n = 0; n < 16; n++) {
        const [p, q] = [[0, 1], [0, 2], [1, 2]]
            .reduce((best, pair) => Math.abs(matrix[pair[0]][pair[1]]) > Math.abs(matrix[best[0]][best[1]]) ? pair : best);
        const off = matrix[p][q];
        if (Math.abs(off) < Number.EPSILON) break;
        const angle = 0.5 * Math.atan2(2 * off, matrix[q][q] - matrix[p][p]);
        const c = Math.cos(angle), s = Math.sin(angle);
        function rotate(row) {
            const a = row[p], b = row[q];
            row[p] = c * a - s * b;
            row[q] = s * a + c * b;
        }
        matrix.forEach(rotate);
        for (let i = 0; i < 3; i++) {
            const a = matrix[p][i], b = matrix[q][i];
            matrix[p][i] = c * a - s * b;
            matrix[q][i] = s * a + c * b;
        }
        axes.forEach(rotate);
    }
    const thin = [0, 1, 2].reduce((best, i) => matrix[i][i] < matrix[best][best] ? i : best);
    const normal = axes.map((row) => row[thin]);
    const primary = Math.abs(normal[2]) > 0.35 ? 2 : Math.abs(normal[0]) > Math.abs(normal[1]) ? 0 : 1;
    if (normal[primary] < 0) for (let i = 0; i < 3; i++) normal[i] *= -1;
    const up = Math.abs(normal[1]) < 0.88 ? [0, 1, 0] : [0, 0, 1];
    const right = unit(cross(up, normal));
    return [right, cross(normal, right), normal];
}

function fromGlb(binary) {
    const vertices = glbTriangles(binary);
    const axes = coinAxes(vertices);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const vertex of vertices) {
        vertex.point = axes.map((axis) => dot(axis, vertex.point));
        vertex.normal = axes.map((axis) => dot(axis, vertex.normal));
        for (let i = 0; i < 3; i++) {
            min[i] = Math.min(min[i], vertex.point[i]);
            max[i] = Math.max(max[i], vertex.point[i]);
        }
    }
    const spans = max.map((value, i) => value - min[i]);
    const diameter = Math.max(spans[0], spans[1]);
    const diagonal = Math.min(spans[0], spans[1]) / diameter;
    const thickness = spans[2] / diameter;
    if (!(diagonal > 0.67 && thickness > 0.015 && thickness < 0.43)) {
        throw new Error("Model is not shaped like a medallion");
    }
    const center = max.map((value, i) => (value + min[i]) / 2);
    const size = 2 / diameter;
    const depthFactor = Math.min(1, 0.20 / thickness);
    let maxRadius = 0;
    for (const vertex of vertices) {
        vertex.point = vertex.point.map((value, i) => (value - center[i]) * size * (i === 2 ? depthFactor : 1));
        vertex.normal[2] /= depthFactor;
        vertex.normal = unit(vertex.normal);
        maxRadius = Math.max(maxRadius, Math.hypot(vertex.point[0], vertex.point[1]));
    }
    if (maxRadius > 1.24) throw new Error("Model extends outside the medallion silhouette");
    const geometry = new Float32Array(vertices.length * 7);
    vertices.forEach(({ point, normal }, i) => geometry.set([...point, ...normal, 5], i * 7));
    return geometry;
}

function makeProgram(gl) {
    function compile(type, source) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Could not allocate a coin shader");
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            throw new Error("The graphic driver could not compile the coin shader");
        }
        return shader;
    }

    const program = gl.createProgram();
    if (!program) throw new Error("Could not allocate a coin program");
    let vertex;
    let fragment;
    try {
        vertex = compile(gl.VERTEX_SHADER, vertexShader);
        fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error("Could not link the coin shaders");
        }
        return program;
    } catch (error) {
        gl.deleteProgram(program);
        throw error;
    } finally {
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
    }
}

function updateModel(out, x, y, z, scale, pitch, yaw, roll) {
    const cx = Math.cos(pitch), sx = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cz = Math.cos(roll), sz = Math.sin(roll);

    // Rz * Ry * Rx, in column-major order for WebGL.
    out[0] = scale * cz * cy;
    out[1] = scale * sz * cy;
    out[2] = -scale * sy;
    out[4] = scale * (cz * sy * sx - sz * cx);
    out[5] = scale * (sz * sy * sx + cz * cx);
    out[6] = scale * cy * sx;
    out[8] = scale * (cz * sy * cx + sz * sx);
    out[9] = scale * (sz * sy * cx - cz * sx);
    out[10] = scale * cy * cx;
    out[12] = x;
    out[13] = y;
    out[14] = z;
    out[15] = 1;
}

export function mountCoins(canvas, options = {}) {
    if (!canvas) return null;
    let target = canvas;
    let active;
    let disposed = false;
    let step = Number(canvas.dataset.step) || 0;
    let busy = false;
    function useCanvas(reason) {
        if (disposed) return;
        active?.destroy();
        // A canvas that acquired a WebGL context cannot acquire a 2D context.
        // Keep its ID, dimensions and CSS hooks on a fresh canvas element.
        const replacement = target.cloneNode(false);
        delete replacement.dataset.ready;
        target.replaceWith(replacement);
        target = replacement;
        active = mountCanvasCoins(target, { ...options, reason });
        active?.setStep(step);
        active?.setBusy(busy);
    }
    try {
        active = mountWebGLCoins(target, {
            ...options,
            onContextLost: () => queueMicrotask(() => useCanvas("context-lost"))
        });
    } catch (error) {
        target.dataset.fallbackReason ||= "initialization-error";
        console.warn("Dvault is switching its coin artwork to Canvas.", error);
    }
    if (!active) useCanvas(target.dataset.fallbackReason || "context-unavailable");
    if (!active) return null;
    return {
        setStep(index) {
            if (!Number.isInteger(index) || index < 0 || index > 2) return;
            step = index;
            active?.setStep(index);
        },
        setBusy(value) { busy = Boolean(value); active?.setBusy(busy); },
        destroy() { disposed = true; active?.destroy(); }
    };
}

function mountWebGLCoins(canvas, { compareMeshy = false, brandImage = null, onContextLost } = {}) {
    const hero = Boolean(brandImage);
    const fallback = (reason) => {
        if (canvas) {
            delete canvas.dataset.ready;
            canvas.dataset.renderer = "fallback";
            canvas.dataset.fallbackReason = reason;
        }
        return null;
    };
    let gl;
    try {
        gl = canvas?.getContext("webgl", {
            alpha: true,
            antialias: true,
            powerPreference: "low-power"
        });
    } catch {
        return fallback("context-creation-failed");
    }
    if (!gl) return fallback("context-unavailable");
    if (gl.isContextLost()) return fallback("context-lost");

    let program;
    let brandTexture;
    const buffers = [];
    const symbols = hero ? [2] : [0, 1, 2];
    try {
        program = makeProgram(gl);
        brandTexture = gl.createTexture();
        if (!brandTexture) throw new Error("Could not allocate a coin texture");
        gl.bindTexture(gl.TEXTURE_2D, brandTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (hero) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, brandImage);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        }
        if (gl.getError() !== gl.NO_ERROR) throw new Error("Could not upload the coin texture");
        for (const i of symbols) {
            const mesh = coinMesh(i, hero);
            const buffer = gl.createBuffer();
            if (!buffer) throw new Error("Could not allocate coin geometry");
            buffers[i] = { buffer, count: mesh.length / 7 };
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
        }
    } catch (error) {
        for (const entry of buffers) if (entry) gl.deleteBuffer(entry.buffer);
        if (brandTexture) gl.deleteTexture(brandTexture);
        if (program) gl.deleteProgram(program);
        console.warn("Dvault could not prepare its 3D coin artwork; using the fallback.", error);
        return fallback("graphics-setup-failed");
    }

    gl.useProgram(program);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    const position = gl.getAttribLocation(program, "aPosition");
    const normal = gl.getAttribLocation(program, "aNormal");
    const finish = gl.getAttribLocation(program, "aFinish");
    for (const loc of [position, normal, finish]) gl.enableVertexAttribArray(loc);

    const uniform = (name) => gl.getUniformLocation(program, name);
    const modelUniform = uniform("uModel");
    const projectionUniform = uniform("uProjection");
    const metalUniform = uniform("uMetal");
    const accentUniform = uniform("uAccent");
    const glyphUniform = uniform("uGlyph");
    const timeUniform = uniform("uTime");
    gl.uniform3f(uniform("uCamera"), 0, 0, 7);
    gl.uniform1i(uniform("uBranded"), Number(hero));
    gl.uniform1i(uniform("uBrand"), 0);

    const projection = new Float32Array(16);
    const model = new Float32Array(16);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const coinMotion = createCoinMotion(hero);
    coinMotion.setStep(Number(canvas.dataset.step) || 0);
    let busy = false;
    let elapsed = 0;
    let last = 0;
    let frame = 0;
    let visible = false;
    let disposed = false;
    let requestedModels = false;
    let loadedModels = 0;
    const modelRequests = new AbortController();
    canvas.dataset.meshyCoins = "0";
    canvas.dataset.renderer = "custom";
    delete canvas.dataset.fallbackReason;

    function loadModels() {
        if (requestedModels || hero || !compareMeshy) return;
        requestedModels = true;
        for (const [index, url] of modelUrls) {
            (async () => {
                const response = await fetch(url, { signal: modelRequests.signal });
                if (!response.ok || Number(response.headers.get("Content-Length")) > glbLimit) return;
                const binary = await response.arrayBuffer();
                if (disposed || gl.isContextLost()) return;
                const geometry = fromGlb(binary);
                const buffer = gl.createBuffer();
                if (!buffer) return;
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
                if (gl.getError() !== gl.NO_ERROR) {
                    gl.deleteBuffer(buffer);
                    return;
                }
                gl.deleteBuffer(buffers[index].buffer);
                buffers[index] = { buffer, count: geometry.length / 7 };
                canvas.dataset.meshyCoins = String(++loadedModels);
                canvas.dataset.renderer = "meshy-comparison";
                if (visible && !document.hidden) draw(0);
            })().catch(() => {
                // A missing, interrupted or unsupported export leaves its sculpted fallback available.
            });
        }
    }

    function draw(dt) {
        if (disposed || !canvas.width || !canvas.height) return;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(timeUniform, elapsed);
        const still = motion.matches;

        for (const i of symbols) {
            const pose = coinMotion.pose(i, elapsed, dt, still);
            updateModel(model, pose.x, pose.y, pose.z, pose.scale, pose.pitch, pose.yaw, pose.roll);
            gl.uniformMatrix4fv(modelUniform, false, model);
            gl.uniform3fv(metalUniform, hero ? metals[1].base : metals[i].base);
            gl.uniform3fv(accentUniform, hero ? metals[1].accent : metals[i].accent);
            gl.uniform1f(glyphUniform, i);
            const { buffer, count } = buffers[i];
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 28, 0);
            gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 28, 12);
            gl.vertexAttribPointer(finish, 1, gl.FLOAT, false, 28, 24);
            gl.drawArrays(gl.TRIANGLES, 0, count);
        }
        if (canvas.dataset.ready !== "true" && gl.getError() !== gl.NO_ERROR) {
            throw new Error("The graphics driver could not draw the first coin frame");
        }
        canvas.dataset.ready = "true";
    }

    function tick(now) {
        frame = 0;
        if (disposed || !visible || document.hidden || motion.matches) return;
        if (last && now - last < 30) {
            frame = requestAnimationFrame(tick);
            return;
        }
        const delta = last ? Math.min(.07, (now - last) / 1000) : 0;
        elapsed += delta * (hero ? 1 : busy ? 1 : .3);
        last = now;
        draw(delta);
        frame = requestAnimationFrame(tick);
    }

    function updateActivity() {
        if (disposed) return;
        const active = visible && !document.hidden && !motion.matches;
        if (active && !frame) {
            last = 0;
            frame = requestAnimationFrame(tick);
        } else if (!active && frame) {
            cancelAnimationFrame(frame);
            frame = 0;
        }

        if (visible && !document.hidden && motion.matches) draw(0);
    }

    function resize() {
        if (disposed) return;
        const { width, height } = canvas.getBoundingClientRect();
        if (width < 2 || height < 2) return;
        const ratio = Math.min(devicePixelRatio || 1, 1.5, 920 / Math.max(width, height));
        const pixelWidth = Math.max(1, Math.round(width * ratio));
        const pixelHeight = Math.max(1, Math.round(height * ratio));
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        const aspect = canvas.width / canvas.height;
        const f = 7 / (hero ? Math.max(1.42, 1.49 / aspect) : Math.max(1.33, 2.13 / aspect));
        projection[0] = f / aspect;
        projection[5] = f;
        projection[10] = -31 / 29;
        projection[11] = -1;
        projection[14] = -60 / 29;
        gl.uniformMatrix4fv(projectionUniform, false, projection);
        // The static first frame is available immediately while observers settle.
        draw(0);
    }

    const sizes = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) loadModels();
        updateActivity();
    });
    document.addEventListener("visibilitychange", updateActivity);
    motion.addEventListener("change", updateActivity);

    function destroy(event) {
        if (disposed) return;
        disposed = true;
        modelRequests.abort();
        if (frame) cancelAnimationFrame(frame);
        sizes.disconnect();
        intersection.disconnect();
        document.removeEventListener("visibilitychange", updateActivity);
        motion.removeEventListener("change", updateActivity);
        canvas.removeEventListener("webglcontextlost", destroy);
        for (const entry of buffers) if (entry) gl.deleteBuffer(entry.buffer);
        gl.deleteTexture(brandTexture);
        gl.deleteProgram(program);
        delete canvas.dataset.ready;
        delete canvas.dataset.meshyCoins;
        delete canvas.dataset.renderer;
        if (event?.type === "webglcontextlost") onContextLost?.();
    }

    canvas.addEventListener("webglcontextlost", destroy, { once: true });
    try {
        resize();
    } catch (error) {
        destroy();
        canvas.dataset.fallbackReason = "first-frame-failed";
        throw error;
    }
    sizes.observe(canvas);
    intersection.observe(canvas);

    return {
        setStep(index) {
            if (disposed || !coinMotion.setStep(index)) return;
            canvas.dataset.step = String(index);
            if (visible && !document.hidden) draw(0);
        },
        setBusy(active) { busy = Boolean(active); },
        destroy
    };
}

export { mountDither } from "./dither.mjs";

// The guardian's authored facets are mapped onto a curved, depth-displaced
// surface. The SVG poster remains visible until the GPU has drawn a frame.
export async function mountGuardian(canvas, poster) {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    if (!canvas || !poster || motion.matches) return;
    const gl = canvas.getContext("webgl", {
        alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: "low-power"
    });
    if (!gl || gl.isContextLost()) return;
    await poster.decode();

    function compile(type, input) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, input);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            throw new Error("Guardian shader unavailable");
        }
        return shader;
    }

    const vertex = compile(gl.VERTEX_SHADER, `
        attribute vec3 aPosition;
        attribute vec2 aUV;
        uniform mat4 uModel;
        uniform vec2 uFit;
        varying vec2 vUV;
        varying float vDepth;
        void main() {
            vec4 p = uModel * vec4(aPosition, 1.0);
            float lens = 5.5 - p.z;
            gl_Position = vec4(p.xy * uFit, 0.0, lens);
            vUV = aUV;
            vDepth = aPosition.z;
        }
    `);
    const fragment = compile(gl.FRAGMENT_SHADER, `
        precision mediump float;
        uniform sampler2D uPicture;
        uniform float uTime;
        varying vec2 vUV;
        varying float vDepth;
        void main() {
            vec4 pixel = texture2D(uPicture, vUV);
            if (pixel.a < 0.015) discard;
            float gleam = exp(-15.0 * abs(vUV.x-vUV.y*0.43 - sin(uTime*.37)*.44-0.36));
            pixel.rgb += vec3(.15,.058,.13) * gleam * pixel.a * smoothstep(.08,.42,vDepth);
            gl_FragColor = pixel;
        }
    `);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const resolution = 26;
    const vertices = [];
    function point(i, j) {
        const u = i / resolution;
        const v = j / resolution;
        const x = (u - 0.50) * 3.52;
        const y = (0.5 - v) * 3.36;
        const face = Math.max(0, 1 - ((u - 0.47) / .37) ** 2 - ((v - .44) / .38) ** 2);
        const muzzle = Math.exp(-480 * ((u - .466) ** 2 + (v - .65) ** 2));
        vertices.push(x, y, .43 * face + .21 * muzzle, u, v);
    }
    for (let j = 0; j < resolution; j += 1) {
        for (let i = 0; i < resolution; i += 1) {
            point(i,j);
            point(i,j+1);
            point(i+1,j);
            point(i+1,j);
            point(i,j+1);
            point(i+1,j+1);
        }
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    for (const [name, length, offset] of [["aPosition",3,0],["aUV",2,12]]) {
        const address = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(address);
        gl.vertexAttribPointer(address, length, gl.FLOAT, false, 20, offset);
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, poster);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const uFit = gl.getUniformLocation(program, "uFit");
    const uModel = gl.getUniformLocation(program, "uModel");
    const uTime = gl.getUniformLocation(program, "uTime");
    const matrix = new Float32Array(16);
    let animation = 0;
    let frameTime = 0;
    let pointer = 0;
    let yaw = 0;
    function draw(now) {
        const elapsed = now / 1000;
        yaw += ((motion.matches ? 0 : pointer * .13 + Math.sin(elapsed * .59) * .16) - yaw) * .12;
        updateModel(matrix, 0, motion.matches ? 0 : Math.sin(elapsed * 1.04) * .08, 0, 1, -.03, yaw, -.025);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniformMatrix4fv(uModel, false, matrix);
        gl.uniform1f(uTime, elapsed);
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 5);
        if (gl.getError() === gl.NO_ERROR) canvas.dataset.ready = "true";
    }
    function loop(now) {
        animation = 0;
        if (document.hidden || motion.matches || gl.isContextLost()) return;
        if (now - frameTime > 28) {
            draw(now);
            frameTime = now;
        }
        animation = requestAnimationFrame(loop);
    }
    function resize() {
        const { width, height } = canvas.getBoundingClientRect();
        if (width < 2 || height < 2) return;
        const dpr = Math.min(devicePixelRatio || 1, 1.5, 1000 / Math.max(width,height));
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const aspect = width / height;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uFit, 2.95 / Math.max(1,aspect), 2.95 * Math.min(1,aspect));
        draw(performance.now());
    }
    function activity() {
        if (animation) cancelAnimationFrame(animation);
        animation = 0;
        if (motion.matches) delete canvas.dataset.ready;
        else if (!document.hidden) animation = requestAnimationFrame(loop);
    }
    canvas.parentElement.addEventListener("pointermove", (event) => {
        const rect = canvas.getBoundingClientRect();
        pointer = (event.clientX - rect.left) / rect.width * 2 - 1;
    });
    canvas.parentElement.addEventListener("pointerleave", () => { pointer = 0; });
    const size = new ResizeObserver(resize);
    size.observe(canvas);
    document.addEventListener("visibilitychange", activity);
    motion.addEventListener("change", activity);
    canvas.addEventListener("webglcontextlost", () => {
        delete canvas.dataset.ready;
        if (animation) cancelAnimationFrame(animation);
        size.disconnect();
        document.removeEventListener("visibilitychange", activity);
        motion.removeEventListener("change", activity);
    }, { once: true });
    resize();
    activity();
}

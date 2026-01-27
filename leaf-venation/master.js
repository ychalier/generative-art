const mainContext = mainCanvas.getContext("2d");

const width = window.innerWidth;
const height = window.innerHeight;
mainCanvas.width = width;
mainCanvas.height = height;


class Vec2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

function dist(p, q) {
    return Math.sqrt(Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2));
}

function norm(p) {
    return Math.sqrt(p.x * p.x + p.y * p.y);
}

function normalize(p) {
    const n = norm(p);
    if (n === 0) return new Vec2(0, 0);
    return new Vec2(p.x / n, p.y / n);
}

function add(p, q) {
    return new Vec2(p.x + q.x, p.y + q.y);
}

function diff(p, q) {
    return new Vec2(p.x - q.x, p.y - q.y);
}

function mul(p, alpha) {
    return new Vec2(p.x * alpha, p.y * alpha);
}

function div(p, alpha) {
    return new Vec2(p.x / alpha, p.y / alpha);
}


const birthDistanceAuxinSource = 10;
const birthDistanceVeinNode = 10;
const killDistance = 10;
const rho = 3;
const D = 3;
const widthPow = 3;

const scaleRate = 1.0001;
const scaleSpeed = 0.5;

const origin = new Vec2(width / 2, .75 * height);
const veinNodes = [new Vec2(width / 2, .75 * height)];
const parents = [null];
const auxinSources = [];
const edges = [];

let it = 0;

function update() {

    it++;

    const elapsed = it;
    const scale = 1 + scaleSpeed * elapsed;
    const radius = scale * width / 10;

    // Throw darts to add new auxin sources
    for (let r = 0; r < rho; r++) {
        // const randTheta = Math.random() * 2 * Math.PI;
        // const x = radius * Math.cos(randTheta);
        // const y = radius * Math.sin(randTheta);
        // const p = add(origin, new Vec2(x, y));
        const p = new Vec2(Math.random() * width, Math.random() * height);
        let valid = true;
        for (const q of auxinSources) {
            const d = dist(p, q);
            if (d < birthDistanceAuxinSource) {
                valid = false;
                break;
            }
        }
        if (!valid) continue;
        for (const q of veinNodes) {
            const d = dist(p, q);
            if (d < birthDistanceVeinNode) {
                valid = false;
                break;
            }
        }
        if (!valid) continue;
        auxinSources.push(p);
    }

    // Grow veins
    const influences = [];
    for (let i = 0; i < veinNodes.length; i++) {
        influences.push([]);
    }
    for (const p of auxinSources) {
        let minD, minI;
        for (let i = 0; i < veinNodes.length; i++) {
            const q = veinNodes[i];
            const d = dist(p, q);
            if (minD == undefined || d < minD) {
                minD = d;
                minI = i;
            }
        }
        influences[minI].push(p);
    }
    const veinNodesLength = veinNodes.length;
    for (let i = 0; i < veinNodesLength; i++) {
        const p = veinNodes[i];
        if (influences[i].length === 0) continue;
        let n = 0;
        let v = new Vec2(0, 0);
        for (const q of influences[i]) {
            n++;
            v = add(v, normalize(diff(q, p)));
        }
        v = div(v, n);
        v = add(p, mul(v, D));
        if (v.x < 0 || v.x >= width || v.y < 0 || v.y >= height) continue;
        edges.push([i, veinNodes.length]);
        parents.push(i);
        veinNodes.push(v);
    }

    // Kill auxin sources
    for (let i = auxinSources.length - 1; i >= 0; i--) {
        const p = auxinSources[i];
        for (const q of veinNodes) {
            const d = dist(p, q);
            if (d < killDistance) {
                auxinSources.splice(i, 1);
                break;
            }
        }
    }

    // for (let i = 0; i < auxinSources.length; i++) {
    //     auxinSources[i] = add(mul(auxinSources[i], scaleRate), mul(origin, 1 - scaleRate));
    // }
    // for (let i = 0; i < veinNodes.length; i++) {
    //     veinNodes[i] = add(mul(veinNodes[i], scaleRate), mul(origin, 1 - scaleRate));
    // }

}

function draw() {
    mainContext.clearRect(0, 0, width, height);
    mainContext.fillStyle = "#f0f0f0";
    mainContext.fillRect(0, 0, width, height);
    // mainContext.fillStyle = "crimson";
    // for (let i = 0; i < auxinSources.length; i++) {
    //     const p = auxinSources[i];
    //     mainContext.beginPath();
    //     mainContext.arc(p.x, p.y, 1, 0, 2 * Math.PI);
    //     mainContext.fill();
    // }
    const veinWidths = [];
    for (let i = 0; i < veinNodes.length; i++) {
        veinWidths.push(0);
    }
    for (let i = veinNodes.length - 1; i >= 0; i--) {
        if (veinWidths[i] == 0) {
            veinWidths[i] = 0.4; // leaf node
        } else {
            veinWidths[i] = Math.pow(veinWidths[i], 1/widthPow);
        }
        if (parents[i] == null) continue;
        veinWidths[parents[i]] += Math.pow(veinWidths[i], widthPow);
    }

    mainContext.strokeStyle = "#303030";
    for (const [i, j] of edges) {
        const u = veinNodes[i];
        const v = veinNodes[j];
        mainContext.lineWidth = Math.min(veinWidths[i], veinWidths[j]);
        mainContext.beginPath();
        mainContext.moveTo(u.x, u.y);
        mainContext.lineTo(v.x, v.y);
        mainContext.stroke();
    }
}


function frame() {
    update();
    draw();
    requestAnimationFrame(frame)
}


//setInterval(frame, 100);
frame();
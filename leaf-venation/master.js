const mainContext = mainCanvas.getContext("2d");

const width = window.innerWidth;
const height = window.innerHeight;
mainCanvas.width = width;
mainCanvas.height = height;

// const leafContourCanvas = document.createElement("canvas");
const leafContourContext = leafContourCanvas.getContext("2d");
leafContourCanvas.width = width;
leafContourCanvas.height = height;

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


const birthDistanceAuxinSource = 50;
const birthDistanceVeinNode = 15;
const killDistance = 5;
const rho = 10;
const D = 1;
const widthPow = 3;

const scaleRate = 1.0005;
const scaleSpeed = 0.5;

const origin = new Vec2(width / 2, .9 * height);
//const origin = new Vec2((Math.random() * 0.8 + 0.1) * width, (Math.random() * 0.8 + 0.1) * height);
const veinNodes = [new Vec2(origin.x, origin.y)];
const parents = [null];
const auxinSources = [];
const edges = [];

const leafContour = [
    [new Vec2(915.19414, 590.79297), new Vec2(877.32251, 634.44264), new Vec2(876.78729, 684.61474)],
    [new Vec2(876.25208, 734.78683), new Vec2(901.32777, 738.38129), new Vec2(923.73855, 750.94703)],
    [new Vec2(936.75904, 758.24763), new Vec2(936.00370, 765.14159), new Vec2(949.12498, 765.14159)],
    [new Vec2(962.14652, 765.14159), new Vec2(957.81782, 760.59050), new Vec2(969.59790, 754.49567)],
    [new Vec2(988.10442, 744.92070), new Vec2(1018.6211, 716.52799), new Vec2(1018.7329, 685.70663)],
    [new Vec2(1018.8447, 654.88526), new Vec2(985.72535, 590.84338), new Vec2(949.94389, 552.49611)],
];

const leafOrigin = new Vec2(949, 762);

// TODO: base scale?
// let topLeft = null;
// let bottomRight = null;
// for (const [cp1, cp2, p] of leafContour) {
//     if (topLeft == null) {
//         topLeft = new Vec2(p.x, p.y);
//         bottomRight = new Vec2(p.x, p.y);
//         continue;
//     }
//     topLeft.x = Math.min(topLeft.x, p.x);
//     topLeft.y = Math.min(topLeft.y, p.y);
//     bottomRight.x = Math.max(bottomRight.x, p.x);
//     bottomRight.y = Math.max(bottomRight.y, p.y);
// }

for (const ps of leafContour) {
    for (const p of ps) {
        p.x = p.x - leafOrigin.x + origin.x;
        p.y = p.y - leafOrigin.y + origin.y;
    }
}

let it = 0;

function update() {

    it++;

    const elapsed = it;
    const scale = 1 + scaleSpeed * elapsed;
    const radius = scale * width / 10;

    leafContourContext.fillStyle = "white";
    leafContourContext.fillRect(0, 0, width, height);
    // leafContourContext.fillStyle = "black";
    leafContourContext.strokeStyle = "black";
    leafContourContext.lineWidth = 50;
    leafContourContext.beginPath();
    leafContourContext.moveTo(leafContour[leafContour.length - 1][2].x, leafContour[leafContour.length - 1][2].y);
    for (const [cp1, cp2, p] of leafContour) {
        leafContourContext.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
    }
    // leafContourContext.fill();
    leafContourContext.stroke();
    const leafContourImageData = leafContourContext.getImageData(0, 0, width, height).data;

    // Throw darts to add new auxin sources
    for (let r = 0; r < rho; r++) {
        // const randTheta = Math.random() * 2 * Math.PI;
        // const x = radius * Math.cos(randTheta);
        // const y = radius * Math.sin(randTheta);
        // const p = add(origin, new Vec2(x, y));
        const p = new Vec2(Math.random() * width, Math.random() * height);
        
        const i = Math.floor(p.y);
        const j = Math.floor(p.x);
        if (leafContourImageData[((i * width) + j) * 4] != 0 && Math.random() > .999) continue;

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

    // Uniform growth
    // for (let i = 0; i < auxinSources.length; i++) {
    //     auxinSources[i] = add(mul(auxinSources[i], scaleRate), mul(origin, 1 - scaleRate));
    // }
    // for (let i = 0; i < veinNodes.length; i++) {
    //     veinNodes[i] = add(mul(veinNodes[i], scaleRate), mul(origin, 1 - scaleRate));
    // }

    // Marginal growth
    for (const ps of leafContour) {
        for (const p of ps) {
            p.x = p.x * scaleRate + (1 - scaleRate) * origin.x; 
            p.y = p.y * scaleRate + (1 - scaleRate) * origin.y; 
        }
    }

}

function draw() {
    //mainContext.clearRect(0, 0, width, height);
    mainContext.fillStyle = "#f0f0f0";
    mainContext.fillRect(0, 0, width, height);

    // Draw leaf contour
    // mainContext.strokeStyle = "black";
    // mainContext.lineWidth = 1;
    // mainContext.beginPath();
    // mainContext.moveTo(leafContour[leafContour.length - 1][2].x, leafContour[leafContour.length - 1][2].y);
    // for (const [cp1, cp2, p] of leafContour) {
    //     mainContext.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
    // }
    // mainContext.stroke();

    // Draw auxin sources
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

frame();
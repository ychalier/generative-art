class Vec2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    copy() {
        return new Vec2(this.x, this.y);
    }

    norm() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    
    normalize() {
        const norm = this.norm();
        if (norm === 0) return new Vec2(0, 0);
        return this.div(norm);
    }

    add(q) {
        return new Vec2(this.x + q.x, this.y + q.y);
    }

    diff(q) {
        return new Vec2(this.x - q.x, this.y - q.y);
    }

    dist(q) {
        return Math.sqrt(Math.pow(this.x - q.x, 2) + Math.pow(this.y - q.y, 2));
    }

    mul(alpha) {
        return new Vec2(alpha * this.x, alpha * this.y);
    }

    div(alpha) {
        return this.mul(1/alpha);
    }
}

const mainContext = mainCanvas.getContext("2d");

const width = window.innerWidth;
const height = window.innerHeight;
mainCanvas.width = width;
mainCanvas.height = height;

const leafContourContext = leafContourCanvas.getContext("2d");
leafContourCanvas.width = width;
leafContourCanvas.height = height;

const dS = 1;
var birthDistanceAuxinSource = 10;
var birthDistanceVeinNode = 50;
var killDistance = 10;
var rho = 600 * Math.pow(10, -6);
var D = 10;
var widthPow = 5;
var drawContour = false;
var drawAuxinSources = true;
var initialLeafLength = 650;
var finalLeafLength = .8 * height / dS;
// var deltaL = 0.1;
var deltaL = 0;

var useLeafShape = false;


const origin = new Vec2(width / 2 / dS, .9 * height / dS);
//const origin = new Vec2((Math.random() * 0.8 + 0.1) * width, (Math.random() * 0.8 + 0.1) * height);
const veinNodes = [origin.copy()];
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

// Center contour around origin
for (const ps of leafContour) {
    for (const p of ps) {
        p.x = p.x - leafOrigin.x + origin.x;
        p.y = p.y - leafOrigin.y + origin.y;
    }
}

// Scale contour
let topLeft = null;
let bottomRight = null;
for (const [cp1, cp2, p] of leafContour) {
    if (topLeft == null) {
        topLeft = p.copy();
        bottomRight = p.copy();
        continue;
    }
    topLeft.x = Math.min(topLeft.x, p.x);
    topLeft.y = Math.min(topLeft.y, p.y);
    bottomRight.x = Math.max(bottomRight.x, p.x);
    bottomRight.y = Math.max(bottomRight.y, p.y);
}
const leafHeight = Math.abs(topLeft.y - bottomRight.y);
const contourBaseScale = initialLeafLength / leafHeight;
for (const ps of leafContour) {
    for (const p of ps) {
        p.x = p.x * contourBaseScale + (1 - contourBaseScale) * origin.x; 
        p.y = p.y * contourBaseScale + (1 - contourBaseScale) * origin.y; 
    }
}


//let it = 0;

var currentLeafLength = initialLeafLength;
function update() {

    // it++;

    // const elapsed = it;
    // const scale = 1 + scaleSpeed * elapsed;
    // const radius = scale * width / 10;


    if (useLeafShape && currentLeafLength < finalLeafLength) {
        var newLeafLength = currentLeafLength + deltaL;
        const scaleRate = newLeafLength / currentLeafLength;
        currentLeafLength = newLeafLength;
        //console.log(newLeafLength);
        // Marginal growth
        for (const ps of leafContour) {
            for (const p of ps) {
                p.x = p.x * scaleRate + (1 - scaleRate) * origin.x; 
                p.y = p.y * scaleRate + (1 - scaleRate) * origin.y; 
            }
        }
    }

    let area;
    let leafContourImageData;
    if (useLeafShape) {
        leafContourContext.fillStyle = "white";
        leafContourContext.fillRect(0, 0, width, height);
        leafContourContext.fillStyle = "black";
        // leafContourContext.strokeStyle = "black";
        // leafContourContext.lineWidth = 50;
        leafContourContext.beginPath();
        leafContourContext.moveTo(leafContour[leafContour.length - 1][2].x * dS, leafContour[leafContour.length - 1][2].y * dS);
        for (const [cp1, cp2, p] of leafContour) {
            leafContourContext.bezierCurveTo(cp1.x * dS, cp1.y * dS, cp2.x * dS, cp2.y * dS, p.x * dS, p.y * dS);
        }
        leafContourContext.fill();
        // leafContourContext.stroke();
        leafContourImageData = leafContourContext.getImageData(0, 0, width, height).data;
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                area += leafContourImageData[((i * width) + j) * 4] == 0 ? 1 : 0;
            }
        }
    } else {
        leafContourContext.fillStyle = "black";
        leafContourContext.fillRect(0, 0, width, height);
        leafContourImageData = leafContourContext.getImageData(0, 0, width, height).data;
        area = width * height / dS / dS;
    }
    
    const numberOfDarts = Math.ceil(area * rho);
    //console.log("Number of darts:", numberOfDarts);

    for (let r = 0; r < numberOfDarts; r++) {
        const p = new Vec2(Math.random() * width / dS, Math.random() * height / dS);        
        const i = Math.floor(p.y * dS);
        const j = Math.floor(p.x * dS);
        if (leafContourImageData[((i * width) + j) * 4] != 0) continue;
        let valid = true;
        for (const q of auxinSources) {
            const d = p.dist(q);
            if (d < birthDistanceAuxinSource) {
                valid = false;
                break;
            }
        }
        if (!valid) continue;
        for (const q of veinNodes) {
            const d = p.dist(q);
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
            const d = p.dist(q);
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
            v = v.add(q.diff(p).normalize());
        }
        v = v.div(n).mul(D).add(p)
        if (v.x < 0 || v.x >= width / dS || v.y < 0 || v.y >= height / dS) continue;
        edges.push([i, veinNodes.length]);
        parents.push(i);
        veinNodes.push(v);
    }

    for (let i = auxinSources.length - 1; i >= 0; i--) {
        const p = auxinSources[i];
        for (const q of veinNodes) {
            const d = p.dist(q);
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

}

function draw() {

    mainContext.fillStyle = "#f0f0f0";
    mainContext.fillRect(0, 0, width, height);

    if (drawContour) {
        mainContext.strokeStyle = "black";
        mainContext.lineWidth = 1;
        mainContext.beginPath();
        mainContext.moveTo(leafContour[leafContour.length - 1][2].x * dS, leafContour[leafContour.length - 1][2].y * dS);
        for (const [cp1, cp2, p] of leafContour) {
            mainContext.bezierCurveTo(cp1.x * dS, cp1.y * dS, cp2.x * dS, cp2.y * dS, p.x * dS, p.y * dS);
        }
        mainContext.stroke();
    }

    if (drawAuxinSources) {
        mainContext.fillStyle = "crimson";
        for (let i = 0; i < auxinSources.length; i++) {
            const p = auxinSources[i];
            mainContext.beginPath();
            mainContext.arc(p.x * dS, p.y * dS, 1, 0, 2 * Math.PI);
            mainContext.fill();
        }
    }

    const veinWidths = [];
    for (let i = 0; i < veinNodes.length; i++) {
        veinWidths.push(0);
    }
    for (let i = veinNodes.length - 1; i >= 0; i--) {
        if (veinWidths[i] == 0) {
            veinWidths[i] = 1; // leaf node
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
        mainContext.moveTo(u.x * dS, u.y * dS);
        mainContext.lineTo(v.x * dS, v.y * dS);
        mainContext.stroke();
    }
}


function frame() {
    update();
    draw();
    requestAnimationFrame(frame)
}

frame();

function updateParameters(u, v) {
    killDistance = 1 + u * 100;
    rho = (10 + 1000 * v) * Math.pow(10, -6);
}

window.addEventListener("mousemove", (e) => {
    updateParameters(e.clientX / width, e.clientY / height)
});
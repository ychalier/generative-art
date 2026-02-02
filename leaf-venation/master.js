const mainContext = mainCanvas.getContext("2d");
const leafContourContext = leafContourCanvas.getContext("2d");

var width;
var height;
var lf;
const timeStart = new Date();

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

function onResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    mainCanvas.width = width;
    mainCanvas.height = height;
    leafContourCanvas.width = width;
    leafContourCanvas.height = height;
}

function transformPoint(p, baseOrigin, targetOrigin, baseHeight, targetHeight) {
    const scale = targetHeight / baseHeight;
    return p.diff(baseOrigin).add(targetOrigin).mul(scale).add(targetOrigin.mul(1 - scale));
}

class LeafContour {

    constructor() {}
    setup(targetHeight, targetOrigin) {
        this.origin = targetOrigin;
    }
    grow(scale) {}
    draw(context) {}

}

class PointLeafContour extends LeafContour {

    constructor(basePoints, baseOrigin) {
        super();
        this.points = basePoints;
        this.baseOrigin = baseOrigin;
    }

    setup(targetHeight, targetOrigin) {
        let top = null;
        let bottom = null;
        for (const p of this.points) {
            if (top == null || p.y < top) top = p.y;
            if (bottom == null || p.y > bottom) bottom = p.y;
        }
        const baseHeight = Math.abs(top - bottom);
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            this.points[i] = transformPoint(p, this.baseOrigin, targetOrigin, baseHeight, targetHeight);
        }
        this.origin = targetOrigin;
    }

    grow(scale) {
        for (const p of this.points) {
            p.x = p.x * scale + (1 - scale) * this.origin.x;
            p.y = p.y * scale + (1 - scale) * this.origin.y;
        }
    }

}

class LineContour extends PointLeafContour {

    draw(context) {
        context.moveTo(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y);
        for (const p of this.points) {
            context.lineTo(p.x, p.y);
        }
    }

}

class BezierContour extends PointLeafContour {

    draw(context) {
        context.moveTo(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y);
        for (let i = 0; i < this.points.length; i += 3) {
            const cp1 = this.points[i];
            const cp2 = this.points[i + 1];
            const p = this.points[i + 2];
            context.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
        }
    }

}

class FullContour extends LeafContour {

    draw(context) {
        context.moveTo(0, 0);
        context.lineTo(width, 0);
        context.lineTo(width, height);
        context.lineTo(0, height);
        context.lineTo(0, 0);
    }

}

class LeafVenation {

    constructor(options) {
        this.options = options;
        if (this.options == undefined) {
            this.options = {};
        }
        if (!("birthDistanceAuxinSource"  in this.options)) this.options.birthDistanceAuxinSource  = 10;
        if (!("birthDistanceVeinNode"     in this.options)) this.options.birthDistanceVeinNode     = 10;
        if (!("killDistance"              in this.options)) this.options.killDistance              = 40;
        if (!("birthDensity"              in this.options)) this.options.birthDensity              = Math.pow(10, -6);
        if (!("veinLength"                in this.options)) this.options.veinLength                = 1;
        if (!("marginalGrowth"            in this.options)) this.options.marginalGrowth            = true;
        if (!("leafGrowth"                in this.options)) this.options.leafGrowth                = 0;
        if (!("initialLeafLength"         in this.options)) this.options.initialLeafLength         = 0.1 * height;
        if (!("finalLeafLength"           in this.options)) this.options.finalLeafLength           = 0.9 * height;
        if (!("leafOrigin"                in this.options)) this.options.leafOrigin                = new Vec2(.5 * width, .5 * height);
        if (!("leafContour"               in this.options)) this.options.leafContour               = new FullContour();
        if (!("backgroundColor"           in this.options)) this.options.backgroundColor           = "#1c1b22";
        if (!("veinColor"                 in this.options)) this.options.veinColor                 = "#8b0404";
        if (!("contourStroke"             in this.options)) this.options.contourStroke             = false;
        if (!("contourStrokeColor"        in this.options)) this.options.contourStrokeColor        = "#000000";
        if (!("contourStrokeWidth"        in this.options)) this.options.contourStrokeWidth        = 1;
        if (!("contourFill"               in this.options)) this.options.contourFill               = false;
        if (!("contourFillColor"          in this.options)) this.options.contourFillColor          = "#cccccc";
        if (!("auxinSourceFill"           in this.options)) this.options.auxinSourceFill           = false;
        if (!("auxinSourceColor"          in this.options)) this.options.auxinSourceColor          = "#dc143c";
        if (!("auxinSourceRadius"         in this.options)) this.options.auxinSourceRadius         = 1;
        if (!("veinWidthExponent"         in this.options)) this.options.veinWidthExponent         = 3;
        if (!("veinWidthBase"             in this.options)) this.options.veinWidthBase             = 1;
        if (!("veinWidthMax"              in this.options)) this.options.veinWidthMax              = 5;
        if (!("veinWidthAnimated"         in this.options)) this.options.veinWidthAnimated         = true;
        if (!("veinWidthXFrequency"       in this.options)) this.options.veinWidthXFrequency       = 0.013;
        if (!("veinWidthYFrequency"       in this.options)) this.options.veinWidthYFrequency       = 0.007;
        if (!("veinWidthTimeFrequency"    in this.options)) this.options.veinWidthTimeFrequency    = 1;
        if (!("veinWidthAmplitude"        in this.options)) this.options.veinWidthAmplitude        = 0.5;
        if (!("fancy"                     in this.options)) this.options.fancy                     = false;
        this.options.leafContour.setup(this.options.initialLeafLength, this.options.leafOrigin);
        this.leafLength = this.options.initialLeafLength;
        this.leafInner = null;
        this.veinNodes = [this.options.leafOrigin.copy()];
        this.auxinSources = [];
        this.parents = [null];
        this.edges = [];
        this.auxinSourcesPool = null;
    }

    isWithinLeaf(y, x) {
        if (this.leafInner == null) return true;
        return this.leafInner[((Math.floor(y) * width) + Math.floor(x)) * 4] == 0;
    }

    growLeaf() {
        const newLeafLength = Math.min(this.options.finalLeafLength, this.leafLength + this.options.leafGrowth);
        const growthScale = newLeafLength / this.leafLength;
        this.leafLength = newLeafLength;
        this.options.leafContour.grow(growthScale);
        leafContourContext.fillStyle = "white";
        leafContourContext.fillRect(0, 0, width, height);
        leafContourContext.fillStyle = "black";
        leafContourContext.beginPath();
        this.options.leafContour.draw(leafContourContext);
        leafContourContext.fill();
        let area = 0;
        this.leafInner = leafContourContext.getImageData(0, 0, width, height).data;
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                area += this.isWithinLeaf(i, j) ? 1 : 0;
            }
        }
        return area;
    }

    addAuxinSources(leafArea) {
        if (this.options.marginalGrowth) {
            if (this.auxinSourcesPool == null) {
                this.auxinSourcesPool = [];
                const totalArea = width * height;
                const numberOfDarts = Math.ceil(totalArea * this.options.birthDensity);
                for (let r = 0; r < numberOfDarts; r++) {
                    const p = new Vec2(Math.random() * width, Math.random() * height);
                    let valid = true;
                    for (const q of this.auxinSourcesPool) {
                        const d = p.dist(q);
                        if (d < this.options.birthDistanceAuxinSource) {
                            valid = false;
                            break;
                        }
                    }
                    if (!valid) continue;
                    this.auxinSourcesPool.push(p);
                }
            }
            for (let i = this.auxinSourcesPool.length - 1; i >= 0; i--) {
                const p = this.auxinSourcesPool[i];
                if (this.isWithinLeaf(p.y, p.x)) {
                    this.auxinSources.push(p);
                    this.auxinSourcesPool.splice(i, 1);
                }
            }
        } else {
            const numberOfDarts = Math.ceil(leafArea * this.options.birthDensity);
            for (let r = 0; r < numberOfDarts; r++) {
                const p = new Vec2(Math.random() * width, Math.random() * height);
                if (!(this.isWithinLeaf(p.y, p.x))) continue;
                let valid = true;
                for (const q of this.auxinSources) {
                    const d = p.dist(q);
                    if (d < this.options.birthDistanceAuxinSource) {
                        valid = false;
                        break;
                    }
                }
                if (!valid) continue;
                for (const q of this.veinNodes) {
                    const d = p.dist(q);
                    if (d < this.options.birthDistanceVeinNode) {
                        valid = false;
                        break;
                    }
                }
                if (!valid) continue;
                this.auxinSources.push(p);
            }
        }
    }

    computeInfluences() {
        const influences = [];
        for (let i = 0; i < this.veinNodes.length; i++) {
            influences.push([]);
        }
        for (const p of this.auxinSources) {
            let minD, minI;
            for (let i = 0; i < this.veinNodes.length; i++) {
                const q = this.veinNodes[i];
                const d = p.dist(q);
                if (minD == undefined || d < minD) {
                    minD = d;
                    minI = i;
                }
            }
            influences[minI].push(p);
        }
        return influences;
    }

    addVeinNodes(influences) {
        const veinNodesLength = this.veinNodes.length;
        for (let i = 0; i < veinNodesLength; i++) {
            const p = this.veinNodes[i];
            if (influences[i].length === 0) continue;
            let n = 0;
            let v = new Vec2(0, 0);
            for (const q of influences[i]) {
                n++;
                v = v.add(q.diff(p).normalize());
            }
            v = v.div(n).mul(this.options.veinLength).add(p)
            if (v.x < 0 || v.x >= width || v.y < 0 || v.y >= height) continue;
            this.edges.push([i, this.veinNodes.length]);
            this.parents.push(i);
            this.veinNodes.push(v);
        }
    }

    killAuxinSources() {
        for (let i = this.auxinSources.length - 1; i >= 0; i--) {
            const p = this.auxinSources[i];
            for (const q of this.veinNodes) {
                const d = p.dist(q);
                if (d < this.options.killDistance) {
                    this.auxinSources.splice(i, 1);
                    break;
                }
            }
        }
    }

    next() {
        const area = this.growLeaf();
        this.addAuxinSources(area);
        const influences = this.computeInfluences();
        this.addVeinNodes(influences);
        this.killAuxinSources();
    }

    drawContour() {
        mainContext.strokeStyle = this.options.contourStrokeColor;
        mainContext.lineWidth = this.options.contourStrokeWidth;
        mainContext.fillStyle = this.options.contourFillColor;
        mainContext.beginPath();
        this.options.leafContour.draw(mainContext);
        if (this.options.contourStroke) mainContext.stroke();
        if (this.options.contourFill) mainContext.fill();
    }

    drawAuxinSources() {
        mainContext.fillStyle = this.options.auxinSourceColor;
        for (const p of this.auxinSources) {
            mainContext.beginPath();
            mainContext.arc(p.x, p.y, this.options.auxinSourceRadius, 0, 2 * Math.PI);
            mainContext.fill();
        }
    }

    computeVeinWidths() {
        const veinWidths = [];
        for (let i = 0; i < this.veinNodes.length; i++) {
            veinWidths.push(0);
        }
        for (let i = this.veinNodes.length - 1; i >= 0; i--) {
            if (veinWidths[i] == 0) {
                veinWidths[i] = this.options.veinWidthBase; // leaf node
            } else {
                veinWidths[i] = Math.pow(veinWidths[i], 1/this.options.veinWidthExponent);
            }
            if (this.parents[i] == null) continue;
            veinWidths[this.parents[i]] += Math.pow(veinWidths[i], this.options.veinWidthExponent);
        }
        for (let i = 0; i < veinWidths.length; i++) {
            veinWidths[i] = Math.min(this.options.veinWidthMax, veinWidths[i]);
        }
        return veinWidths;
    }

    drawVeinsFancy() {
        const veinWidths = this.computeVeinWidths();
        const veinWidthMap = new Map();
        for (let i = 0; i < this.veinNodes.length; i++) {
            const w = Math.round(veinWidths[i] * 100);
            if (!veinWidthMap.has(w)) {
                veinWidthMap.set(w, new Set([i]));
            } else {
                veinWidthMap.get(w).add(i);
            }
        }
        const parentsMap = new Map();
        for (let i = 0; i < this.veinNodes.length; i++) {
            let j = this.parents[i];
            parentsMap.set(i, j);
        }
        veinWidthMap.forEach((veinIds, w, map) => {
            mainContext.lineWidth = w / 100;
            const reached = new Set();
            const concernedParents = new Set();
            parentsMap.forEach((j, i, foo) => {
                if (veinIds.has(i)) {
                    concernedParents.add(j);
                }
            });
            const leafNodes = new Set(parentsMap.keys()).difference(concernedParents).intersection(veinIds);
            for (const leaf of leafNodes) {
                let i = leaf;
                let u = this.veinNodes[i];
                mainContext.beginPath();
                mainContext.moveTo(u.x, u.y);
                while (true) {
                    i = parentsMap.get(i);
                    if (i == null) break;
                    u = this.veinNodes[i];
                    mainContext.lineTo(u.x, u.y);
                    if (reached.has(i)) break;
                    if (Math.round(veinWidths[i] * 100) != w) break;
                    reached.add(i);
                }
                mainContext.stroke();
            }
        });
    }

    drawVeinsBasic() {
        const elapsedSeconds = (new Date() - timeStart) / 1000;
        const spaceFrequency = 0.1;
        const timeFrequency = 10;
        const veinWidths = this.computeVeinWidths();
        mainContext.strokeStyle = this.options.veinColor;
        for (const [i, j] of this.edges) {
            const u = this.veinNodes[i];
            const v = this.veinNodes[j];
            let veinWidth = Math.min(veinWidths[i], veinWidths[j]);
            if (this.options.veinWidthAnimated) {
                veinWidth *= 1 + this.options.veinWidthAmplitude * Math.cos((u.x * this.options.veinWidthXFrequency + u.y * this.options.veinWidthYFrequency + elapsedSeconds * this.options.veinWidthTimeFrequency) * 2 * Math.PI);
            }
            mainContext.lineWidth = veinWidth;
            mainContext.beginPath();
            mainContext.moveTo(u.x, u.y);
            mainContext.lineTo(v.x, v.y);
            mainContext.stroke();
        }
    }

    draw() {
        mainContext.fillStyle = this.options.backgroundColor;
        mainContext.fillRect(0, 0, width, height);
        if (this.options.contourStroke || this.options.contourFill) this.drawContour();
        if (this.options.auxinSourceFill) this.drawAuxinSources();
        this.options.fancy ? this.drawVeinsFancy() : this.drawVeinsBasic();
    }

}

const DEFAULT_LEAF_CONTOUR = new BezierContour(
    [
        new Vec2(915.19414, 590.79297), new Vec2(877.32251, 634.44264), new Vec2(876.78729, 684.61474),
        new Vec2(876.25208, 734.78683), new Vec2(901.32777, 738.38129), new Vec2(923.73855, 750.94703),
        new Vec2(936.75904, 758.24763), new Vec2(936.00370, 765.14159), new Vec2(949.12498, 765.14159),
        new Vec2(962.14652, 765.14159), new Vec2(957.81782, 760.59050), new Vec2(969.59790, 754.49567),
        new Vec2(988.10442, 744.92070), new Vec2(1018.6211, 716.52799), new Vec2(1018.7329, 685.70663),
        new Vec2(1018.8447, 654.88526), new Vec2(985.72535, 590.84338), new Vec2(949.94389, 552.49611),
    ],
    new Vec2(949, 762),
);

function frame() {
    lf.next();
    lf.draw();
    requestAnimationFrame(frame)
}

function perpendicularDistance(a, b, c) {
    // Computes the perpendicular distance of c to the line ab
    // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
    return Math.abs((b.y - a.y) * c.x - (b.x - a.x) * c.y + b.x * a.y - b.y * a.x) / Math.sqrt(Math.pow(b.y - a.y, 2) + Math.pow(b.x - a.x, 2));
}

function simplifyLine(points, epsilon) {
    // Implementation of the Ramer-Douglas-Pecker algorithm
    // https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
    if (points.length < 2) throw new Error("Not enough points!");
    if (points.length == 2) return points;
    const a = points[0];
    const b = points[points.length - 1];
    let farthestI = null;
    let farthestDistance = null;
    for (let i = 1; i < points.length - 1; i++) {
        const c = points[i];
        const distance = perpendicularDistance(a, b, c);
        if (farthestI == null || distance > farthestDistance) {
            farthestI = i;
            farthestDistance = distance;
        }
    }
    if (farthestDistance < epsilon) return [a, b];
    const left = simplifyLine(points.slice(0, farthestI + 1), epsilon);
    const right = simplifyLine(points.slice(farthestI), epsilon);
    return left.concat(right.slice(1));
}

function parsePointList(text) {
    const points = [];
    for (const part of text.split(";")) {
        if (part.length == 0) continue;
        const [left, right] = part.split(",");
        points.push(new Vec2(parseFloat(left), parseFloat(right)))
    }
    return points;
}

function formatPointList(points) {
    let pointStrings = [];
    for (const p of points) {
        pointStrings.push(`${p.x},${p.y}`);
    }
    return pointStrings.join(";");
}

function setupLeafContourInput() {
    const inputCanvas = leafContourCanvasInput;
    const inputCanvasBounds = inputCanvas.getBoundingClientRect();
    inputCanvas.width = inputCanvasBounds.width;
    inputCanvas.height = inputCanvasBounds.height;
    const inputContext = inputCanvas.getContext("2d");
    var drawing = false;
    const epsilon = 1.5;
    var points = parsePointList(inputLeafContourPoints.value);
    var relativeOrigin = new Vec2(0.5 * inputCanvasBounds.width, 0.5 * inputCanvasBounds.height);
    if (inputLeafContourOrigin.value != "") {
        relativeOrigin = parsePointList(inputLeafContourOrigin.value)[0];
    }
    var absoluteOrigin = new Vec2(0.5 * inputCanvasBounds.width, 0.5 * inputCanvasBounds.height);
    if (inputOrigin.value != "") {
        absoluteOrigin = parsePointList(inputOrigin.value)[0];
        absoluteOrigin.x *= inputCanvasBounds.width;
        absoluteOrigin.y *= inputCanvasBounds.height;
    }
    function getClickPoint(e) {
        return new Vec2(e.clientX - inputCanvasBounds.left, e.clientY - inputCanvasBounds.top);
    }
    function drawInputCanvas() {
        inputContext.clearRect(0, 0, inputCanvasBounds.width, inputCanvasBounds.height);
        inputContext.fillStyle = "green";
        inputContext.beginPath();
        inputContext.arc(absoluteOrigin.x, absoluteOrigin.y, 3, 0, 2 * Math.PI);
        inputContext.fill();
        inputContext.fillStyle = "red";
        inputContext.beginPath();
        inputContext.arc(relativeOrigin.x, relativeOrigin.y, 2, 0, 2 * Math.PI);
        inputContext.fill();
        inputContext.strokeStyle = "black";
        inputContext.lineWidth = 1;
        if (points.length == 0) return;
        inputContext.beginPath();
        inputContext.moveTo(points[points.length - 1].x, points[points.length - 1].y);
        for (const p of points.slice(1)) {
            inputContext.lineTo(p.x, p.y);
        }
        inputContext.stroke();
    }
    function update() {
        drawInputCanvas();
        inputLeafContourPoints.value = formatPointList(points);
        inputLeafContourOrigin.value = `${relativeOrigin.x},${relativeOrigin.y}`;
        inputOrigin.value = `${absoluteOrigin.x/inputCanvasBounds.width},${absoluteOrigin.y/inputCanvasBounds.height}`;
    }
    inputCanvas.addEventListener("mousedown", (e) => {
        if (e.button == 0) {
            if (e.shiftKey) {
                drawing = true;
                points = [getClickPoint(e)];
            } else {
                absoluteOrigin = getClickPoint(e);
            }
        } else if (e.button == 2 && e.shiftKey) {
            relativeOrigin = getClickPoint(e);
        }
        update();
    });
    inputCanvas.addEventListener("mousemove", (e) => {
        if (drawing) {
            points.push(getClickPoint(e));
            update();
        }
    });
    inputCanvas.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });
    window.addEventListener("mouseup", (e) => {
        if (drawing) {
            drawing = false;
            if (points.length < 2) {
                points = [];
            } else {
                points = simplifyLine(points, epsilon);
            }
            update();
        }
    });
    update();
}

function extractLeafContour(formData) {
    const valuePoints = formData.get("leafContourPoints");
    if (valuePoints == "") return new FullContour();
    const valueOrigin = formData.get("leafContourOrigin");
    return new LineContour(parsePointList(valuePoints), parsePointList(valueOrigin)[0]);
}

function extractLeafOrigin(formData) {
    const value = formData.get("leafOrigin");
    if (!value) {
        return new Vec2(0.5 * width, 0.5 * height);
    }
    const p = parsePointList(value)[0];
    p.x *= width;
    p.y *= height;
    return p;
}

function onOptionsFormSubmit(e) {
    e.preventDefault();
    startMenu.close();
    const formData = new FormData(optionsForm);
    lf = new LeafVenation({
        birthDistanceAuxinSource: parseFloat(formData.get("birthDistanceAuxinSource")),
        birthDistanceVeinNode: parseFloat(formData.get("birthDistanceVeinNode")),
        killDistance: parseFloat(formData.get("killDistance")),
        birthDensity: parseFloat(formData.get("birthDensity")),
        veinLength: parseFloat(formData.get("veinLength")),
        marginalGrowth: formData.get("marginalGrowth") == "on",
        leafGrowth: parseFloat(formData.get("leafGrowth")),
        initialLeafLength: parseFloat(formData.get("initialLeafLength")),
        finalLeafLength: parseFloat(formData.get("finalLeafLength")),
        leafOrigin: extractLeafOrigin(formData),
        leafContour: extractLeafContour(formData), // DEFAULT_LEAF_CONTOUR
        backgroundColor: formData.get("backgroundColor"),
        veinColor: formData.get("veinColor"),
        contourStroke: formData.get("contourStroke") == "on",
        contourStrokeColor: formData.get("contourStrokeColor"),
        contourStrokeWidth: parseFloat(formData.get("contourStrokeWidth")),
        contourFill: formData.get("contourFill") == "on",
        contourFillColor: formData.get("contourFillColor"),
        auxinSourceFill: formData.get("auxinSourceFill") == "on",
        auxinSourceColor: formData.get("auxinSourceColor"),
        auxinSourceRadius: parseFloat(formData.get("auxinSourceRadius")),
        veinWidthExponent: parseFloat(formData.get("veinWidthExponent")),
        veinWidthBase: parseFloat(formData.get("veinWidthBase")),
        veinWidthMax: parseFloat(formData.get("veinWidthMax")),
        veinWidthAnimated: formData.get("veinWidthAnimated") == "on",
        veinWidthXFrequency: parseFloat(formData.get("veinWidthXFrequency")),
        veinWidthYFrequency: parseFloat(formData.get("veinWidthYFrequency")),
        veinWidthTimeFrequency: parseFloat(formData.get("veinWidthTimeFrequency")),
        veinWidthAmplitude: parseFloat(formData.get("veinWidthAmplitude")),
    });
    frame();
}

window.addEventListener("resize", onResize);
optionsForm.addEventListener("submit", onOptionsFormSubmit);
onResize();
startMenu.showModal();
setupLeafContourInput();

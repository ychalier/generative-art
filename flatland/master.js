const norm = u => Math.sqrt(u.x * u.x + u.y * u.y);
const dot = (u, v) => u.x * v.x + u.y * v.y;
const rot = (u, theta) => {return {x: u.x * Math.cos(theta) - u.y * Math.sin(theta), y: u.x * Math.sin(theta) + u.y * Math.cos(theta)};}
const normalize = (u) => {const n = norm(u); return {x: u.x / n, y: u.y / n};}
const project = (x, fromMin, fromMax, toMin, toMax) => (x - fromMin) / (fromMax - fromMin) * (toMax - toMin) + toMin;

const flatContext        = flatCanvas.getContext("2d");
const birdContext        = birdCanvas.getContext("2d");
const BACKGROUND_COLOR   = [0, 0, 0];
const BIRD_SCALE         = .15;
const CAMERA_SENSITIVITY = 0.004; // radian per pixel
const SPEED_WALK         = 300;   // pixels per second
const SPEED_SPRINT       = 800;   // pixels per second
const CHUNK_SIZE         = 800;  // pixels
const RENDER_DISTANCE    = 800;  // pixels
const CHUNK_RADIUS       = 1;
const CHUNK_DENSITY      = 5;
const FOG_START_RATIO    = 0.6;
var   playerPosition     = {x: 0, y: 0};
var   playerSpeed        = {x: 0, y: 0};
var   lightDirection     = normalize({x: -1, y: 1});
var   fov                = Math.PI / 3;
var   cameraDirection    = Math.PI / 4;
var   sprintOn           = false;
var   previousRenderTime = 0;
var   width              = window.innerWidth;
var   height             = window.innerHeight;
var   toastTimeout       = null;
var   loadedChunks       = new Map();
var   svgPolygons        = null;

function getChunkCoords(x, y) {
    return [
        Math.floor(x / CHUNK_SIZE),
        Math.floor(y / CHUNK_SIZE)
    ];
}

/**
 * @see https://github.com/cprosche/mulberry32
 */
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const POLYGON_TYPE_LINE = 0;
const POLYGON_TYPE_TRIANGLE = 1;
const POLYGON_TYPE_TRIANGLE_ISOCELES = 2;
const POLYGON_TYPE_TRIANGLE_EQUILATERAL = 3;
const POLYGON_TYPE_QUADRILATERIAL = 4;
const POLYGON_TYPE_SQUARE = 5;
const POLYGON_TYPE_CIRCLE = 6;

const POLYGON_WEIGHTS = [
    [POLYGON_TYPE_LINE, 10],
    [POLYGON_TYPE_TRIANGLE, 1],
    [POLYGON_TYPE_TRIANGLE_ISOCELES, 10],
    [POLYGON_TYPE_TRIANGLE_EQUILATERAL, 5],
    [POLYGON_TYPE_QUADRILATERIAL, 1],
    [POLYGON_TYPE_SQUARE, 10],
    [POLYGON_TYPE_CIRCLE, 2],
]

let total = 0;
for (const [foo, weight] of POLYGON_WEIGHTS) {
    total += weight;
}
const TOTAL_POLYGON_WEIGHTS = total;

function generateGeneralPolygonPoints(rng, px, py, sides) {
    const angles = [];
    const magnitudes = [];
    for (let i = 0; i < sides; i++) {
        angles.push(rng() * 2 * Math.PI);
        magnitudes.push(100 + rng() * 50);
    }
    angles.sort();
    const points = [];
    for (let i = 0; i  < sides; i++) {
        points.push([
            px + magnitudes[i] * Math.cos(angles[i]),
            py + magnitudes[i] * Math.sin(angles[i])
        ]);
    }
    return points;
}

function generateIsoceles(size, px, py, angle) {
    return [
        [px, py],
        [px + size, py], 
        [px + size / 2, py + size / 2 / Math.tan(angle / 2)]
    ];
}

function generateRegularPolygonPoints(size, px, py, sides) {
    const points = [];
    let theta = 0;
    for (let i = 0; i < sides; i++) {
        points.push([
            px + size * Math.cos(theta),
            py + size * Math.sin(theta)
        ]);
        theta += 2 * Math.PI / sides;
    }
    return points;
}

function generatePolygon(rng, px, py) {
    let polygonType;
    const polygonTypeSeed = rng();
    let cumWeight = 0;
    for (const [pType, pWeight] of POLYGON_WEIGHTS) {
        cumWeight += pWeight / TOTAL_POLYGON_WEIGHTS;
        if (polygonTypeSeed < cumWeight) {
            polygonType = pType;
            break;
        }
    }
    let points;
    if (polygonType == POLYGON_TYPE_LINE) {
        const size = 50 + rng() * 100;
        points = [
            [px, py],
            [px + size, py],
            [px + size, py + .001],
            [px, py + .001],
        ];
    } else if (polygonType == POLYGON_TYPE_TRIANGLE) {
        points = generateGeneralPolygonPoints(rng, px, py, 3);
    } else if (polygonType == POLYGON_TYPE_TRIANGLE_ISOCELES) {
        points = generateIsoceles(25 + rng() * 50, px, py, rng() * Math.PI / 3);
    } else if (polygonType == POLYGON_TYPE_TRIANGLE_EQUILATERAL) {
        points = generateRegularPolygonPoints(50 + rng() * 100, px, py, 3);
    } else if (polygonType == POLYGON_TYPE_QUADRILATERIAL) {
        points = generateGeneralPolygonPoints(rng, px, py, 4);
    } else if (polygonType == POLYGON_TYPE_SQUARE) {
        points = generateRegularPolygonPoints(50 + rng() * 100, px, py, 4);
    } else if (polygonType == POLYGON_TYPE_CIRCLE) {
        points = generateRegularPolygonPoints(50 + rng() * 100, px, py, 40);
    } else {
        console.error("Wrong polygon type", polygonType);
    }
    points = rotatePolygon(points, rng() * Math.PI * 2);
    const color = randomVibrantColor(rng);
    const polygon = { points: points, color };
    polygon.segments = extractSegments(polygon);
    return polygon;
}

function generateChunk(cx, cy) {
    const rng = mulberry32(cx * 12345 + cy * 67890);
    const polygons = [];
    for (let i = 0; i < rng() * CHUNK_DENSITY; i++) {
        const px = cx * CHUNK_SIZE + rng() * CHUNK_SIZE;
        const py = cy * CHUNK_SIZE + rng() * CHUNK_SIZE;
        const polygon = generatePolygon(rng, px, py);
        polygons.push(polygon);
    }
    return polygons;
}

function rotatePolygon(points, theta) {
    let cx = 0;
    let cy = 0;
    for (const [x, y] of points) {
        cx += x;
        cy += y;
    }
    cx /= points.length;
    cy /= points.length;
    const newPoints = [];
    for (const [x, y] of points) {
        const u = {x: x - cx, y: y - cy};
        const v = rot(u, theta);
        newPoints.push([v.x + cx, v.y + cy]);
    }
    return newPoints;
}

function extractSegments(polygon) {
    const segments = [];
    for (let i = 0; i < polygon.points.length; i++) {
        const [x0, y0] = polygon.points[i];
        const [x1, y1] = polygon.points[(i + 1) % polygon.points.length];
        segments.push({
            x0: x0, y0: y0, x1: x1, y1: y1,
            color: polygon.color,
            normal: normalize(rot({x: x1 - x0, y: y1 - y0}, Math.PI / 2)),
            barycenter: {x: (x0 + x1)/2, y: (y0 + y1)/2},
        });
    }
    return segments;
}

function setSize() {
    width   = window.innerWidth;
    height  = window.innerHeight;
    flatCanvas.width  = width;
    flatCanvas.height = 1;
    birdCanvas.width  = BIRD_SCALE * width;
    birdCanvas.height = BIRD_SCALE * height;
}

function toast(message) {
    toastBar.textContent = message;
    toastBar.classList.remove("hidden");
    if (toastTimeout != null) {
        clearTimeout(toastTimeout);
    }
    toastTimeout = setTimeout(() => {
       toastBar.classList.add("hidden");
        toastBar.textContent = "";
        toastTimeout = null; 
    }, 500);
}

function hexToRgb(hex) {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) {
        hex = hex.split("").map(c => c + c).join("");
    }
    const intVal = parseInt(hex, 16);
    return [
        (intVal >> 16) & 255,
        (intVal >> 8) & 255,
        intVal & 255
    ];
}

function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n =>
        l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function randomVibrantColor(rng) {
    const hue = Math.floor(rng() * 360);
    const sat = 70 + rng() * 30;
    const light = 40 + rng() * 20;
    return hslToRgb(hue, sat, light);
}

function extractFillColor(path) {
    const style = path.getAttribute("style");
    for (const part of style.split(";")) {
        const [key, value] = style.split(":");
        if (key == "fill") return value;
    }
}

async function loadSvgWorldModel(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load SVG: ${response.status}`);
    }
    const text = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, "image/svg+xml");
    const scale = width / parseFloat(svgDoc.querySelector("svg").getAttribute("viewBox").split(" ")[2]);
    const paths = svgDoc.querySelectorAll("path");
    const polygons = [];
    paths.forEach(path => {
        const d = path.getAttribute("d");
        const fill = extractFillColor(path);
        if (!d || !fill) return;
        const rgb = hexToRgb(fill);
        let points = [];
        let curPoint = {x: 0, y: 0};
        let lastPoint = {x: 0, y: 0};
        try {
            const commands = path.getPathData().map(cmd => ({
                type: cmd.type,
                values: cmd.values
            }));
            for (const command of commands) {
                if (command.type == "l" || command.type == "m") {
                    const [x, y] = command.values;
                    curPoint = {x: lastPoint.x + x, y: lastPoint.y + y};
                } else if (command.type == "L" || command.type == "M") {
                    const [x, y] = command.values;
                    curPoint = {x: x, y: y};
                } else {
                    continue;
                }
                points.push([scale * curPoint.x, scale * curPoint.y]);
                lastPoint = curPoint;
            }
        } catch (e) {
            console.warn("Could not parse path", d, e);
        }
        const polygon = {points: points, color: rgb};
        polygon.segments = extractSegments(polygon);
        polygons.push(polygon);
    });
    return polygons;
}

function drawFlatView(polygons) {
    const imageData = new ImageData(width, 1);
    for (let j = 0; j < width; j++) {
        const theta = cameraDirection - fov + j / width * 2 * fov;
        const a = Math.tan(theta);
        const b = playerPosition.y - a * playerPosition.x;
        let minDistance;
        let color = [BACKGROUND_COLOR[0], BACKGROUND_COLOR[1], BACKGROUND_COLOR[2]];
        let light = 1;
        let opacity = 0;
        for (const polygon of polygons) {
            for (const segment of polygon.segments) {
                let distance = norm({x: segment.barycenter.x - playerPosition.x, y: segment.barycenter.y - playerPosition.y});
                if (distance >= RENDER_DISTANCE) continue;
                let t = (a * segment.x0 + b - segment.y0) / (segment.y1 - segment.y0 - a * segment.x1 + a * segment.x0);
                if (t >= 0 && t <= 1) {
                    const x2 = (1 - t) * segment.x0 + t * segment.x1;
                    const y2 = (1 - t) * segment.y0 + t * segment.y1;
                    const u = {x: Math.cos(theta), y: Math.sin(theta)};
                    const v = {x: x2 - playerPosition.x, y: y2 - playerPosition.y};
                    if (dot(u, v) < 0) {
                        continue;
                    }
                    distance = norm({x: x2 - playerPosition.x, y: y2 - playerPosition.y});
                    if (minDistance == undefined || distance < minDistance) {
                        minDistance = distance;
                        color = segment.color;
                        // light = project(dot(segment.normal, lightDirection), -1, 1, .4, 1);
                        light = Math.pow(project(distance, 0, 500, 1, 0), 2);
                        opacity = 1;
                        if (distance >= FOG_START_RATIO * RENDER_DISTANCE) {
                            opacity = Math.max(0, Math.min(1, project(distance - FOG_START_RATIO * RENDER_DISTANCE, 0, (1 - FOG_START_RATIO) * RENDER_DISTANCE, 1, 0)));
                        }
                    }
                }
            }
        }
        imageData.data[4*j + 0] = (1 - opacity) * BACKGROUND_COLOR[0] + opacity * light * color[0];
        imageData.data[4*j + 1] = (1 - opacity) * BACKGROUND_COLOR[1] + opacity * light * color[1];
        imageData.data[4*j + 2] = (1 - opacity) * BACKGROUND_COLOR[2] + opacity * light * color[2];
        imageData.data[4*j + 3] = 255;
    }
    flatContext.putImageData(imageData, 0, 0);
}

function drawBirdView(polygons) {

    const bX = BIRD_SCALE * (playerPosition.x - width / 2);
    const bY = BIRD_SCALE * (playerPosition.y - height / 2);

    const size = Math.min(width, height) / 2;
    const lightGradient = birdContext.createLinearGradient(
        BIRD_SCALE * .5 * width,
        BIRD_SCALE * .5 * height,
        BIRD_SCALE * .5 * width + lightDirection.x * size,
        BIRD_SCALE * .5 * height + lightDirection.y * size,
    );
    lightGradient.addColorStop(0, "#FFFFFF");
    lightGradient.addColorStop(.25, "#E3D03D");
    lightGradient.addColorStop(.5, "#9B772A");
    birdContext.fillStyle = lightGradient;
    birdContext.fillRect(0, 0, BIRD_SCALE * width, BIRD_SCALE * height);

    for (const polygon of polygons) {
        const [r, g, b] = polygon.color;
        birdContext.fillStyle = `rgb(${r}, ${g}, ${b})`;
        birdContext.beginPath();
        [x0, y0] = polygon.points[polygon.points.length - 1];
        birdContext.moveTo(BIRD_SCALE * x0 - bX, BIRD_SCALE * y0 - bY)
        for (const [x, y] of polygon.points) {
            birdContext.lineTo(BIRD_SCALE * x - bX, BIRD_SCALE * y - bY);
        }
        birdContext.fill();
    }
    birdContext.fillStyle = "#ff000080";
    birdContext.beginPath();
    birdContext.moveTo(BIRD_SCALE * playerPosition.x - bX, BIRD_SCALE * playerPosition.y - bY);
    birdContext.lineTo(BIRD_SCALE * (playerPosition.x + 50 * Math.cos(cameraDirection - fov)) -bX, BIRD_SCALE * (playerPosition.y + 50 * Math.sin(cameraDirection - fov)) - bY);
    birdContext.arc(BIRD_SCALE * playerPosition.x - bX, BIRD_SCALE * playerPosition.y - bY, BIRD_SCALE * 50, cameraDirection - fov, cameraDirection + fov);
    birdContext.fill();

    birdContext.strokeStyle = "red";
    birdContext.beginPath();
    birdContext.moveTo(BIRD_SCALE * playerPosition.x - bX, BIRD_SCALE * playerPosition.y - bY);
    birdContext.lineTo(BIRD_SCALE * (playerPosition.x + 50 * Math.cos(cameraDirection - fov)) - bX, BIRD_SCALE * (playerPosition.y + 50 * Math.sin(cameraDirection - fov)) - bY);
    birdContext.stroke();

    birdContext.beginPath();
    birdContext.moveTo(BIRD_SCALE * playerPosition.x - bX, BIRD_SCALE * playerPosition.y - bY);
    birdContext.lineTo(BIRD_SCALE * (playerPosition.x + 50 * Math.cos(cameraDirection + fov)) - bX, BIRD_SCALE * (playerPosition.y + 50 * Math.sin(cameraDirection + fov)) - bY);
    birdContext.stroke();

    birdContext.fillStyle = "black";
    birdContext.beginPath();
    birdContext.arc(BIRD_SCALE * playerPosition.x - bX, BIRD_SCALE * playerPosition.y - bY, 2, 0, 2 * Math.PI);
    birdContext.fill();

}

function update(time) {
    const elapsed = (time - previousRenderTime) * 0.001;
    const movement = rot(playerSpeed, cameraDirection);
    const speed = sprintOn ? SPEED_SPRINT : SPEED_WALK;
    playerPosition.x += -speed * movement.y * elapsed;
    playerPosition.y += speed * movement.x * elapsed;
    const [pcx, pcy] = getChunkCoords(playerPosition.x, playerPosition.y);
    const needed = new Set();
    for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
        for (let dy = -CHUNK_RADIUS; dy <= CHUNK_RADIUS; dy++) {
            const cx = pcx + dx, cy = pcy + dy;
            const key = `${cx},${cy}`;
            needed.add(key);
            if (!loadedChunks.has(key)) {
                loadedChunks.set(key, generateChunk(cx, cy));
            }
        }
    }
    for (const key of loadedChunks.keys()) {
        if (!needed.has(key)) {
            loadedChunks.delete(key);
        }
    }
    var allPolygons = svgPolygons == null ? [] : [...svgPolygons];
    for (const polygons of loadedChunks.values()) {
        allPolygons = allPolygons.concat(polygons);
    }
    drawFlatView(allPolygons);
    drawBirdView(allPolygons);
    requestAnimationFrame(update);
    previousRenderTime = time;
}

document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement === flatCanvas) {
        if (event.ctrlKey) {
            lightDirection = rot(lightDirection, event.movementX * CAMERA_SENSITIVITY);
        } else {
            cameraDirection = (cameraDirection + event.movementX * CAMERA_SENSITIVITY) % (2 * Math.PI);
        }
    }
});

document.addEventListener("wheel", (event) => {
    fov += (event.deltaY > 0 ? 1 : -1) * Math.PI / 9;
    toast(`FOV: ${(project(fov, -Math.PI, Math.PI, 0, 360) - 180).toFixed(0)}°`)
});

window.addEventListener("keydown", (event) => {
    if (event.key == "ArrowUp" || event.key == "z") {
        playerSpeed.y = -1;
    }
    if (event.key == "ArrowRight" || event.key == "d") {
        playerSpeed.x = 1;
    }
    if (event.key == "ArrowDown" || event.key == "s") {
        playerSpeed.y = 1;
    }
    if (event.key == "ArrowLeft" || event.key == "q") {
        playerSpeed.x = -1;
    }
    if (event.key == "Shift") {
        sprintOn = true;
    }
    if (event.key == "b") {
        birdCanvas.classList.toggle("hidden");
    }
    if (event.key == "h") {
        playerPosition = {x: 0, y: 0};
        playerSpeed    = {x: 0, y: 0};
        lightDirection = normalize({x: -1, y: 1});
        fov = Math.PI / 3;
        cameraDirection = Math.PI / 4;
        sprintOn = false;
    }
});

window.addEventListener("keyup", (event) => {
    if (event.key == "ArrowUp" || event.key == "ArrowDown" || event.key == "z" || event.key == "s") {
        playerSpeed.y = 0;
    }
    if (event.key == "ArrowRight" || event.key == "ArrowLeft" || event.key == "q" || event.key == "d") {
        playerSpeed.x = 0;
    }
    if (event.key == "Shift") {
        sprintOn = false;
    }
});

window.addEventListener("resize", setSize);

flatCanvas.addEventListener("click", () => {
    disclaimerBox.classList.add("hidden");
    flatCanvas.requestPointerLock();
});

(async () => {svgPolygons = await loadSvgWorldModel("world.svg");})();

setSize();
update(0);

const norm = u => Math.sqrt(u.x * u.x + u.y * u.y);
const dot = (u, v) => u.x * v.x + u.y * v.y;
const rot = (u, theta) => {return {x: u.x * Math.cos(theta) - u.y * Math.sin(theta), y: u.x * Math.sin(theta) + u.y * Math.cos(theta)};}
const normalize = (u) => {const n = norm(u); return {x: u.x / n, y: u.y / n};}
const project = (x, fromMin, fromMax, toMin, toMax) => (x - fromMin) / (fromMax - fromMin) * (toMax - toMin) + toMin;

const flatContext = flatCanvas.getContext("2d");
const birdContext = birdCanvas.getContext("2d");

const BIRD_SCALE = .15;
const CAMERA_SENSITIVITY = 0.004;  // radian per pixel
const SPEED_WALK   = 300;          // pixels per second
const SPEED_SPRINT = 800;          // pixels per second
var playerPosition = {x: 0, y: 0};
var playerSpeed    = {x: 0, y: 0};
var lightDirection = normalize({x: 1, y: 1});
var fov = Math.PI / 3;
var cameraDirection = Math.PI / 4;
var sprintOn = false;
var previousRenderTime = 0;
var width = window.innerWidth;
var height = window.innerHeight;
var toastTimeout = null;
var polygons = [];
var segments = [];

function addSegments(polygon) {
    polygons.push(polygon);
    for (let i = 0; i < polygon.points.length; i++) {
        const [x0, y0] = polygon.points[i];
        const [x1, y1] = polygon.points[(i + 1) % polygon.points.length];
        segments.push({
            x0: x0, y0: y0, x1: x1, y1: y1,
            color: polygon.color,
            normal: normalize(rot({x: x1 - x0, y: y1 - y0}, Math.PI / 2))
        });
    }
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

async function loadSvgWorldModel(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load SVG: ${response.status}`);
    }

    const text = await response.text();

    // Parse SVG text into a DOM
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, "image/svg+xml");

    // Collect all <path> elements
    const paths = svgDoc.querySelectorAll("path");

    const shapes = [];

    function extractFillColor(path) {
        const style = path.getAttribute("style");
        for (const part of style.split(";")) {
            const [key, value] = style.split(":");
            if (key == "fill") return value;
        }
    }

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
                points.push([curPoint.x, curPoint.y]);
                lastPoint = curPoint;
            }
        } catch (e) {
            console.warn("Could not parse path", d, e);
        }

        shapes.push({
            color: rgb,
            points: points
        });
    });

    return shapes;
}


function drawFlat() {
    const imageData = new ImageData(width, 1);
    for (let j = 0; j < width; j++) {
        const theta = cameraDirection - fov + j / width * 2 * fov;
        const a = Math.tan(theta);
        const b = playerPosition.y - a * playerPosition.x;
        let minDistance;
        let color = [255, 255, 255];
        let light = 1;
        for (const seg of segments) {
            let t = (a * seg.x0 + b - seg.y0) / (seg.y1 - seg.y0 - a * seg.x1 + a * seg.x0);
            if (t >= 0 && t <= 1) {
                const x2 = (1 - t) * seg.x0 + t * seg.x1;
                const y2 = (1 - t) * seg.y0 + t * seg.y1;
                const u = {x: Math.cos(theta), y: Math.sin(theta)};
                const v = {x: x2 - playerPosition.x, y: y2 - playerPosition.y};
                if (dot(u, v) < 0) {
                    continue;
                }
                const distance = norm({x: x2 - playerPosition.x, y: y2 - playerPosition.y});
                if (minDistance == undefined || distance < minDistance) {
                    minDistance = distance;
                    color = seg.color;
                    light = project(dot(seg.normal, lightDirection), -1, 1, .4, 1);
                }
            }
        }
        imageData.data[4*j + 0] = light * color[0];
        imageData.data[4*j + 1] = light * color[1];
        imageData.data[4*j + 2] = light * color[2];
        imageData.data[4*j + 3] = 255;
    }
    flatContext.putImageData(imageData, 0, 0);
}

function drawBird() {

    birdContext.fillStyle = "white";
    birdContext.fillRect(0, 0, BIRD_SCALE * width, BIRD_SCALE * height);

    for (const polygon of polygons) {
        const [r, g, b] = polygon.color;
        birdContext.fillStyle = `rgb(${r}, ${g}, ${b})`;
        birdContext.beginPath();
        [x0, y0] = polygon.points[polygon.points.length - 1];
        birdContext.moveTo(BIRD_SCALE * x0, BIRD_SCALE * y0)
        for (const [x, y] of polygon.points) {
            birdContext.lineTo(BIRD_SCALE * x, BIRD_SCALE * y);
        }
        birdContext.fill();
    }
    birdContext.fillStyle = "#ff000080";
    birdContext.beginPath();
    birdContext.moveTo(BIRD_SCALE * playerPosition.x, BIRD_SCALE * playerPosition.y);
    birdContext.lineTo(BIRD_SCALE * (playerPosition.x + 50 * Math.cos(cameraDirection - fov)), BIRD_SCALE * (playerPosition.y + 50 * Math.sin(cameraDirection - fov)));
    birdContext.arc(BIRD_SCALE * playerPosition.x, BIRD_SCALE * playerPosition.y, BIRD_SCALE * 50, cameraDirection - fov, cameraDirection + fov);
    birdContext.fill();

    birdContext.strokeStyle = "red";
    birdContext.beginPath();
    birdContext.moveTo(BIRD_SCALE * playerPosition.x, BIRD_SCALE * playerPosition.y);
    birdContext.lineTo(BIRD_SCALE * (playerPosition.x + 50 * Math.cos(cameraDirection - fov)), BIRD_SCALE * (playerPosition.y + 50 * Math.sin(cameraDirection - fov)));
    birdContext.stroke();

    birdContext.beginPath();
    birdContext.moveTo(BIRD_SCALE * playerPosition.x, BIRD_SCALE * playerPosition.y);
    birdContext.lineTo(BIRD_SCALE * (playerPosition.x + 50 * Math.cos(cameraDirection + fov)), BIRD_SCALE * (playerPosition.y + 50 * Math.sin(cameraDirection + fov)));
    birdContext.stroke();

    birdContext.fillStyle = "black";
    birdContext.beginPath();
    birdContext.arc(BIRD_SCALE * playerPosition.x, BIRD_SCALE * playerPosition.y, 2, 0, 2 * Math.PI);
    birdContext.fill();

}

function draw(time) {
    const elapsed = (time - previousRenderTime) * 0.001;
    const movement = rot(playerSpeed, cameraDirection);
    const speed = sprintOn ? SPEED_SPRINT : SPEED_WALK;
    playerPosition.x += -speed * movement.y * elapsed;
    playerPosition.y += speed * movement.x * elapsed;
    drawFlat();
    drawBird();
    requestAnimationFrame(draw);
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

flatCanvas.addEventListener("click", () => {flatCanvas.requestPointerLock();});

addSegments({points: [[270, 200], [400, 120], [350, 300]], color: [255, 0, 0]});
addSegments({points: [[640, 300], [690, 310], [700, 450], [600, 440]], color: [0, 255, 0]});
addSegments({points: [[1000, 600], [1010, 620], [1030, 600], [1040, 650], [1020, 700]], color: [0, 0, 255]});

loadSvgWorldModel("stars.svg").then((shapes) => {
    shapes.forEach(addSegments);
});

setSize();
draw(0);

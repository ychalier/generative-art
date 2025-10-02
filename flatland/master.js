const width   = window.innerWidth;
const height  = window.innerHeight;

const flatContext = flatCanvas.getContext("2d");
flatCanvas.width  = width;
flatCanvas.height = 1;

const birdContext = birdCanvas.getContext("2d");
birdCanvas.width  = width;
birdCanvas.height = .9 * height;

var player = {x: 300, y: 600};
var sight = 0;

var fov = Math.PI / 3;

const polygons = [
    {points: [[270, 200], [400, 120], [350, 300]], color: [255, 0, 0]},
    {points: [[640, 300], [690, 310], [700, 450], [600, 440]], color: [0, 255, 0]},
];

const segments = [];
for (const polygon of polygons) {
    for (let i = 0; i < polygon.points.length; i++) {
        const [x0, y0] = polygon.points[i];
        const [x1, y1] = polygon.points[(i + 1) % polygon.points.length];
        segments.push({x0: x0, y0: y0, x1: x1, y1: y1, color: polygon.color});
    }
}

const norm = u => Math.sqrt(u.x * u.x + u.y * u.y);
const dot = (u, v) => u.x * v.x + u.y * v.y;

function drawFlat() {
    const imageData = new ImageData(width, 1);
    for (let j = 0; j < width; j++) {
        const theta = sight - fov + j / width * 2 * fov;

        const a = Math.tan(theta);
        const b = player.y - a * player.x;

        let minDistance;
        let color = [0, 0, 0];
        for (const seg of segments) {
            let t = (a * seg.x0 + b - seg.y0) / (seg.y1 - seg.y0 - a * seg.x1 + a * seg.x0);
            if (t >= 0 && t <= 1) {
                const x2 = (1 - t) * seg.x0 + t * seg.x1;
                const y2 = (1 - t) * seg.y0 + t * seg.y1;
                const u = {x: Math.cos(theta), y: Math.sin(theta)};
                const v = {x: x2 - player.x, y: y2 - player.y};
                if (dot(u, v) < 0) {
                    continue;
                }
                const distance = norm({x: x2 - player.x, y: y2 - player.y});
                if (minDistance == undefined || distance < minDistance) {
                    minDistance = distance;
                    color = seg.color;
                }
            }
        }
        
        imageData.data[4*j + 0] = color[0];
        imageData.data[4*j + 1] = color[1];
        imageData.data[4*j + 2] = color[2];
        imageData.data[4*j + 3] = 255;
    }
    flatContext.putImageData(imageData, 0, 0);
}

function drawBird() {

    birdContext.clearRect(0, 0, width, height);

    for (const polygon of polygons) {
        const [r, g, b] = polygon.color;
        birdContext.fillStyle = `rgb(${r}, ${g}, ${b})`;
        birdContext.beginPath();
        [x0, y0] = polygon.points[polygon.points.length - 1];
        birdContext.moveTo(x0, y0)
        for (const [x, y] of polygon.points) {
            birdContext.lineTo(x, y);
        }
        birdContext.fill();
    }
    birdContext.fillStyle = "#ff000080";
    birdContext.beginPath();
    birdContext.moveTo(player.x, player.y);
    birdContext.lineTo(player.x + 50 * Math.cos(sight - fov), player.y + 50 * Math.sin(sight - fov));
    birdContext.arc(player.x, player.y, 50, sight - fov, sight + fov);
    birdContext.fill();

    birdContext.strokeStyle = "red";
    birdContext.beginPath();
    birdContext.moveTo(player.x, player.y);
    birdContext.lineTo(player.x + 50 * Math.cos(sight - fov), player.y + 50 * Math.sin(sight - fov));
    birdContext.stroke();

    birdContext.beginPath();
    birdContext.moveTo(player.x, player.y);
    birdContext.lineTo(player.x + 50 * Math.cos(sight + fov), player.y + 50 * Math.sin(sight + fov));
    birdContext.stroke();

    birdContext.fillStyle = "black";
    birdContext.beginPath();
    birdContext.arc(player.x, player.y, 2, 0, 2 * Math.PI);
    birdContext.fill();

}

function draw() {
    drawFlat();
    drawBird();
}

draw();

window.addEventListener("mousemove", (event) => {
    const dx = event.clientX - player.x;
    const dy = event.clientY - player.y;
    sight = Math.atan2(dy, dx);
    draw();
});

window.addEventListener("keydown", (event) => {
    const step = 10;
    if (event.key == "ArrowUp") {
        player.y -= step;
    } else if (event.key == "ArrowRight") {
        player.x += step;
    } else if (event.key == "ArrowDown") {
        player.y += step;
    } else if (event.key == "ArrowLeft") {
        player.x -= step;
    }
    draw();
});

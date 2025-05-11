const canvas = document.getElementById("canvas");

var width = window.innerWidth;
var height = window.innerHeight;

canvas.width = width;
canvas.height = height;

const gl = canvas.getContext("webgl2");

const vertexShader = gl.createShader(gl.VERTEX_SHADER);

gl.shaderSource(vertexShader, `attribute vec2 position; void main() {gl_Position = vec4(position, 0, 1);}`);
gl.compileShader(vertexShader);

const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

const shaderText = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_pan;
uniform float u_zoom;
uniform float u_rotation;

uniform float R;
uniform float C;

void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;
    uv -= u_pan;
    uv /= u_zoom;
    float c = cos(u_rotation);
    float s = sin(u_rotation);
    mat2 rot = mat2(c, -s, s, c);
    uv = rot * uv;
    uv -= vec2(0.5, 0.5);
    float f = pow(R, 2.0) / (pow(uv.x, 2.0) + pow(uv.y, 2.0));
    uv = floor(f * uv / C);
    float e = (uv.x + uv.y) / 2.0;
    gl_FragColor.xyz = vec3(2.0 * (e - floor(e)));
    gl_FragColor.w = 1.0;
}`;

gl.shaderSource(fragmentShader, shaderText);
gl.compileShader(fragmentShader);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

const rLocation = gl.getUniformLocation(program, "R");
const cLocation = gl.getUniformLocation(program, "C");
const scaleLocation = gl.getUniformLocation(program, "scale");

gl.useProgram(program);

gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

gl.viewport(0, 0, width, height);

const u_resolution = gl.getUniformLocation(program, "u_resolution");
const u_pan = gl.getUniformLocation(program, "u_pan");
const u_zoom = gl.getUniformLocation(program, "u_zoom");
const u_rotation = gl.getUniformLocation(program, "u_rotation");

let pan = { x: -0.5, y: -0.5 };
let zoom = 1.0;
let rotation = 0;

let isPanning = false;
let isRotating = false;
let lastMouse = { x: 0, y: 0 };

function render() {
    gl.viewport(0, 0, width, height);
    gl.uniform2f(u_resolution, width, height);
    gl.uniform2f(u_pan, pan.x, pan.y);
    gl.uniform1f(u_zoom, zoom);
    gl.uniform1f(u_rotation, rotation);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) isPanning = true;
    if (e.button === 2) isRotating = true;
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
});

canvas.addEventListener("mouseup", () => {
    isPanning = false;
    isRotating = false;
});

canvas.addEventListener("mousemove", (e) => {
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / canvas.width * 2 - 1;
    const y = 1 - (e.clientY - rect.top) / canvas.height * 2;
    const aspect = canvas.width / canvas.height;
    const uv = { x: x * aspect, y };
    if (isPanning) {
        pan.x += dx / canvas.height * 2;
        pan.y -= dy / canvas.height * 2;
        render();
    }
});

canvas.addEventListener("wheel", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / canvas.width * 2 - 1;
    const mouseY = 1 - (e.clientY - rect.top) / canvas.height * 2;
    const aspect = canvas.width / canvas.height;
    const uv = {
        x: mouseX * aspect,
        y: mouseY,
    };
    const worldBefore = {
        x: (uv.x - pan.x) / zoom,
        y: (uv.y - pan.y) / zoom,
    };
    const zoomDelta = 1 - e.deltaY * 0.001;
    zoom *= zoomDelta;
    pan.x = uv.x - worldBefore.x * zoom;
    pan.y = uv.y - worldBefore.y * zoom;
    render();
});

let lastTouchDist = null;
let lastTouchMid = null;

canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        lastMouse.x = e.touches[0].clientX;
        lastMouse.y = e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.hypot(dx, dy);

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        lastTouchMid = { x: midX, y: midY };
    }
});

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();

    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastMouse.x;
        const dy = touch.clientY - lastMouse.y;
        lastMouse.x = touch.clientX;
        lastMouse.y = touch.clientY;

        pan.x += dx / canvas.height * 2;
        pan.y -= dy / canvas.height * 2;
        render();
    }

    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / lastTouchDist;
        lastTouchDist = dist;

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = canvas.getBoundingClientRect();
        const x = (midX - rect.left) / canvas.width * 2 - 1;
        const y = 1 - (midY - rect.top) / canvas.height * 2;
        const aspect = canvas.width / canvas.height;
        const uv = { x: x * aspect, y };

        const worldX = (uv.x - pan.x) / zoom;
        const worldY = (uv.y - pan.y) / zoom;

        zoom *= scale;

        pan.x = uv.x - worldX * zoom;
        pan.y = uv.y - worldY * zoom;

        lastTouchMid = { x: midX, y: midY };
        render();
    }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
    if (e.touches.length === 1) {
        lastMouse.x = e.touches[0].clientX;
        lastMouse.y = e.touches[0].clientY;
    }
})

window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    render();
});

const parseEase = y => x => Math.pow(parseFloat(x), Math.log10(y) / Math.log10(0.5));
const formatEase = y => x => Math.pow(x, Math.log10(0.5) / Math.log10(y));

const p1 = parseEase(0.3);
document.getElementById("input-r").addEventListener("input", (event) => {
    gl.uniform1f(rLocation, p1(parseFloat(event.target.value)));
    render();
});

const p2 = parseEase(0.1);
document.getElementById("input-c").addEventListener("input", (event) => {
    gl.uniform1f(cLocation, p2(parseFloat(event.target.value)));
    render();
});

gl.uniform1f(rLocation, 0.3);
gl.uniform1f(cLocation, 0.1);

render();

var isAnimationOn = false;
const animateButton = document.getElementById("button-animate");
animateButton.addEventListener("click", () => {
    if (isAnimationOn) {
        isAnimationOn = false;
        animateButton.textContent = "Animer";
    } else {
        isAnimationOn = true;
        var timeStart = new Date();
        zoom = 1.0;
        pan.x = -0.5;
        pan.y = -0.5;
        function updateRender() {
            var elapsedSeconds = (new Date() - timeStart) / 1000;

            const mouseX = 0;
            const mouseY = 0;
            const aspect = canvas.width / canvas.height;
            const uv = {
                x: mouseX * aspect,
                y: mouseY,
            };
            const worldBefore = {
                x: (uv.x - pan.x) / zoom,
                y: (uv.y - pan.y) / zoom,
            };
            zoom += elapsedSeconds / 10;
            pan.x = uv.x - worldBefore.x * zoom;
            pan.y = uv.y - worldBefore.y * zoom;
            render();
            if (isAnimationOn) {
                requestAnimationFrame(updateRender);
            }
        }
        requestAnimationFrame(updateRender);
        animateButton.textContent = "Stop";
    }
});

document.getElementById("button-screen").addEventListener("click", (event) => {
    const link = document.createElement("a");
    const fileName = `space-inversion-${parseInt((new Date()) * 1)}.png`;
    link.setAttribute("download", fileName);
    link.href = canvas.toDataURL("image/png");
    link.click();
});

var cursorTimeout;
window.addEventListener("mousemove", () => {
    if (cursorTimeout != null) {
        clearTimeout(cursorTimeout);
    } else {
        document.body.classList.add("show-cursor");
    }
    cursorTimeout = setTimeout(() => {
        document.body.classList.remove("show-cursor");
        cursorTimeout = null;
    }, 500);
});

var focusedInputs = new Set();
function updateDashboardFocus() {
    if (focusedInputs.size == 0) {
        document.body.classList.remove("has-focused-inputs");
    } else {
        document.body.classList.add("has-focused-inputs");
    }
}
document.querySelectorAll("input,textarea").forEach(input => {
    input.addEventListener("focusin", (event) => {
        focusedInputs.add(input.name);
        updateDashboardFocus();
    });
    input.addEventListener("focusout", (event) => {
        focusedInputs.delete(input.name)
        updateDashboardFocus();
    });
});
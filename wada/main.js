const canvas = document.getElementById("canvas");

var width = window.innerWidth;
var height = window.innerHeight;

canvas.width = width;
canvas.height = height;

const gl = canvas.getContext("webgl2", {preserveDrawingBuffer: true});

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

uniform int rounds;
uniform int root;
uniform vec3 color0;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;
uniform vec3 color5;
uniform vec3 color6;
uniform vec3 color7;
uniform vec3 color8;
uniform vec3 color9;
const int MAX_ITERS = 1000;

const float PI = 3.141592653589793;
const float TWOPI = 2.0 * PI;

vec2 c_mul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 c_div(vec2 a, vec2 b) {
    float denom = b.x * b.x + b.y * b.y;
    return vec2(
        (a.x * b.x + a.y * b.y) / denom,
        (a.y * b.x - a.x * b.y) / denom
    );
}

void main() {
    float rootf = float(root);
    vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;
    uv -= u_pan;
    uv /= u_zoom;
    float c = cos(u_rotation);
    float s = sin(u_rotation);
    mat2 rot = mat2(c, -s, s, c);
    uv = rot * uv;
    uv -= vec2(0.5, 0.5);
    vec2 z = vec2(uv.x, uv.y);
    for (int i = 0; i < MAX_ITERS; i++) {
        if (i >= rounds) break;
        vec2 zpow = z;
        for (int i = 2; i < MAX_ITERS; i++) {
            if (i >= root) break;
            zpow = c_mul(zpow, z);
        }
        z = z - c_div(c_mul(zpow, z) - vec2(2.0, 0.0), rootf * zpow);
    }
    float theta = atan(z.y, z.x);
    if (theta < 0.0) theta += TWOPI;
    theta = theta + PI / rootf;
    if (theta > TWOPI) theta -= TWOPI;
    theta = theta * rootf / TWOPI;
    int color = int(floor(theta));
    if (color == 0) {
        gl_FragColor.xyz = color0;
    } else if (color == 1) {
        gl_FragColor.xyz = color1;
    } else if (color == 2) {
        gl_FragColor.xyz = color2;
    } else if (color == 3) {
        gl_FragColor.xyz = color3;
    } else if (color == 4) {
        gl_FragColor.xyz = color4;
    } else if (color == 5) {
        gl_FragColor.xyz = color5;
    } else if (color == 6) {
        gl_FragColor.xyz = color6;
    } else if (color == 7) {
        gl_FragColor.xyz = color7;
    } else if (color == 8) {
        gl_FragColor.xyz = color8;
    } else {
        gl_FragColor.xyz = color9;
    }
    gl_FragColor.w = 1.0;
}`;

gl.shaderSource(fragmentShader, shaderText);
gl.compileShader(fragmentShader);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

const NUM_COLORS = 8;

const scaleLocation = gl.getUniformLocation(program, "scale");
const roundsLocation = gl.getUniformLocation(program, "rounds");
const rootLocation = gl.getUniformLocation(program, "root");
const colorLocations = [];
for (let i = 0; i < NUM_COLORS; i++) {
    colorLocations.push(gl.getUniformLocation(program, `color${i}`));
}

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

document.getElementById("input-rounds").addEventListener("input", (event) => {
    gl.uniform1i(roundsLocation, parseInt(event.target.value));
    render();
});

document.getElementById("input-root").addEventListener("input", (event) => {
    gl.uniform1i(rootLocation, parseInt(event.target.value));
    render();
});

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
    ];
}


for (let i = 0; i < NUM_COLORS; i++) {
    const input = document.getElementById(`input-color${i}`);
    gl.uniform3f(colorLocations[i], ...hexToRgb(input.value));
    input.addEventListener("input", (event) => {
        gl.uniform3f(colorLocations[i], ...hexToRgb(event.target.value));
        render();
    });
}

gl.uniform1i(roundsLocation, 50);
gl.uniform1i(rootLocation, 3);

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
    const fileName = `wada-${parseInt((new Date()) * 1)}.png`;
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
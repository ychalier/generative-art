const SPEEDS = [0.2, 0.5, 0.8, 0.9, 0.99, 0.999];
const gl = canvas.getContext("webgl2", {preserveDrawingBuffer: true});
var speedIndex = 1;
var previousTime = 0;
var pastBuffer;
var nextBuffer;

function createEmptyArray(arrayWidth, arrayHeight) {
    const array = [];
    for (let k = 0; k < arrayWidth * arrayHeight * 4; k++) {
        array.push(255);
    }
    return new Uint8Array(array);
}

function createShader(shaderType, shaderText) {
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderText);
    gl.compileShader(shader);
    return shader;
}

function createProgram(vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    return program;
}

function initializeTexture(texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
}

function initializeBuffer() {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

function bindTexture(program, varName, textureUnit, texture) {
    gl.uniform1i(gl.getUniformLocation(program, varName), textureUnit);
    gl.activeTexture(gl.TEXTURE0 + textureUnit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
}

const vertexShader = createShader(gl.VERTEX_SHADER, `
attribute vec2 position;
varying vec2 uv;
void main() {
    uv = (position * 0.5) + 0.5;
    gl_Position = vec4(position, 0, 1);
}
`);

const simulationShader = createShader(gl.FRAGMENT_SHADER, `
precision highp float;

uniform sampler2D sampler;
varying vec2 uv;

uniform float u_time;
uniform float u_dt;
uniform float u_speed;
uniform float u_width;
uniform float u_height;
uniform float u_temp;
uniform float u_pot;

const float lifeSpan = 3.0; // seconds

float rand(vec2 coords) {
    return fract(sin(dot(coords.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float spinat(float dx, float dy) {
    vec2 coords = uv + vec2(dx, dy) / vec2(u_width, u_height);
    vec4 color = texture2D(sampler, coords);
    return color.w > 0.5 ? 1.0 : -1.0;
}

void main() {
    float spin_neighbors = spinat(1.0, 0.0) + spinat(-1.0, 0.0) + spinat(0.0, 1.0) + spinat(0.0, -1.0);
    float spin_center = spinat(0.0, 0.0);
    float energy = 2.0 * spin_center * (spin_neighbors + u_pot);
    float p = exp(-energy / u_temp);
    float r1 = rand(uv + u_time + 0.0);
    float r2 = rand(uv + u_time + 1.0);
    if (r1 > u_speed && (energy < 0.0 || r2 < p)) {
        spin_center *= -1.0;
    }
    gl_FragColor.x = spin_center < 0.0 ? 0.0 : min(1.0, texture2D(sampler, uv).x + u_dt / lifeSpan);
    gl_FragColor.w = floor((spin_center + 1.0) / 2.0);
}`
);

const copyShader = createShader(gl.FRAGMENT_SHADER, `
precision highp float;

uniform sampler2D sampler;
varying vec2 uv;

void main() {
    gl_FragColor = texture2D(sampler, uv);
}
`);

const colorShader = createShader(gl.FRAGMENT_SHADER, `
precision highp float;

uniform sampler2D sampler;
varying vec2 uv;

const vec3 youngColor = vec3(0.812, 0.941, 0.063);
const vec3 oldColor   = vec3(0.063, 0.937, 0.451);
const vec3 bgColor    = vec3(0.063, 0.063, 0.063);

void main() {
    vec4 color = texture2D(sampler, uv);
    gl_FragColor.xyz = color.w > 0.5 ? mix(youngColor, oldColor, color.x) : bgColor;
    gl_FragColor.w = 1.0;
}
`);

const simulationProgram = createProgram(vertexShader, simulationShader);
const copyProgram = createProgram(vertexShader, copyShader);
const colorProgram = createProgram(vertexShader, colorShader);

const uTemperature = gl.getUniformLocation(simulationProgram, "u_temp");
const uChemicalPotential = gl.getUniformLocation(simulationProgram, "u_pot");
const uWidth = gl.getUniformLocation(simulationProgram, "u_width");
const uHeight = gl.getUniformLocation(simulationProgram, "u_height");
const uTime = gl.getUniformLocation(simulationProgram, "u_time");
const uDt = gl.getUniformLocation(simulationProgram, "u_dt");
const uSpeed = gl.getUniformLocation(simulationProgram, "u_speed");

function updateParameters(x, y) {
    let T = Math.pow(10, x * 2 - 1);
    let C = 4 * (y - .5);
    if (Math.abs(C) < 0.2) {
        C = 0;
    } else if (C > 0) {
        C -= 0.2;
    } else {
        C += 0.2;
    }
    gl.useProgram(simulationProgram);
    gl.uniform1f(uTemperature, T);
    gl.uniform1f(uChemicalPotential, C);
}

window.addEventListener("mousemove", (event) => {
    updateParameters(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
});

window.addEventListener("touchstart", (event) => {
    const touches = event.changedTouches;
    if (touches.length > 0) {
        updateParameters(touches[0].pageX / window.innerWidth, touches[0].pageY / window.innerHeight);
    }
});

window.addEventListener("touchmove", (event) => {
    const touches = event.changedTouches;
    if (touches.length > 0) {
        updateParameters(touches[0].pageX / window.innerWidth, touches[0].pageY / window.innerHeight);
    }
});

window.addEventListener("wheel", (event) => {
    if (event.deltaY > 0) {
        speedIndex++;
    } else {
        speedIndex--;
    }
    speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, speedIndex));
    gl.useProgram(simulationProgram);
    gl.uniform1f(uSpeed, SPEEDS[speedIndex]);
});

function setup() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    const pastTexture = gl.createTexture();
    initializeTexture(pastTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, createEmptyArray(width, height));
    pastBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, pastBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pastTexture, 0);

    const nextTexture = gl.createTexture();
    initializeTexture(nextTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, createEmptyArray(width, height));
    nextBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, nextBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, nextTexture, 0);

    gl.useProgram(simulationProgram);
    initializeBuffer();
    bindTexture(simulationProgram, "sampler", 0, pastTexture);
    gl.uniform1f(uWidth, width);
    gl.uniform1f(uHeight, height);
    gl.uniform1f(uSpeed, SPEEDS[speedIndex]);
    updateParameters(0.5, 0.5);

    gl.useProgram(copyProgram);
    initializeBuffer();
    bindTexture(copyProgram, "sampler", 1, nextTexture);

    gl.useProgram(colorProgram);
    initializeBuffer();
    bindTexture(colorProgram, "sampler", 1, nextTexture);

    gl.viewport(0, 0, width, height);
}

function render(time) {
    gl.useProgram(simulationProgram);
    gl.uniform1f(uTime, time * 0.001);
    gl.uniform1f(uDt, (time - previousTime) * 0.001);
    gl.bindFramebuffer(gl.FRAMEBUFFER, nextBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(copyProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pastBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(colorProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    previousTime = time;
    requestAnimationFrame(render);
}

window.addEventListener("resize", setup);

function screenshot() {
    const link = document.createElement("a");
    const fileName = `liquid-vapor-${parseInt((new Date()) * 1)}.png`;
    link.setAttribute("download", fileName);
    link.href = canvas.toDataURL("image/png");
    link.click();
}

var isRecording = false;
var recordedChunks = [];
var mediaRecorder = null;

function startRecording() {
    if (isRecording) return;
    recordIcon.classList.remove("hidden");
    isRecording = true;
    recordedChunks = [];
    return new Promise(function (res, rej) {
        var stream = canvas.captureStream(30);
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: "video/webm;codecs:vp9",
            videoBitsPerSecond: 20000000
        });
        mediaRecorder.start(4000);
        mediaRecorder.ondataavailable = function (event) {
            recordedChunks.push(event.data);
        }
        mediaRecorder.onstop = function (event) {
            var blob = new Blob(recordedChunks, {type: "video/webm" });
            var a = document.createElement("a");
            a.setAttribute("download", `liquid-vapor-${parseInt((new Date()) * 1)}.webm`);
            a.href = URL.createObjectURL(blob);
            a.click();
        }
    });
}

function stopRecording() {
    if (!isRecording) return;
    recordIcon.classList.add("hidden");
    isRecording = false;
    mediaRecorder.stop();
}

window.addEventListener("keydown", (event) => {
    if (event.key == "s") {
        screenshot();
    } else if (event.key == "r") {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    }
});

setup();
render();

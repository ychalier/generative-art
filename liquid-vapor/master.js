var width = window.innerWidth;
var height = window.innerHeight;
var T = 0.5;
var C = 0;
var imageData = new ImageData(width, height);
var context;
var alpha = .8;
var N = 0;
var noise = 1 / width / height;

canvas.width = width;
canvas.height = height;

const gl = canvas.getContext("webgl2", {preserveDrawingBuffer: true});

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
}`);

const simulationShader = createShader(gl.FRAGMENT_SHADER, `
precision highp float;

uniform sampler2D sampler;
varying vec2 uv;

uniform float u_time;
uniform float u_dt;
uniform float u_speed;
uniform float width;
uniform float height;
uniform float T;
uniform float C;

float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(132.9898, 478.233))) * 43758.5453);
}

float spinAt(vec2 offset) {
    vec2 coords = uv + offset / vec2(width, height);
    vec4 color = texture2D(sampler, coords);
    return color.w > 0.5 ? 1.0 : -1.0;
}

void main() {
    float S = spinAt(vec2(0.9, 0.0)) + spinAt(vec2(-0.9, 0.0)) + spinAt(vec2(0.0, 0.9)) + spinAt(vec2(0.0, -0.9));
    float spinXY = spinAt(vec2(0.0, 0.0));
    float deltaE = 2.0 * spinXY * (S + C);
    float proba = exp(-deltaE / T);
    float r1 = rand(uv + u_time + 0.0);
    float r2 = rand(uv + u_time + 1.0);
    if (r1 > u_speed && (deltaE < 0.0 || r2 < proba)) {
        spinXY *= -1.0;
    }
    if (spinXY < 0.0) {
        gl_FragColor.x = 0.0;
    } else {
        float oldX = texture2D(sampler, uv).x;
        gl_FragColor.x = oldX + u_dt / 3.0;
    }
    gl_FragColor.w = floor((spinXY + 1.0) / 2.0);
}`);

const copyShader = createShader(gl.FRAGMENT_SHADER, `
precision highp float;
uniform sampler2D sampler;
varying vec2 uv;
void main() {
    gl_FragColor = texture2D(sampler, uv);
}`);

const colorShader = createShader(gl.FRAGMENT_SHADER, `
precision highp float;
uniform sampler2D sampler;
varying vec2 uv;
void main() {
    vec4 color = texture2D(sampler, uv);
    float age = color.x;
    float alpha = color.w;
    if (alpha > 0.5) {
        vec3 startColor = vec3(0.812, 0.941, 0.063);
        vec3 endColor = vec3(0.063, 0.937, 0.451);
        gl_FragColor = vec4(mix(startColor, endColor, age), 1.0);
    } else {
        gl_FragColor = vec4(0.063, 0.063, 0.063, 1.0);
    }
}`);

const simulationProgram = createProgram(vertexShader, simulationShader);
const copyProgram = createProgram(vertexShader, copyShader);
const colorProgram = createProgram(vertexShader, colorShader);

const tLocation = gl.getUniformLocation(simulationProgram, "T");
const cLocation = gl.getUniformLocation(simulationProgram, "C");
const wLocation = gl.getUniformLocation(simulationProgram, "width");
const hLocation = gl.getUniformLocation(simulationProgram, "height");
const uTime = gl.getUniformLocation(simulationProgram, "u_time");
const uDt = gl.getUniformLocation(simulationProgram, "u_dt");
const uSpeed = gl.getUniformLocation(simulationProgram, "u_speed");

const pastTexture = gl.createTexture();
initializeTexture(pastTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, createEmptyArray(width, height));
const pastBuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, pastBuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pastTexture, 0);

const nextTexture = gl.createTexture();
initializeTexture(nextTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, createEmptyArray(width, height));
const nextBuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, nextBuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, nextTexture, 0);

gl.useProgram(simulationProgram);
initializeBuffer();
bindTexture(simulationProgram, "sampler", 0, pastTexture);

gl.useProgram(copyProgram);
initializeBuffer();
bindTexture(copyProgram, "sampler", 1, nextTexture);

gl.useProgram(colorProgram);
initializeBuffer();
bindTexture(colorProgram, "sampler", 1, nextTexture);

gl.useProgram(simulationProgram);
gl.uniform1f(tLocation, 1);
gl.uniform1f(cLocation, 0);
window.addEventListener("mousemove", (event) => {
    T = Math.pow(10, event.clientX / window.innerWidth * 2 - 1);
    C = 4 * (event.clientY / window.innerHeight - .5);
    if (Math.abs(C) < 0.2) {
        C = 0;
    } else if (C > 0) {
        C -= 0.2;
    } else {
        C += 0.2;
    }
    gl.useProgram(simulationProgram);
    gl.uniform1f(tLocation, T);
    gl.uniform1f(cLocation, C);
});

const speeds = [0.2, 0.5, 0.8, 0.9, 0.99, 0.999];
var speed = 2;
gl.useProgram(simulationProgram);
gl.uniform1f(uSpeed, speeds[speed]);
window.addEventListener("wheel", (event) => {
    if (event.deltaY > 0) {
        speed++;
    } else {
        speed--;
    }
    speed = Math.max(0, Math.min(speeds.length - 1, speed));
    gl.useProgram(simulationProgram);
    gl.uniform1f(uSpeed, speeds[speed]);
});

var oldTime = 0;
function render(time) {

    gl.useProgram(simulationProgram);
    gl.uniform1f(wLocation, width);
    gl.uniform1f(hLocation, height);
    gl.uniform1f(uTime, time * 0.001);
    gl.uniform1f(uDt, (time - oldTime) * 0.001);
    gl.viewport(0, 0, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, nextBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(copyProgram);
    gl.viewport(0, 0, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pastBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(colorProgram);
    gl.viewport(0, 0, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    oldTime = time;

    requestAnimationFrame(render);

}

render();

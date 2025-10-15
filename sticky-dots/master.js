// master.js
// GPU particle simulation (WebGL2). Positions & velocities stored in float textures.
// Luminance is read from the <video> element's texture to influence acceleration.


let TEX_SIZE = 512; // 512*512 = 1,048,576 particles
const MAX_TEX_SIZE = 2048;
const TARGET_POINT_SIZE = 1.0; // px

var BASE_ACCEL = 0.1;
var HEAT = 1.0;
const VELOCITY_DAMP = 0.995;
const SPEED_LIMIT = 0.3;

const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
if (!gl) {
    alert("WebGL2 required");
    throw new Error("WebGL2 not supported");
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const extCBF = gl.getExtension("EXT_color_buffer_float");
const extFloatLinear = gl.getExtension("OES_texture_float_linear");
if (!extCBF) {
    alert("EXT_color_buffer_float required for float FBOs");
    throw new Error("Missing EXT_color_buffer_float");
}

function compileShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const err = gl.getShaderInfoLog(s);
        console.error(src);
        throw new Error("Shader compile error: " + err);
    }
    return s;
}

function createProgram(vsSrc, fsSrc) {
    const p = gl.createProgram();
    const vs = compileShader(vsSrc, gl.VERTEX_SHADER);
    const fs = compileShader(fsSrc, gl.FRAGMENT_SHADER);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error("Program link error: " + gl.getProgramInfoLog(p));
    }
    return p;
}

function createFloatTexture(w, h, data = null, filter = gl.NEAREST) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
}

function createUInt8Texture(w, h, data = null, filter = gl.LINEAR) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
}

function createFBOWithTexture(tex) {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Framebuffer incomplete: " + status);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fbo;
}

const fsQuadVerts = new Float32Array([-1, -1, 0, 0, 3, -1, 2, 0, -1,  3, 0, 2]);
const quadVBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
gl.bufferData(gl.ARRAY_BUFFER, fsQuadVerts, gl.STATIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER, null);

const quadVS = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const velUpdateFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_posTex;
uniform sampler2D u_velTex;
uniform sampler2D u_lumTex;
uniform sampler2D u_targetTex;
uniform float u_dt;
uniform float u_baseAccel;
uniform float u_damp;
uniform float u_speedLimit;
uniform float u_heat;

vec2 posToUV(vec2 p) {
    return p * 0.5 + 0.5;
}

void main() {
    vec4 p = texture(u_posTex, v_uv);
    vec2 pos = p.xy;
    vec2 vel = texture(u_velTex, v_uv).xy;

    vec2 lumUV = posToUV(pos);
    vec3 col = texture(u_lumTex, clamp(lumUV, 0.0, 1.0)).rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114)); // clamp((col.x + col.y + col.z) / 3.0, 0.0, 1.0);

    vec2 target = texture(u_targetTex, v_uv).xy;

    vec2 dir = normalize(target - pos + vec2(1e-6));
    vec2 accel = dir * u_baseAccel;
    vel += accel * u_dt;
    vel *= 1.0 - u_heat * lum;
    vel *= pow(u_damp, u_dt * 60.0);

    float speed = length(vel);
    if (speed > u_speedLimit) {
        vel = vel / speed * u_speedLimit;
    }

    outColor = vec4(vel, 0.0, 1.0);
}`;

// Position update fragment shader:
// reads posTex, velTex -> writes new positions
const posUpdateFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_posTex;
uniform sampler2D u_velTex;
uniform float u_dt;

void main() {
    vec2 pos = texture(u_posTex, v_uv).xy;
    vec2 vel = texture(u_velTex, v_uv).xy;

    pos += vel * u_dt;

    // wrap around - keep positions in [-1,1]
    if (pos.x < -1.0) pos.x += 2.0;
    if (pos.x >  1.0) pos.x -= 2.0;
    if (pos.y < -1.0) pos.y += 2.0;
    if (pos.y >  1.0) pos.y -= 2.0;

    outColor = vec4(pos, 0.0, 1.0);
}`;

const targetUpdateFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_posTex;
uniform sampler2D u_targetTex;
uniform float u_dt;
uniform float u_seed;

float rand(vec2 coords) {
    return fract(sin(dot(coords.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec4 pos = texture(u_posTex, v_uv);
    vec4 target = texture(u_targetTex, v_uv);
    float distance = distance(pos, target);
    if (distance < 0.01) {
        target.xy = vec2(2.0 * rand(v_uv + u_seed) - 1.0, 2.0 * rand(v_uv + u_seed + 1.0) - 1.0);
    }
    outColor = target;
}`;

// Render particles vertex shader: each vertex carries its particle UV, samples posTex
const renderVS = `#version 300 es
precision highp float;
in vec2 a_uv;
uniform sampler2D u_posTex;
uniform float u_pointSize;
uniform mat4 u_projection; // not used (we output clip-space directly)
void main() {
    vec2 pos = texture(u_posTex, a_uv).xy;
    // pos is in [-1,1] -> clip space directly
    gl_Position = vec4(pos, 0.0, 1.0);
    gl_PointSize = u_pointSize;
}`;

// Render fragment shader: white pixel dots
const renderFS = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
    outColor = vec4(1.0); // white
}`;

// compile programs
const velProgram = createProgram(quadVS, velUpdateFS);
const posProgram = createProgram(quadVS, posUpdateFS);
const targetProgram = createProgram(quadVS, targetUpdateFS);
const renderProgram = createProgram(renderVS, renderFS);

// attribute locations for quad
const quad_pos_loc = gl.getAttribLocation(velProgram, 'a_pos');
const quad_uv_loc = gl.getAttribLocation(velProgram, 'a_uv');

// utilities to set up attribute for quad on a program
function enableQuadAttribs(program) {
    const posLoc = gl.getAttribLocation(program, 'a_pos');
    const uvLoc = gl.getAttribLocation(program, 'a_uv');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    // a_pos (first two floats)
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    // a_uv (next two floats)
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
}
function disableQuadAttribs(program) {
    const posLoc = gl.getAttribLocation(program, 'a_pos');
    const uvLoc = gl.getAttribLocation(program, 'a_uv');
    gl.disableVertexAttribArray(posLoc);
    gl.disableVertexAttribArray(uvLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

// --- Particle data initialization (pos & vel textures) ---
function initParticleTextures(texSize) {
    const count = texSize * texSize;
    const posData = new Float32Array(count * 4);
    const velData = new Float32Array(count * 4);
    const targetData = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
        // initialize positions in [-1,1]
        posData[i * 4 + 0] = (Math.random() * 2.0 - 1.0) * 0.98;
        posData[i * 4 + 1] = (Math.random() * 2.0 - 1.0) * 0.98;
        posData[i * 4 + 2] = 0.0;
        posData[i * 4 + 3] = 1.0;

        // small random velocities
        velData[i * 4 + 0] = (Math.random() * 2.0 - 1.0) * 0.01;
        velData[i * 4 + 1] = (Math.random() * 2.0 - 1.0) * 0.01;
        velData[i * 4 + 2] = 0.0;
        velData[i * 4 + 3] = 1.0;

        // initialize targets in [-1,1]
        targetData[i * 4 + 0] = (Math.random() * 2.0 - 1.0) * 0.98;
        targetData[i * 4 + 1] = (Math.random() * 2.0 - 1.0) * 0.98;
        targetData[i * 4 + 2] = 0.0;
        targetData[i * 4 + 3] = 1.0;
    }

    // create two textures for ping-ponging
    const posTexA = createFloatTexture(texSize, texSize, posData, gl.NEAREST);
    const posTexB = createFloatTexture(texSize, texSize, posData, gl.NEAREST);
    const velTexA = createFloatTexture(texSize, texSize, velData, gl.NEAREST);
    const velTexB = createFloatTexture(texSize, texSize, velData, gl.NEAREST);
    const targetTexA = createFloatTexture(texSize, texSize, targetData, gl.NEAREST);
    const targetTexB = createFloatTexture(texSize, texSize, targetData, gl.NEAREST);

    const fboPosA = createFBOWithTexture(posTexA);
    const fboPosB = createFBOWithTexture(posTexB);
    const fboVelA = createFBOWithTexture(velTexA);
    const fboVelB = createFBOWithTexture(velTexB);
    const fboTargetA = createFBOWithTexture(targetTexA);
    const fboTargetB = createFBOWithTexture(targetTexB);

    return {
        posTexA, posTexB, velTexA, velTexB, targetTexA, targetTexB,
        fboPosA, fboPosB, fboVelA, fboVelB, fboTargetA, fboTargetB
    };
}

// --- Create UV buffer for particle rendering ---
function createParticleUVBuffer(texSize) {
    const count = texSize * texSize;
    const uvs = new Float32Array(count * 2);
    let ptr = 0;
    for (let y = 0; y < texSize; y++) {
        for (let x = 0; x < texSize; x++) {
        // use center of texel as UV to avoid exact edges
        uvs[ptr++] = (x + 0.5) / texSize;
        uvs[ptr++] = (y + 0.5) / texSize;
        }
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return { buf, count };
}

// Setup initial textures
let state = initParticleTextures(TEX_SIZE);
let particleUV = createParticleUVBuffer(TEX_SIZE);

// video texture (luminance map)
let videoTexture = createUInt8Texture(2, 2, null, gl.LINEAR); // placeholder tiny texture

// function to update video texture each frame (if playing)
function updateVideoTexture() {
if (video.readyState >= 2) {
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    // flipY to correct orientation if needed
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch (e) {
    // texImage2D with video can throw if cross-origin or not allowed
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}
}

// file input handler to load local video file into <video> element
videoForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (videoInput.files && videoInput.files[0]) {
        disclaimerBox.classList.add("hidden");
        setTimeout(() => {
            const file = videoInput.files[0];
            const url = URL.createObjectURL(file);
            video.src = url;
            video.addEventListener("canplay", () => {
                requestAnimationFrame(frame);
            });
            video.play().catch(() => {});
        }, 500);
    }
});

// Allow drag-drop of video files onto page
window.addEventListener('dragover', (e) => { e.preventDefault(); });
window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            video.src = url;
            video.play().catch(() => {});
        }
    }
});

// Utility: bind texture unit with name
function bindTexUnit(tex, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
}

// --- Simulation loop ---
let lastTime = performance.now();
let posSrc = state.posTexA;
let posDst = state.posTexB;
let velSrc = state.velTexA;
let velDst = state.velTexB;
let targetSrc = state.targetTexA;
let targetDst = state.targetTexB;
let fboPosSrc = state.fboPosA;
let fboPosDst = state.fboPosB;
let fboVelSrc = state.fboVelA;
let fboVelDst = state.fboVelB;
let fboTargetSrc = state.fboTargetA;
let fboTargetDst = state.fboTargetB;

// swap helper
function swap() {
    [posSrc, posDst] = [posDst, posSrc];
    [velSrc, velDst] = [velDst, velSrc];
    [targetSrc, targetDst] = [targetDst, targetSrc];
    [fboPosSrc, fboPosDst] = [fboPosDst, fboPosSrc];
    [fboVelSrc, fboVelDst] = [fboVelDst, fboVelSrc];
    [fboTargetSrc, fboTargetDst] = [fboTargetDst, fboTargetSrc];
}

// Render state
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// Particle render attribute locations
const render_a_uv = gl.getAttribLocation(renderProgram, 'a_uv');

// Setup attribute once for particle rendering
function enableParticleAttribs() {
    gl.bindBuffer(gl.ARRAY_BUFFER, particleUV.buf);
    gl.enableVertexAttribArray(render_a_uv);
    gl.vertexAttribPointer(render_a_uv, 2, gl.FLOAT, false, 8, 0);
// Vertex attrib divisor is 0 (one vertex per particle), not instanced
}

// Main frame

const timeStart = new Date();
function frame() {
    const now = performance.now();
    let dt = (now - lastTime) / 1000.0;
    lastTime = now;
    // clamp dt
    if (dt > 0.05) dt = 0.05;

    // update video texture
    updateVideoTexture();

    // --- 1) update velocity pass: write into velDst ---
    gl.useProgram(velProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboVelDst);
    gl.viewport(0, 0, TEX_SIZE, TEX_SIZE);

    enableQuadAttribs(velProgram);

    // bind inputs
    bindTexUnit(posSrc, 0);
    bindTexUnit(velSrc, 1);
    bindTexUnit(videoTexture, 2);
    bindTexUnit(targetSrc, 3);

    gl.uniform1i(gl.getUniformLocation(velProgram, 'u_posTex'), 0);
    gl.uniform1i(gl.getUniformLocation(velProgram, 'u_velTex'), 1);
    gl.uniform1i(gl.getUniformLocation(velProgram, 'u_lumTex'), 2);
    gl.uniform1i(gl.getUniformLocation(velProgram, 'u_targetTex'), 3);
    gl.uniform1f(gl.getUniformLocation(velProgram, 'u_dt'), dt);
    gl.uniform1f(gl.getUniformLocation(velProgram, 'u_baseAccel'), BASE_ACCEL);
    gl.uniform1f(gl.getUniformLocation(velProgram, 'u_heat'), HEAT);
    gl.uniform1f(gl.getUniformLocation(velProgram, 'u_damp'), VELOCITY_DAMP);
    gl.uniform1f(gl.getUniformLocation(velProgram, 'u_speedLimit'), SPEED_LIMIT);

    // draw quad (3 vertices triangle trick)
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    disableQuadAttribs(velProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // --- 2) update position pass: write into posDst ---
    gl.useProgram(posProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboPosDst);
    gl.viewport(0, 0, TEX_SIZE, TEX_SIZE);

    enableQuadAttribs(posProgram);

    bindTexUnit(posSrc, 0);
    bindTexUnit(velDst, 1);

    gl.uniform1i(gl.getUniformLocation(posProgram, 'u_posTex'), 0);
    gl.uniform1i(gl.getUniformLocation(posProgram, 'u_velTex'), 1);
    gl.uniform1f(gl.getUniformLocation(posProgram, 'u_dt'), dt);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    disableQuadAttribs(posProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // --- 2.1) update targets 
    gl.useProgram(targetProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboTargetDst);
    gl.viewport(0, 0, TEX_SIZE, TEX_SIZE);

    enableQuadAttribs(targetProgram);

    bindTexUnit(posDst, 0);
    bindTexUnit(targetSrc, 1);

    gl.uniform1i(gl.getUniformLocation(targetProgram, 'u_posTex'), 0);
    gl.uniform1i(gl.getUniformLocation(targetProgram, 'u_targetTex'), 1);
    gl.uniform1f(gl.getUniformLocation(targetProgram, 'u_dt'), dt);
    gl.uniform1f(gl.getUniformLocation(targetProgram, 'u_seed'), Math.random());

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    disableQuadAttribs(targetProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // swap ping-pong textures (now posDst & velDst become sources)
    swap();

    // --- 3) render particles to screen ---
    gl.useProgram(renderProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // clear to black
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    bindTexUnit(posSrc, 0);
    
    gl.uniform1i(gl.getUniformLocation(renderProgram, 'u_posTex'), 0);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'u_pointSize'), TARGET_POINT_SIZE);

    enableParticleAttribs();
    // draw as points: number of vertices = texSize*texSize
    //gl.drawArrays(gl.POINTS, 0, particleUV.count);

    const tMs = (new Date() - timeStart);
    const introductionDurationMs = 60 * 1000;

    gl.drawArrays(gl.POINTS, 0, Math.min(particleUV.count, Math.exp(tMs * Math.log(particleUV.count) / introductionDurationMs)));

    // cleanup
    gl.disableVertexAttribArray(render_a_uv);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    requestAnimationFrame(frame);
}

// Start loop


// --- Utility to change particle count at runtime if needed ---
// For convenience, pressing keys + and - will upscale/downscale texture size
window.addEventListener('keydown', (e) => {
if (e.key === '+' || e.key === '=') {
    const newSize = Math.min(TEX_SIZE * 2, MAX_TEX_SIZE);
    if (newSize !== TEX_SIZE) {
    console.log('Increasing texture to', newSize);
    TEX_SIZE = newSize;
    state = initParticleTextures(TEX_SIZE);
    particleUV = createParticleUVBuffer(TEX_SIZE);
    // reset ping-pong pointers
    posSrc = state.posTexA; posDst = state.posTexB;
    velSrc = state.velTexA; velDst = state.velTexB;
    fboPosSrc = state.fboPosA; fboPosDst = state.fboPosB;
    fboVelSrc = state.fboVelA; fboVelDst = state.fboVelB;
    }
} else if (e.key === '-' || e.key === '_') {
    const newSize = Math.max(64, TEX_SIZE / 2);
    if (newSize !== TEX_SIZE) {
    console.log('Decreasing texture to', newSize);
    TEX_SIZE = newSize;
    state = initParticleTextures(TEX_SIZE);
    particleUV = createParticleUVBuffer(TEX_SIZE);
    posSrc = state.posTexA; posDst = state.posTexB;
    velSrc = state.velTexA; velDst = state.velTexB;
    fboPosSrc = state.fboPosA; fboPosDst = state.fboPosB;
    fboVelSrc = state.fboVelA; fboVelDst = state.fboVelB;
    }
}
});

function updateParameters(x, y) {
    BASE_ACCEL = x/2;
    HEAT = 0.0006 * Math.exp(Math.exp(y + 1));
    //console.log("BASE_ACCEL", BASE_ACCEL, "HEAT", HEAT);
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

canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

// --- Start with a couple helpful console logs ---
console.log('Particle sim started. TEX_SIZE:', TEX_SIZE, 'particles:', TEX_SIZE*TEX_SIZE);
console.log('Drop a video file onto the page or use the input to load a video. Press + / - to change texture size.');


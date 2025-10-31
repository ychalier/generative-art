const TEX_SIZE = 512;

var heat = 1.0; // mouseY
var coloration = 0; // mouseWheel
var speedLimit = 0.3; // mouseX
var warmup = false;

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
gl.getExtension("OES_texture_float_linear");
gl.getExtension("EXT_float_blend");
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
    float lum = dot(col, vec3(0.299, 0.587, 0.114));

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

const renderVS = `#version 300 es
precision highp float;
in vec2 a_uv;
out vec2 v_uv;
uniform sampler2D u_posTex;
uniform float u_pointSize;
uniform mat4 u_projection;
void main() {
    vec2 pos = texture(u_posTex, a_uv).xy;
    gl_Position = vec4(pos, 0.0, 1.0);
    gl_PointSize = u_pointSize;
    v_uv = (pos + 1.0) / 2.0;
}`;

const renderFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_lumTex;
uniform float u_alpha;
void main() {
    vec3 col = texture(u_lumTex, v_uv).rgb;
    float lum = 1.0 - u_alpha + u_alpha * dot(col, vec3(0.299, 0.587, 0.114));
    outColor = vec4(lum, lum, lum, 1.0);
}`;

const velProgram = createProgram(quadVS, velUpdateFS);
const posProgram = createProgram(quadVS, posUpdateFS);
const targetProgram = createProgram(quadVS, targetUpdateFS);
const renderProgram = createProgram(renderVS, renderFS);

const quad_pos_loc = gl.getAttribLocation(velProgram, "a_pos");
const quad_uv_loc = gl.getAttribLocation(velProgram, "a_uv");

function enableQuadAttribs(program) {
    const posLoc = gl.getAttribLocation(program, "a_pos");
    const uvLoc = gl.getAttribLocation(program, "a_uv");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
}

function disableQuadAttribs(program) {
    const posLoc = gl.getAttribLocation(program, "a_pos");
    const uvLoc = gl.getAttribLocation(program, "a_uv");
    gl.disableVertexAttribArray(posLoc);
    gl.disableVertexAttribArray(uvLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function initParticleTextures(texSize) {
    const count = texSize * texSize;
    const posData = new Float32Array(count * 4);
    const velData = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
        posData[i * 4 + 0] = (Math.random() * 2.0 - 1.0) * 0.98;
        posData[i * 4 + 1] = (Math.random() * 2.0 - 1.0) * 0.98;
        posData[i * 4 + 2] = 0.0;
        posData[i * 4 + 3] = 1.0;
        velData[i * 4 + 0] = (Math.random() * 2.0 - 1.0) * 0.01;
        velData[i * 4 + 1] = (Math.random() * 2.0 - 1.0) * 0.01;
        velData[i * 4 + 2] = 0.0;
        velData[i * 4 + 3] = 1.0;
    }

    const posTexA = createFloatTexture(texSize, texSize, posData, gl.NEAREST);
    const posTexB = createFloatTexture(texSize, texSize, posData, gl.NEAREST);
    const velTexA = createFloatTexture(texSize, texSize, velData, gl.NEAREST);
    const velTexB = createFloatTexture(texSize, texSize, velData, gl.NEAREST);
    const targetTexA = createFloatTexture(texSize, texSize, posData, gl.NEAREST);
    const targetTexB = createFloatTexture(texSize, texSize, posData, gl.NEAREST);

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

function createParticleUVBuffer(texSize) {
    const count = texSize * texSize;
    const uvs = new Float32Array(count * 2);
    let ptr = 0;
    for (let y = 0; y < texSize; y++) {
        for (let x = 0; x < texSize; x++) {
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

let state = initParticleTextures(TEX_SIZE);
let particleUV = createParticleUVBuffer(TEX_SIZE);
let videoTexture = createUInt8Texture(2, 2, null, gl.LINEAR);

function updateVideoTexture() {
    if (video.readyState >= 2) {
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        } catch (e) {
            //pass
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
}

videoInput.addEventListener("input", async () => {
    const file = videoInput.files[0];
    if (!file) return;
    videoInputLabel.textContent = file.name;
});

videoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (videoInput.files && videoInput.files[0]) {
        disclaimerBox.classList.add("hidden");
        setTimeout(() => {
            const file = videoInput.files[0];
            const url = URL.createObjectURL(file);
            video.src = url;
            warmup = true;
            video.addEventListener("canplay", () => {
                requestAnimationFrame(frame);
            });
            video.addEventListener("play", () => {
                timeStart = new Date();
            });
            setTimeout(() => {
                warmup = false;
                video.play().catch(() => {});
            }, parseInt(warmupDurationInput.value));
        }, 500);
    }
});

function bindTexUnit(tex, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
}

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

function swap() {
    [posSrc, posDst] = [posDst, posSrc];
    [velSrc, velDst] = [velDst, velSrc];
    [targetSrc, targetDst] = [targetDst, targetSrc];
    [fboPosSrc, fboPosDst] = [fboPosDst, fboPosSrc];
    [fboVelSrc, fboVelDst] = [fboVelDst, fboVelSrc];
    [fboTargetSrc, fboTargetDst] = [fboTargetDst, fboTargetSrc];
}

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

const render_a_uv = gl.getAttribLocation(renderProgram, 'a_uv');

function enableParticleAttribs() {
    gl.bindBuffer(gl.ARRAY_BUFFER, particleUV.buf);
    gl.enableVertexAttribArray(render_a_uv);
    gl.vertexAttribPointer(render_a_uv, 2, gl.FLOAT, false, 8, 0);
}

var timeStart = null;
function frame() {
    const now = performance.now();
    let dt = (now - lastTime) / 1000.0;
    lastTime = now;
    if (dt > 0.05) dt = 0.05;

    if (!warmup) {
        updateVideoTexture();
    }

    gl.useProgram(velProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboVelDst);
    gl.viewport(0, 0, TEX_SIZE, TEX_SIZE);
    enableQuadAttribs(velProgram);
    bindTexUnit(posSrc, 0);
    bindTexUnit(velSrc, 1);
    bindTexUnit(videoTexture, 2);
    bindTexUnit(targetSrc, 3);

    const now2 = new Date();

    gl.uniform1i(gl.getUniformLocation(velProgram, 'u_posTex'), 0);
    gl.uniform1i(gl.getUniformLocation(velProgram, 'u_velTex'), 1);
    gl.uniform1i(gl.getUniformLocation(velProgram, 'u_lumTex'), 2);
    gl.uniform1i(gl.getUniformLocation(velProgram, 'u_targetTex'), 3);
    gl.uniform1f(gl.getUniformLocation(velProgram, 'u_dt'), dt);
    gl.uniform1f(gl.getUniformLocation(velProgram, 'u_baseAccel'), parseFloat(baseAccelerationInput.value));
    gl.uniform1f(gl.getUniformLocation(velProgram, 'u_heat'), heat);
    gl.uniform1f(gl.getUniformLocation(velProgram, 'u_damp'), parseFloat(velocityDampInput.value));
    gl.uniform1f(gl.getUniformLocation(velProgram, 'u_speedLimit'), speedLimit);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    disableQuadAttribs(velProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

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

    swap();

    gl.useProgram(renderProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    bindTexUnit(posSrc, 0);
    bindTexUnit(videoTexture, 1);
    gl.uniform1i(gl.getUniformLocation(renderProgram, 'u_posTex'), 0);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'u_pointSize'), parseInt(pointSizeInput.value));
    gl.uniform1i(gl.getUniformLocation(renderProgram, 'u_lumTex'), 1);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'u_alpha'), coloration);
    enableParticleAttribs();
    
    let particlesToShow = 0;
    const startDuration = parseFloat(startDurationInput.value);
    if (startDuration == 0) {
        particlesToShow = particleUV.count;
    } else if (timeStart != null) {
        const tMs = (new Date() - timeStart);
        particlesToShow = Math.min(1, Math.pow(tMs / startDuration, 4)) * particleUV.count;
    }
    
    gl.drawArrays(gl.POINTS, 0, Math.min(particleUV.count, particlesToShow));
    gl.disableVertexAttribArray(render_a_uv);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    requestAnimationFrame(frame);
}

function updateParameters(x, y) {
    speedLimit = 0.01 + x * 0.5
    heat = 0.0006 * Math.exp(Math.exp(y + 1));
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
        coloration += 0.1;
    } else {
        coloration -= 0.1;
    }
    coloration = Math.min(1, Math.max(0, coloration));
});

canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

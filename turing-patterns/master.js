const width = window.innerWidth;
const height = window.innerHeight;

const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;

var params = {
    iterations: 10,
    sharpeningAmount: 1.0,
    blurIterations: 2,
}

var canRender = false;

const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
if (!gl) {
    alert("WebGL2 required");
    throw new Error("WebGL2 not supported");
}

gl.viewport(0, 0, canvas.width, canvas.height);

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

function createUInt8Texture(width, height, data = null, filter = gl.LINEAR) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
}

function createFBOWithTexture(tex) {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, width, height);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Framebuffer incomplete: " + status);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fbo;
}

const quadVS = `#version 300 es
precision highp float;

in vec2 a_pos;
in vec2 a_uv;

out vec2 v_uv;

void main() {
    v_uv = (a_uv + 1.0) / 2.0;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const copyFS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_texture;

void main() {
    outColor = texture(u_texture, v_uv);
}
`;

const blurFS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_texture;
uniform vec2 u_texel;

vec3 colorAt(vec2 offset) {
    vec4 color = texture(u_texture, v_uv + offset * u_texel);
    return color.rgb;
}

void main() {
    float a = 1.0 / 9.0;
    vec3 result = colorAt(vec2(0.0, 0.0)) * a
        + colorAt(vec2( 1.0,  0.0)) * a
        + colorAt(vec2(-1.0,  0.0)) * a
        + colorAt(vec2( 0.0,  1.0)) * a
        + colorAt(vec2 (0.0, -1.0)) * a
        + colorAt(vec2(-1.0, -1.0)) * a
        + colorAt(vec2(-1.0,  1.0)) * a
        + colorAt(vec2( 1.0,  1.0)) * a
        + colorAt(vec2 (1.0, -1.0)) * a;
    outColor = vec4(result, 1.0);
}
`;

const sharpenFS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_texture;
uniform vec2  u_texel;
uniform float u_amount;

vec3 colorAt(vec2 offset) {
    vec4 color = texture(u_texture, v_uv + offset * u_texel);
    return color.rgb;
}

void main() {
    float neighbor = u_amount * -1.0;
    float center   = u_amount *  4.0 + 1.0;
    vec3 result = colorAt(vec2(0.0, 0.0)) * center
        + colorAt(vec2( 1.0,  0.0)) * neighbor
        + colorAt(vec2(-1.0,  0.0)) * neighbor
        + colorAt(vec2( 0.0,  1.0)) * neighbor
        + colorAt(vec2 (0.0, -1.0)) * neighbor;
    outColor = vec4(result, 1.0);
}
`;

const fsQuadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
const quadVBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
gl.bufferData(gl.ARRAY_BUFFER, fsQuadVerts, gl.STATIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER, null);

const copyProgram = createProgram(quadVS, copyFS);
enableQuadAttribs(copyProgram);
const blurProgram = createProgram(quadVS, blurFS);
enableQuadAttribs(blurProgram);
const sharpenProgram = createProgram(quadVS, sharpenFS);
enableQuadAttribs(sharpenProgram);

const initialData = new Uint8Array(width * height * 4);
for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
        const k = (i * width + j) * 4;
        initialData[k + 0] = Math.floor(256 * j / width);
        initialData[k + 1] = Math.floor(256 * i / height);
        initialData[k + 2] = 0;
        initialData[k + 3] = 255;
    }
}

const texBase = createUInt8Texture(width, height, initialData);
const texA = createUInt8Texture(width, height, initialData);
const texB = createUInt8Texture(width, height, initialData);
const fboA = createFBOWithTexture(texA);
const fboB = createFBOWithTexture(texB);

function enableQuadAttribs(program) {
    gl.useProgram(program)
    const posLoc = gl.getAttribLocation(program, "a_pos");
    const uvLoc = gl.getAttribLocation(program, "a_uv");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
}

function bindTexUnit(tex, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
}

let texSrc = texA;
let fboSrc = fboA;
let texDst = texB;
let fboDst = fboB;

function swap() {
    [texSrc, texDst] = [texDst, texSrc];
    [fboSrc, fboDst] = [fboDst, fboSrc];
}

function disableQuadAttribs(program) {
    const posLoc = gl.getAttribLocation(program, "a_pos");
    const uvLoc = gl.getAttribLocation(program, "a_uv");
    gl.disableVertexAttribArray(posLoc);
    gl.disableVertexAttribArray(uvLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function renderFrame() {
    canRender = false;
    console.log("Rendering frame");

    gl.bindTexture(gl.TEXTURE_2D, texBase);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageTag);
    gl.useProgram(copyProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboDst);
    bindTexUnit(texBase, 0);
    gl.uniform1i(gl.getUniformLocation(copyProgram, "u_texture"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    for (let i = 0; i < params.iterations; i++) {

        for (let k = 0; k < params.blurIterations; k++) {
            swap();
            gl.useProgram(blurProgram);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fboDst);
            bindTexUnit(texSrc, 0);
            gl.uniform1i(gl.getUniformLocation(blurProgram, "u_texture"), 0);
            gl.uniform2f(gl.getUniformLocation(blurProgram, "u_texel"), 1 / width, 1 / height);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        swap();
        gl.useProgram(sharpenProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboDst);
        bindTexUnit(texSrc, 0);
        gl.uniform1i(gl.getUniformLocation(sharpenProgram, "u_texture"), 0);
        gl.uniform2f(gl.getUniformLocation(sharpenProgram, "u_texel"), 1 / width, 1 / height);
        gl.uniform1f(gl.getUniformLocation(sharpenProgram, "u_amount"), params.sharpeningAmount);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

    }

    gl.useProgram(copyProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    bindTexUnit(texDst, 0);
    gl.uniform1i(gl.getUniformLocation(copyProgram, "u_texture"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    canRender = true;

}

mediaInput.addEventListener("input", async () => {
    const file = mediaInput.files[0];
    if (!file) return;
    mediaInputLabel.textContent = file.name;
});

mediaForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (mediaInput.files && mediaInput.files[0]) {
        disclaimerBox.classList.add("hidden");
        setTimeout(() => {
            const file = mediaInput.files[0];
            const url = URL.createObjectURL(file);            
            imageTag.addEventListener("load", () => {
                console.log("Image loaded");
                renderFrame();
            });
            imageTag.src = url;
        }, 500);
    }
});

function updateParameters(x, y) {
    params.iterations = Math.floor(x * 500);
    params.sharpeningAmount = 3 * y;
    if (canRender) renderFrame();
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
        params.blurIterations++;
    } else {
        params.blurIterations--;
    }
    params.blurIterations = Math.max(0, params.blurIterations);
    if (canRender) renderFrame();
});

function takeSnapshot() {
    const link = document.createElement("a");
    const fileName = `turing-patterns-${parseInt((new Date()) * 1)}.png`;
    link.setAttribute("download", fileName);
    link.href = canvas.toDataURL("image/png");
    link.click();
}

window.addEventListener("keydown", (event) => {
    if (event.key == "s") {
        takeSnapshot();
    }
});

canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

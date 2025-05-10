const canvas = document.getElementById("canvas");

var width = window.innerWidth;
var height = window.innerHeight;

canvas.width = width;
canvas.height = height;

const gl = canvas.getContext("webgl2", { "preserveDrawingBuffer": true });

const vertexShader = gl.createShader(gl.VERTEX_SHADER);

gl.shaderSource(vertexShader, [
    "attribute vec2 position;",
    "varying vec2 uv;",
    "void main() {",
    "uv = (position * 0.5) + 0.5;",
    "gl_Position = vec4(position, 0, 1);",
    "}",
].join("\n"));

gl.compileShader(vertexShader);

const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

const shaderText = `
precision highp float;

varying vec2 uv;

uniform float width;
uniform float height;
uniform float R;
uniform float C;
uniform float scale;

void main() {
    vec2 xy0 = (uv - vec2(0.5, 0.5)) / scale;
    float f = pow(R, 2.0) / (pow(xy0.x, 2.0) + pow(xy0.y, 2.0));
    vec2 cxy = floor(f * xy0 / C);
    float e = (cxy.x + cxy.y) / 2.0;
    float color = 2.0 * (e - floor(e));
    gl_FragColor.xyz = vec3(color);
    gl_FragColor.w = 1.0;
}
`;

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

function render() {
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

const parseEase = y => x => Math.pow(parseFloat(x), Math.log10(y) / Math.log10(0.5));
const formatEase = y => x => Math.pow(x, Math.log10(0.5) / Math.log10(y));


const p1 = parseEase(0.5);
document.getElementById("input-r").addEventListener("input", (event) => {
    gl.uniform1f(rLocation, p1(parseFloat(event.target.value)));
    render();
});

const p2 = parseEase(0.1);
document.getElementById("input-c").addEventListener("input", (event) => {
    gl.uniform1f(cLocation, p2(parseFloat(event.target.value)));
    render();
});

var scale = 0.1;
const ZOOM_FACTOR = 1.1;

gl.uniform1f(rLocation, 0.5);
gl.uniform1f(cLocation, 0.1);
gl.uniform1f(scaleLocation, scale);

document.addEventListener("wheel", (event) => {
    if (event.deltaY > 0) {
        scale /= ZOOM_FACTOR;
    } else {
        scale *= ZOOM_FACTOR;
    }
    gl.uniform1f(scaleLocation, scale);
    render();
});

window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    render();
});

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
        function updateRender() {
            var elapsedSeconds = (new Date() - timeStart) / 1000;
            gl.uniform1f(scaleLocation, 0.1 + elapsedSeconds / 10);
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
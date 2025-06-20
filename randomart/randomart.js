const presets = {
    basic: {
        depth: 12,
        grammarText: "A :: triple(B,B,B):1\nB :: Z:1 | sin(B):1 | cos(B):1 | exp(B):1 | sqrt(B):1 | tan(B):1 | sum(B,B):1 | mult(B,B):1| mix(B,B,B):1\nZ :: x:1 | y:1 | rgb:1",
    },
    all: {
        depth: 12,
        grammarText: "A :: triple(B,B,B):1\nB :: Z:1 | sin(B):1 | cos(B):1 | tan(B):1 | exp(B):1 | sqrt(B):1 | sum(B,B):1 | mult(B,B):1 | mod(B,B):1 | mix(B,B,B):1 | level(B,B,B):1\nZ :: x:1 | y:1 | rgb:1 | bw:1",
    },
    waves: {
        depth: 12,
        grammarText: "A :: triple(B,B,B):1\nB :: Z:1 | sin(B,2):6 | sum(B,B):1 | mult(B,B):1 | mix(B,B,B):1\nZ :: x:2 | y:2 | rgb:1 | bw:1",
    },
    gradients: {
        depth: 5,
        grammarText: "A :: triple(B,B,B):1\nB :: Z:1 | mix(B,B,B):2\nZ :: x:1 | y:1 | rgb:1"
    },
    animated: {
        depth: 12,
        grammarText: "A :: triple(B,B,B):1\nB :: Z:1 | sin(B):1 | cos(B):1 | exp(B):1 | sqrt(B):1 | tan(B):1 | sum(B,B):1 | mult(B,B):1| mix(B,B,B):1\nZ :: x:1 | y:1 | rgb:1 | t:1",
    },
    audio: {
        depth: 12,
        grammarText: "A :: triple(B,B,B):1\nB :: Z:1 | sin(B):1 | cos(B):1 | exp(B):1 | sqrt(B):1 | tan(B):1 | sum(B,B):1 | mult(B,B):1| mix(B,B,B):1\nZ :: x:1 | y:1 | rgb:1 | low:1 | mid:1 | hi:1"
    },
    audioDetailed: {
        depth: 12,
        grammarText: "A :: triple(B,B,B):1\nB :: Z:1 | sin(B):1 | cos(B):1 | exp(B):1 | sqrt(B):1 | tan(B):1 | sum(B,B):1 | mult(B,B):1| mix(B,B,B):1\nZ :: x:1 | y:1 | rgb:1 | subbass:1 | bass:1 | lowmidrange:1 | midrange:1 | uppermidrange:1 | presence:1 | brilliance:1"
    }
};

var defaultSeed = (Math.random()*2**32)>>>0;
var defaultPreset = "basic";
var defaultDepth = presets[defaultPreset].depth;
var defaultGrammarText = presets[defaultPreset].grammarText;

const storageString = localStorage.getItem("randomart");
if (storageString != null) {
    const storage = JSON.parse(storageString);
    defaultSeed = storage.seed;
    defaultDepth = storage.depth;
    defaultGrammarText = storage.grammarText;
}

const params = new URLSearchParams(window.location.search);
var seed = (params.has("seed") && params.get("seed").trim() != "") ? parseInt(params.get("seed")) : defaultSeed;
var depth = params.has("depth") ? parseInt(params.get("depth")) : defaultDepth;
var grammarText = params.has("grammar") ? params.get("grammar") : defaultGrammarText;
const exprText = params.has("expr") ? params.get("expr") : undefined;

document.querySelector("input[name=depth]").value = depth;
document.querySelector("input[name=seed]").value = seed;
document.querySelector("textarea[name=grammar]").value = grammarText;
toggleAudioContainer();

function toggleAudioContainer() {
    const currentGrammarText = document.querySelector("textarea[name=grammar]").value;
    const audioContainer = document.getElementById("audio");
    let includesAudioVariable = false;
    for (const varname of ["low", "mid", "hi", "subbass", "bass", "lowmidrange", "midrange", "uppermidrange", "presence", "brilliance"]) {
        if (currentGrammarText.includes(varname + ":")) {
            includesAudioVariable = true;
            break;
        }
    }
    if (includesAudioVariable) {
        audioContainer.classList.remove("hidden");
    } else {
        audioContainer.classList.add("hidden");
    }
}

function loadPreset(presetName) {
    const preset = presets[presetName];
    document.querySelector("input[name=depth]").value = preset.depth;
    document.querySelector("textarea[name=grammar]").value = preset.grammarText;
    toggleAudioContainer();
}

var exprString;
var shaderString;
var blob;

function getSelectedOption(select) {
    for (const option of select.querySelectorAll("option")) {
        if (option.selected) {
            return option.value;
        }
    }
    return null;
}

function showToast(event, message) {
    const toast = document.body.appendChild(document.createElement("div"));
    toast.className = "toast";
    toast.textContent = message;
    toast.style.top = event.clientY + "px";
    toast.style.left = event.clientX + "px";
    const onMouseMove = (e) => {
        toast.style.top = e.clientY + "px";
        toast.style.left = e.clientX + "px";
    }
    window.addEventListener("mousemove", onMouseMove);
    setTimeout(() => {
        window.removeEventListener("mousemove", onMouseMove);
        document.body.removeChild(toast);
    }, 700);
}

document.getElementById("button-download").addEventListener("click", event => {
    const link = document.createElement("a");
    const filename = `randomart-${parseInt((new Date()) * 1)}.png`
    link.setAttribute("download", filename);
    link.href = URL.createObjectURL(blob);
    link.click();
    showToast(event, `downloaded as ${filename}`);
});

document.getElementById("button-shader").addEventListener("click", event => {
    const link = document.createElement("a");
    const filename = `randomart-${parseInt((new Date()) * 1)}.frag`;
    link.setAttribute("download", filename);
    const blob = new Blob([shaderString], {type: "text/plain"});
    link.href = URL.createObjectURL(blob);
    link.click();
    showToast(event, `downloaded as ${filename}`);
});

var worker;

function createWorker() {
    worker = new Worker("worker.js");
    worker.onmessage = event => {
        switch(event.data.type) {
            case "expr":
                exprString = event.data.expr;
                shaderString = event.data.shader;
                break;
            case "progress":
                const progress = document.getElementById("progress");
                progress.value = event.data.current;
                progress.max = event.data.total;
                progress.style.display = event.data.current >= event.data.total ? "none": "unset";
                document.getElementById("elapsed").textContent = `${event.data.elapsed.toFixed(1)}s`;
                document.getElementById("size").textContent = `${event.data.width}×${event.data.height}`;
                blob = event.data.blob;
                if (event.data.current < event.data.total) {
                    worker.postMessage({type: "next"});
                }
                break;
        }
    };
    worker.onerror = event => {
        alert(event.message);
    }
}

function startWorker(useExprText) {
    const domCanvas = document.createElement("canvas");
    domCanvas.setAttribute("id", "canvas");
    document.getElementById("canvas").replaceWith(domCanvas);
    const canvas = document.getElementById("canvas").transferControlToOffscreen();
    const args = {
        canvas: canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        depth: depth,
        seed: seed,
        grammarText: grammarText,
        type: "start",
        renderGl: document.querySelector("input[name=gpu]").checked,
    };

    const params = new URLSearchParams();
    params.set("depth", depth);
    params.set("seed", seed);
    params.set("grammar", grammarText);
    const url = window.location.origin + window.location.pathname + "?" + params.toString();
    document.getElementById("button-share").href = url;

    if (useExprText) {
        args.exprText = exprText;
    }
    localStorage.setItem("randomart", JSON.stringify({
        seed: seed,
        depth: depth,
        grammarText: grammarText
    }));
    worker.postMessage(args, [canvas]);
}

createWorker();
startWorker(true);

document.getElementById("button-generate").addEventListener("click", event => {
    depth = parseInt(document.querySelector("input[name=depth]").value);
    grammarText = document.querySelector("textarea[name=grammar]").value.trim();
    toggleAudioContainer();
    seed = (Math.random()*2**32)>>>0;
    document.querySelector("input[name=seed]").value = seed;
    worker.terminate();
    createWorker();
    startWorker(false);
    showToast(event, "started generation");
});

document.getElementById("button-render").addEventListener("click", event => {
    depth = parseInt(document.querySelector("input[name=depth]").value);
    grammarText = document.querySelector("textarea[name=grammar]").value.trim();
    toggleAudioContainer();
    seed = parseInt(document.querySelector("input[name=seed]").value);
    worker.terminate();
    createWorker();
    startWorker(false);
    showToast(event, "started rendering");
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

const audioFileInput = document.getElementById("audioFileInput");
const audioElement = document.getElementById("audioElement");
const fftCanvas = document.getElementById("fftCanvas");
const fftCtx = fftCanvas.getContext("2d");

let audioContext;
let audioAnalyser;
let audioSourceNode;
let audioDataArray;
let audioBufferLength;
let audioAnimationId;

audioFileInput.addEventListener("change", async () => {
    const file = audioFileInput.files[0];
    if (!file) return;
    const objectURL = URL.createObjectURL(file);
    audioElement.src = objectURL;
    audioElement.load();
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 2048;
        audioBufferLength = audioAnalyser.frequencyBinCount;
        audioDataArray = new Uint8Array(audioBufferLength);

        audioSourceNode = audioContext.createMediaElementSource(audioElement);
        audioSourceNode.connect(audioAnalyser);
        audioAnalyser.connect(audioContext.destination);
    }
});

audioElement.addEventListener("play", () => {
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
    drawFft();
});

audioElement.addEventListener("pause", () => {
    cancelAnimationFrame(audioAnimationId);
});

function drawFft() {
    const fftCanvasBounds = fftCanvas.getBoundingClientRect();
    fftCanvas.width = fftCanvasBounds.width;
    fftCanvas.height = 32;

    const binsVars = {
        low: {min: 0, max: 250},
        mid: {min: 250, max: 4000},
        hi: {min: 4000, max: 20000},
        subbass: {min: 0, max: 60},
        bass: {min: 60, max: 250},
        lowmidrange: {min: 250, max: 500},
        midrange: {min: 500, max: 2000},
        uppermidrange: {min: 2000, max: 4000},
        presence: {min: 4000, max: 6000},
        brilliance: {min: 6000, max: 20000},
    }

    for (const varname in binsVars) {
        binsVars[varname].total = 0;
        binsVars[varname].count = 0;
        binsVars[varname].currentMax = 0;
        binsVars[varname].value = 0;
    }

    audioAnimationId = requestAnimationFrame(drawFft);

    audioAnalyser.getByteFrequencyData(audioDataArray);

    const normalizedData = Array.from(audioDataArray, val => val / 255);
    const sampleRate = audioContext.sampleRate;
    for (let i = 0; i < audioBufferLength; i++) {
        const frequency = i * sampleRate / audioAnalyser.fftSize;
        for (const varname in binsVars) {
            if (frequency >= binsVars[varname].min && frequency < binsVars[varname].max) {
                binsVars[varname].total += normalizedData[i];
                binsVars[varname].count++;
                binsVars[varname].currentMax = Math.max(binsVars[varname].currentMax, normalizedData[i]);
            }
        }
    }

    const audioAggMethod = getSelectedOption(document.getElementById("audioAggSelect"));
    switch(audioAggMethod) {
        case "max":
            for (const varname in binsVars) {
                if (binsVars[varname].count > 0) {
                    binsVars[varname].value = binsVars[varname].total / binsVars[varname].count;
                }
            }
            break;
        case "average":
            for (const varname in binsVars) {
                binsVars[varname].value = binsVars[varname].currentMax;
            }
            break;
        default:
            console.warn("Unkown audio agg method:", audioAggMethod);
            break;
    }    

    fftCtx.clearRect(0, 0, fftCanvas.width, fftCanvas.height);
    const barWidth = 2 * fftCanvas.width / audioBufferLength;

    normalizedData.forEach((value, i) => {
        const barHeight = value * fftCanvas.height;
        fftCtx.fillStyle = `hsl(${value * 360}, 100%, 50%)`;
        fftCtx.fillRect(i * barWidth, fftCanvas.height - barHeight, barWidth, barHeight);
    });

    worker.postMessage({
        type: "audio",
        vars: {
            low: binsVars.low.value,
            mid: binsVars.mid.value,
            hi: binsVars.hi.value,
            subbass: binsVars.subbass.value,
            bass: binsVars.bass.value,
            lowmidrange: binsVars.lowmidrange.value,
            midrange: binsVars.midrange.value,
            uppermidrange: binsVars.uppermidrange.value,
            presence: binsVars.presence.value,
            brilliance: binsVars.brilliance.value,
        }
    });

}
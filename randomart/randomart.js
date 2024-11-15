const presets = {
    test: {
        depth: 4,
        grammarText: "E :: triple(C, C, C):1\nC :: sin(C):1 | exp(C):1 | A:1\nA :: rgb:1 | x:1 | y:1",
    },
    default: {
        depth: 12,
        grammarText: "E :: triple(C, C, C):1\nC :: sum(C, C):1 | mult(C, C):1 | A:1 | mix(C, C, C):1 | sin(C):2 | cos(C):2 | exp(C):1 | sqrt(C):1 | tan(C):1 | mod(C, C):1\nA :: bw:1 | rgb:1 | x:1 | y:1",
    },
    all: {
        depth: 12,
        grammarText: "E :: triple(C, C, C):1\nC :: sum(C, C):1 | mult(C, C):1 | A:1 | mix(C, C, C):1 | mod(C, C):1 | sin(C):1 | cos(C):1 | exp(C):1 | sqrt(C):1 | tan(C):1 | level(C, C, C):1\nA :: bw:1 | rgb:1 | x:1 | y:1",
    },
    waves: {
        depth: 12,
        grammarText: "E :: triple(C, C, C):1\nC :: sum(C, C):1 | mult(C, C):1| A:1 | mix(C, C, C):1 | sin(C):6\nA :: bw:2 | rgb:1 | x:2 | y:2",
    },
    gradients: {
        depth: 5,
        grammarText: "E :: triple(C, C, C):1\nC :: sum(C, C):3 | mult(C, C):3 | A:2 | mix(C, C, C):3\nA :: rgb:1 | x:1 | y:1"
    },
};

var defaultSeed = (Math.random()*2**32)>>>0;
var defaultPreset = "default";
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

function loadPreset(presetName) {
    const preset = presets[presetName];
    document.querySelector("input[name=depth]").value = preset.depth;
    document.querySelector("textarea[name=grammar]").value = preset.grammarText;
}

var exprString;
var shaderString;
var blob;

document.getElementById("button-copy").addEventListener("click", event => {
    navigator.clipboard.writeText(exprString == undefined ? "" : exprString);
    showToast(event, "expression copied to clipboard");
});

document.getElementById("button-source").addEventListener("click", event => {
    const params = new URLSearchParams();
    params.set("depth", depth);
    params.set("seed", seed);
    params.set("grammar", grammarText);
    navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?" + params.toString());
    showToast(event, "link copied to clipboard");
});

document.getElementById("button-share").addEventListener("click", event => {
    const params = new URLSearchParams();
    params.set("expr", exprString);
    navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?" + params.toString());
    showToast(event, "link copied to clipboard");
});

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
                progress.style.display = event.data.current == event.data.total ? "none": "unset";
                document.getElementById("elapsed").textContent = `${event.data.elapsed.toFixed(1)}s`;
                document.getElementById("size").textContent = `${event.data.width}×${event.data.height}`;
                blob = event.data.blob;
                worker.postMessage({type: "next"});
                break;
        }
    };
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

const waveformCtx = waveformCanvas.getContext("2d");
const cursorCtx = cursorCanvas.getContext("2d");
const vuCtx = vuCanvas.getContext("2d");
let cursorPos = 0;
let rangeSize = 4410;
let isPlaying = false;
let grainInterval = null;
let lastTime = 0;
const bookmarks = new Set();

// Misc
let mouseDown = false;
const focusedInputs = new Set();

// Audio stuff
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioBuffer;
const masterGain = audioCtx.createGain();
const analyser = audioCtx.createAnalyser();

masterGain.gain.value = 0.9;
analyser.fftSize = 2048;
analyser.smoothingTimeConstant = 1.0;
masterGain.connect(analyser);
analyser.connect(audioCtx.destination);

function drawWaveform() {
    if (!audioBuffer) return;
    const channelData = audioBuffer.getChannelData(0);
    waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    waveformCtx.strokeStyle = "#f0f0f0";
    waveformCtx.lineWidth = 2;
    waveformCtx.beginPath();
    waveformCtx.moveTo(0, waveformCanvas.height / 2);
    waveformCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
    waveformCtx.stroke();
    waveformCtx.beginPath();
    const step = Math.ceil(channelData.length / waveformCanvas.width);
    let overallMax = 0;
    for (let i = 0; i < channelData.length; i++) {
        overallMax = Math.max(overallMax, Math.abs(channelData[i]));
    }
    for (let i = 0; i < waveformCanvas.width; i++) {
        const min = Math.min(...channelData.slice(i * step, (i + 1) * step));
        const max = Math.max(...channelData.slice(i * step, (i + 1) * step));
        waveformCtx.moveTo(i, (0.15 + 0.7 * (0.5 + 0.5 * min / overallMax)) * waveformCanvas.height);
        waveformCtx.lineTo(i, (0.15 + 0.7 * (0.5 + 0.5 * max / overallMax)) * waveformCanvas.height);
    }
    waveformCtx.stroke();
    drawCursor();
}

function formatCursorTimestamp() {
    if (!audioBuffer) return;
    const cursorSec = cursorPos / audioBuffer.sampleRate;
    const minutes = Math.floor(cursorSec / 60);
    const seconds = Math.floor(cursorSec - 60 * minutes);
    const milliSeconds = Math.floor((cursorSec - 60 * minutes - seconds) * 1000);
    cursorTimestamp.value = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliSeconds.toString().padStart(3, "0")}`;
}

function parseCursorTimestamp() {
    if (!audioBuffer) return;
    const [minutes, seconds, milliSeconds] = cursorTimestamp.value.split(/[\:\.]/);
    const cursorSec = 60 * parseInt(minutes) + parseInt(seconds) + parseInt(milliSeconds) / 1000;
    if (cursorSec) setCursor(cursorSec * audioBuffer.sampleRate, false);
}

function drawCursor() {
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    for (const bookmarkCursor of bookmarks) {
        const bookmarkX = (bookmarkCursor / audioBuffer.length) * waveformCanvas.width;
        cursorCtx.strokeStyle = "#643f0f";
        cursorCtx.beginPath();
        cursorCtx.moveTo(bookmarkX, 0);
        cursorCtx.lineTo(bookmarkX, cursorCanvas.height);
        cursorCtx.stroke();
    }
    const cursorX = (cursorPos / audioBuffer.length) * waveformCanvas.width;
    const rangeStartX = ((cursorPos - rangeSize / 2) / audioBuffer.length) * cursorCanvas.width;
    const rangeEndX = ((cursorPos + rangeSize / 2) / audioBuffer.length) * cursorCanvas.width;
    cursorCtx.fillStyle = "#a587f280";
    cursorCtx.fillRect(rangeStartX, 0, rangeEndX - rangeStartX, cursorCanvas.height);
    cursorCtx.beginPath();
    cursorCtx.moveTo(cursorX, 0);
    cursorCtx.lineTo(cursorX, cursorCanvas.height);
    if (bookmarks.has(cursorPos)) {
        cursorCtx.strokeStyle = "#482150ff";
    } else {
        cursorCtx.strokeStyle = "#2e2150";
    }
    cursorCtx.stroke();
}

function togglePlayPause() {
    if (!audioBuffer) return;
    if (isPlaying) {
        isPlaying = false;
        clearInterval(grainInterval);
        playBtn.textContent = "Play";
    } else {
        isPlaying = true;
        lastTime = audioCtx.currentTime;
        loop();
        playBtn.textContent = "Pause";
    }
}

function loop() {
    if (!isPlaying) return;
    const now = audioCtx.currentTime;
    const elapsedTimeSec = now - lastTime;
    const grainsPerSecond = parseInt(grainCount.value);
    const grainsToPlay = elapsedTimeSec * grainsPerSecond;
    const grainDurationSec = parseInt(grainDuration.value) / 1000;
    let grains = Math.floor(grainsToPlay);
    if (Math.random() < grainsToPlay - grains) {
        grains++;
    }
    grains = Math.min(1000, grains);
    for (let g = 0; g < grains; g++) {
        const startSample = Math.max(0, cursorPos - rangeSize / 2);
        const endSample = Math.min(audioBuffer.length, cursorPos + rangeSize / 2);
        const randomSample = Math.floor(Math.random() * (endSample - startSample)) + startSample;
        playGrain(randomSample, grainDurationSec);
    }
    lastTime = now;
    updateVUMeter();
    requestAnimationFrame(loop);
}

function updateVUMeter() {
    if (!analyser) {
        vuCtx.clearRect(0,0, vuCanvas.width, vuCanvas.height);
        vuCtx.strokeStyle = "#444";
        vuCtx.strokeRect(0.5, 0.5, vuCanvas.width-1, vuCanvas.height-1);
        return;
    }
    const bufferLength = analyser.fftSize;
    const data = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const scaled = Math.tanh(rms * 10);
    const w = vuCanvas.width;
    const h = vuCanvas.height;
    vuCtx.clearRect(0, 0, w, h);
    vuCtx.fillStyle = '#111';
    vuCtx.fillRect(0, 0, w, h);
    vuCtx.strokeStyle = '#444';
    vuCtx.lineWidth = 1;
    vuCtx.strokeRect(0.5, 0.5, w-1, h-1);
    const hue = 257;
    const saturation = 90;
    const minLight = 30;
    const maxLight = 55;
    const lightness = minLight + (maxLight - minLight) * scaled;
    const alpha = 0.18 + 0.82 * scaled;
    const fillH = Math.max(2, Math.round(h * scaled));
    vuCtx.save();
    vuCtx.shadowBlur = 12 * scaled;
    vuCtx.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
    vuCtx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
    vuCtx.fillRect(0, h - fillH, w, fillH);
    vuCtx.restore();
    vuCtx.strokeStyle = '#333';
    vuCtx.beginPath();
    for (let i = 0; i < 4; i++) {
        const y = 4 + (h - 8) * (i / 3);
        vuCtx.moveTo(2, y);
        vuCtx.lineTo(w - 2, y);
    }
    vuCtx.stroke();
}

function playGrain(startSample, duration) {
    const sampleRate = audioBuffer.sampleRate;
    const grainLength = Math.floor(duration * sampleRate);
    const buffer = audioCtx.createBuffer(1, grainLength, sampleRate);
    const output = buffer.getChannelData(0);
    const windowType = windowSelect.value;
    for (let i = 0; i < grainLength; i++) {
        const idx = startSample + i;
        if (idx < audioBuffer.length) {
            const t = i / grainLength;
            let window = 1;
            if (windowType === "gaussian") {
                window = Math.exp(-12 * Math.pow(t - 0.5, 2));
            } else if (windowType === "hanning") {
                window = 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
            } else if (windowType === "hamming") {
                window = 0.54 - 0.46 * Math.cos(2 * Math.PI * t);
            } else if (windowType === "triangular") {
                window = 1.0 - 2.0 * Math.abs(t - 0.5);
            } else if (windowType === "parabola") {
                window = 1.0 - Math.pow(2 * (t - 0.5), 2);
            } else if (windowType === "sine") {
                window = Math.cos(2 * (t - 0.5) * Math.PI / 2);
            } else if (windowType === "none") {
                window = 1.0;
            }
            output[i] = audioBuffer.getChannelData(0)[idx] * window;
        }
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(masterGain);
    source.start();
}

function setSizes() {
    waveformCanvas.width = window.innerWidth;
    waveformCanvas.height = document.querySelector("main").clientHeight;
    cursorCanvas.width = window.innerWidth;
    cursorCanvas.height = 1;
    drawWaveform();
}

function setCursor(newCursor, setTimestamp=true) {
    if (!audioBuffer) return;
    cursorPos = Math.max(0, Math.min(audioBuffer.length - 1, Math.floor(newCursor)));
    drawCursor();
    if (setTimestamp) {
        formatCursorTimestamp();
    }
}

function goToNextBookmark(goForward) {
    if (bookmarks.size === 0) return;
    let closest = null;
    for (const bookmark of bookmarks) {
        if (goForward && bookmark > cursorPos) {
            if (closest == null || closest > bookmark) closest = bookmark;
        } else if (!goForward && bookmark < cursorPos) {
            if (closest == null || closest < bookmark) closest = bookmark;
        }
    }
    if (closest == null) {
        if (goForward) {
            closest = Math.min(...bookmarks);
        } else {
            closest = Math.max(...bookmarks);
        }
    }
    setCursor(closest);
}

setSizes();
window.addEventListener("resize", setSizes);

audioFile.addEventListener("input", async () => {
    const file = audioFile.files[0];
    if (!file) return;
    audioFileLabel.textContent = file.name;
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    cursorPos = Math.floor(0.5 * audioBuffer.length);
    drawWaveform();
});

cursorCanvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    if (audioBuffer) {
        const rect = cursorCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        setCursor(Math.floor((x / cursorCanvas.width) * audioBuffer.length));
    }
});

cursorCanvas.addEventListener("mousemove", (e) => {
    if (mouseDown && audioBuffer) {
        const rect = cursorCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        setCursor(Math.floor((x / cursorCanvas.width) * audioBuffer.length));
    }
});

cursorCanvas.addEventListener("mouseup", (e) => {
    mouseDown = false;
});

audioFileDrop.addEventListener("click", (e) => {
    if (audioBuffer) {
        e.preventDefault();
    }
});

audioFileDrop.addEventListener("dragover", (e) => {
    e.preventDefault()
}, false);

audioFileDrop.addEventListener("dragenter", () => {
    audioFileDrop.classList.add("drag-active")
});

audioFileDrop.addEventListener("dragleave", () => {
    audioFileDrop.classList.remove("drag-active")
});

audioFileDrop.addEventListener("drop", async (e) => {
    e.preventDefault()
    audioFileDrop.classList.remove("drag-active")
    const file = e.dataTransfer.files[0];
    if (!file) return;
    audioFileLabel.textContent = file.name;
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    cursorPos = Math.floor(0.5 * audioBuffer.length);
    drawWaveform();
});

window.addEventListener("wheel", (e) => {
    if (!audioBuffer) return;
    e.preventDefault();
    const delta = Math.sign(-e.deltaY) * 1000;
    rangeSize = Math.max(100, rangeSize + delta);
    drawCursor();
});

playBtn.addEventListener("click", togglePlayPause);

window.addEventListener("keydown", (e) => {
    if (focusedInputs.size != 0) return;
    if (e.key == " " || e.key == "k") {
        togglePlayPause();
    } else if (e.key == "ArrowLeft") {
        if (e.shiftKey) {
            goToNextBookmark(false);
        } else {
            setCursor(cursorPos - 100);
        }
    } else if (e.key == "ArrowRight") {
        if (e.shiftKey) {
            goToNextBookmark(true);
        } else {
            setCursor(cursorPos + 100);
        }
    } else if (e.key == "r") {
        setCursor(Math.random() * audioBuffer.length);
    } else if (e.key == "d") {
        if (bookmarks.has(cursorPos)) {
            bookmarks.delete(cursorPos);
        } else {
            bookmarks.add(cursorPos);
        }
        drawCursor();
    }
});

document.querySelectorAll("input").forEach(input => {
    input.addEventListener("focusin", () => {
        focusedInputs.add(input.getAttribute("id"));
    });
    input.addEventListener("focusout", () => {
        focusedInputs.delete(input.getAttribute("id"));
    });
});

cursorTimestamp.addEventListener("input", parseCursorTimestamp);

waveformCtx.fillStyle = "white";
waveformCtx.font = "11pt monospace";
waveformCtx.textAlign = "center";
waveformCtx.fillText("drop audio file here", waveformCanvas.width/2, waveformCanvas.height/2);
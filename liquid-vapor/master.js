const scale = 4;
var width = Math.floor(window.innerWidth / scale);
var height = Math.floor(window.innerHeight / scale);
var T = 0.5;
var C = 0;
var imageData = new ImageData(width, height);
var context;
var alpha = 1;
var N = 0;
var noise = 1 / width / height;

function draw() {
    for (let rounds = 0; rounds < alpha * width * height; rounds++) {
        const i0 = Math.floor(Math.random() * height);
        const j0 = Math.floor(Math.random() * width);
        let S = 0;
        for (const [i1, j1] of [[i0 - 1, j0], [i0 + 1, j0], [i0, j0 - 1], [i0, j0 + 1]]) {
            if (i1 >= 0 && i1 < height && j1 >= 0 && j1 < width) {
                S += imageData.data[(i1 * width + j1) * 4 + 3] == 255 ? 1 : -1;
            }
        }
        let spinxy = imageData.data[(i0 * width + j0) * 4 + 3] == 255 ? 1 : -1;
        const deltaE = 2 * spinxy * (S + C);
        if (deltaE < 0 || Math.random() < 1 / (1 + Math.exp(deltaE/T)) || Math.random() < noise) {
            spinxy *= -1;
        }
        imageData.data[(i0 * width + j0) * 4 + 3] = spinxy == 1 ? 255 : 0;
    }
    context.putImageData(imageData, 0, 0);
    requestAnimationFrame(draw);
}

window.addEventListener("mousemove", (event) => {
    T = Math.pow(10, event.clientX / window.innerWidth * 3 - 1);
    C = 100 * Math.pow((event.clientY / window.innerHeight - .5) / 10, 3);
    if (Math.abs(C) < 0.0001) {
        C = 0;
    }
});

window.addEventListener("load", () => {
    context = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;
    N = 0;
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const k = (i * width + j) * 4;
            imageData.data[k] = 255;
            imageData.data[k+1] = 0;
            imageData.data[k+2] = 0;  
            imageData.data[k+3] = 0;
            if (Math.random() > 0.5) {
                imageData.data[k+3] = 255;
                N++;
            }
        }
    }
    context.putImageData(imageData, 0, 0);
    draw();
});
window.addEventListener("load", () => {

    function hex_to_rgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function rgb_to_rgbv(rgb) {
        return [
            Math.pow(rgb.r / 255, 1 / 1.2),
            Math.pow(rgb.g / 255, 1 / 1.2),
            Math.pow(rgb.b / 255, 1 / 1.2),
        ];
    }

    let n = 119; // 1-500
    let g = 15.2; // 0.1 - 100
    let k1 = 1.4; // 0.1 - 10
    let k2 = 0.7; // 0.1 - 10
    let surface = 30000;
    let fps = 60;
    let color_fill_1 = "#062a37";
    let color_fill_2 = "#16485a";
    let color_edge_1 = "#cb0a1f";
    let color_edge_2 = "#000000";

    const url_parameters = new URLSearchParams(window.location.search);
    if (url_parameters.has("n")) n = parseInt(url_parameters.get("n"));
    if (url_parameters.has("g")) g = parseFloat(url_parameters.get("g"));
    if (url_parameters.has("k1")) k1 = parseFloat(url_parameters.get("k1"));
    if (url_parameters.has("k2")) k2 = parseFloat(url_parameters.get("k2"));
    if (url_parameters.has("surface")) surface = parseInt(url_parameters.get("surface"));
    if (url_parameters.has("fps")) fps = parseInt(url_parameters.get("fps"));
    if (url_parameters.has("color_fill_1")) color_fill_1 = url_parameters.get("color_fill_1");
    if (url_parameters.has("color_fill_2")) color_fill_2 = url_parameters.get("color_fill_2");
    if (url_parameters.has("color_edge_1")) color_edge_1 = url_parameters.get("color_edge_1");
    if (url_parameters.has("color_edge_2")) color_edge_2 = url_parameters.get("color_edge_2");

    color_fill_1 = rgb_to_rgbv(hex_to_rgb(color_fill_1));
    color_fill_2 = rgb_to_rgbv(hex_to_rgb(color_fill_2));
    color_edge_1 = rgb_to_rgbv(hex_to_rgb(color_edge_1));
    color_edge_2 = rgb_to_rgbv(hex_to_rgb(color_edge_2));

    var canvas;
    var aspect;
    var width;
    var height;
    var state;

    function setup() {
        aspect = window.innerWidth / window.innerHeight;
        width = Math.floor(Math.sqrt(aspect * surface));
        height = Math.floor(Math.sqrt(surface / aspect));
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";
        state = [];
        for (let i = 0; i < height; i++) {
            state.push([]);
            for (let j = 0; j < width; j++) {
                state[i].push(Math.floor(Math.random() * n));
            }
        }
    }

    function lerp(a, b, t) {
        let o = [];
        for (let i = 0; i < a.length; i++) {
            o.push((1 - t) * a[i] + t * b[i]);
        }
        return o;
    }

    function rgbv_to_string(v) {
        let r = Math.floor(Math.pow(Math.abs(v[0]), 1.2) * 255);
        let g = Math.floor(Math.pow(Math.abs(v[1]), 1.2) * 255);
        let b = Math.floor(Math.pow(Math.abs(v[2]), 1.2) * 255);
        return `rgb(${r}, ${g}, ${b})`;
    }

    async function start(canvas_id) {
        canvas = document.getElementById(canvas_id);
        setup();
        canvas.style.imageRendering = "crisp-edges";
        canvas.style.position = "fixed";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";
        const context = canvas.getContext("2d");
        async function update() {
            for (let i = 0; i < height; i++) {
                for (let j = 0; j < width; j++) {
                    let t = state[i][j] / n;
                    let color;
                    if (t >= 0.98) {
                        color = lerp(color_edge_2, color_edge_1, t);
                    } else {
                        color = lerp(color_fill_1, color_fill_2, t);
                    }
                    context.fillStyle = rgbv_to_string(color);
                    context.fillRect(j, i, 1, 1);
                }
            }
            await new Promise(x => requestAnimationFrame(x));
        }

        let previous_frame = Date.now();  // ms

        while (true) {
            let now = Date.now();
            if ((now - previous_frame) / 1000 < 1 / fps) continue;
            previous_frame = now;
            let next_state = [];
            for (let i = 0; i < height; i++) {
                next_state.push([]);
                for (let j = 0; j < width; j++) {
                    let sum = 0;
                    let ill = 0;
                    let infected = 0;
                    for (let di = -1; di <= 1; di++) {
                        for (let dj = -1; dj <= 1; dj++) {
                            if ((di == 0 && dj == 0) || (Math.abs(di) + Math.abs(dj) == 2)) continue;
                            let k = (i + di + height) % height;
                            let l = (j + dj + width) % width;
                            let neighbor = state[k][l];
                            if (neighbor >= n) {
                                ill++;
                            } else if (neighbor > 0) {
                                infected++;
                            }
                            sum += neighbor;
                        }
                    }
                    sum += state[i][j];
                    if (state[i][j] >= n) {
                        next_state[i][j] = 0;
                    } else if (state[i][j] > 0) {
                        next_state[i][j] = Math.min(Math.floor(sum / (infected + ill + 1)) + g, n);
                    } else {
                        next_state[i][j] = Math.floor(infected / k1) + Math.floor(ill / k2);
                    }
                }
            }
            state = next_state;
            await update();
        }

    }

    window.addEventListener("resize", setup);
    start("canvas");
});

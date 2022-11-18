window.addEventListener("load", () => {

    let surface = 30000;
    let fps = 60;
    let period = 10;
    let color_method = "rgb";
    let signal_method = "triangle";

    const url_parameters = new URLSearchParams(window.location.search);
    if (url_parameters.has("surface")) surface = parseInt(url_parameters.get("surface"));
    if (url_parameters.has("fps")) fps = parseInt(url_parameters.get("fps"));
    if (url_parameters.has("period")) period = parseFloat(url_parameters.get("period"));
    if (url_parameters.has("color")) color_method = url_parameters.get("color");
    if (url_parameters.has("signal")) signal_method = url_parameters.get("signal");

    function random_integer(a, b) {
        return Math.floor(Math.random() * (Math.abs(b - a) + 1) + a);
    }

    function random_color() {
        if (color_method == "rgb") return `rgb(${ random_integer(0, 255) }, ${ random_integer(0, 255) }, ${ random_integer(0, 255) })`;
        if (color_method == "hue") return `hsl(${ random_integer(0, 359) }, 100%, 50%)`;
        if (color_method == "bw") return `hsl(0, 0%, ${ random_integer(0, 100) }%)`;
        if (color_method == "r") return `hsl(0, ${ random_integer(0, 100) }%, ${ random_integer(0, 100) }%)`;
        if (color_method == "g") return `hsl(120, ${ random_integer(0, 100) }%, ${ random_integer(0, 100) }%)`;
        if (color_method == "b") return `hsl(240, ${ random_integer(0, 100) }%, ${ random_integer(0, 100) }%)`;
        return "";
    }

    var canvas;
    var aspect;
    var width;
    var height;
    var nodes;
    var edges;
    var seen;

    function setup() {
        aspect = window.innerWidth / window.innerHeight;
        width = Math.floor(Math.sqrt(aspect * surface));
        height = Math.floor(Math.sqrt(surface / aspect));
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";

        nodes = [];
        edges = [];
        seen = [];

        // Create nodes
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                nodes.push({
                    label: i * width + j,
                    color: random_color(),
                    i: i,
                    j: j
                });
                seen.push(false);
            }
        }

        // Create edges
        nodes.forEach(u => {
            edges.push({});
            if (u.i < height - 1) {
                edges[u.label][u.label + width] = Math.random();
            }
            if (u.j < width - 1) {
                edges[u.label][u.label + 1] = Math.random();
            }
        });

        // Make edges symmetric
        nodes.forEach(u => {
            for (let v in edges[u.label]) {
                edges[v][u.label] = edges[u.label][v];
            }
        });

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
        const f = Math.PI * 2 / period / 1000;
        const eight_over_pi_squared = 8 / Math.PI / Math.PI;

        let signal_function;
        if (signal_method == "triangle") {
            signal_function = (x) => (1 + eight_over_pi_squared * (Math.sin(x) - .111 * Math.sin(3 * x))) / 2;
        } else if (signal_method == "cos") {
            signal_function = (x) => (Math.cos(x) + 1) / 2;
        } else if (signal_method == "saw") {
            signal_function = (x) => x / 2 / Math.PI - Math.floor(x / 2 / Math.PI);
        }

        var previous_frame = 0;

        while (true) {
            const t = Date.now();
            if (t - previous_frame < 1000 / fps) continue;
            previous_frame = t;

            // Use sort of a triangle signal (2 first terms of FFT decomposition)
            const x = t * f;
            const p = signal_function(x);

            // Reset seen
            for (let u = 0; u < nodes.length; u++) { seen[u] = false };

            // Explore graph
            for (let u = 0; u < nodes.length; u++) {
                if (seen[u]) continue;
                context.fillStyle = nodes[u].color;
                let buffer = [u];
                while (buffer.length > 0) {
                    let v = buffer.pop();
                    if (seen[v]) continue;
                    seen[v] = true;
                    context.fillRect(nodes[v].j, nodes[v].i, 1, 1);
                    for (let w in edges[v]) {
                        if (edges[v][w] >= p && !seen[parseInt(w)]) buffer.push(parseInt(w));
                    }
                }
            }

            await new Promise(x => requestAnimationFrame(x));
        }
    };

    window.addEventListener("resize", setup);
    start("canvas");
});
window.addEventListener("load", () => {

    function lerp(a, b, t) {
        let o = [];
        for (let i = 0; i < a.length; i++) {
            o.push((1 - t) * a[i] + t * b[i]);
        }
        return o;
    }

    function rgbv_to_rgb(rgbv) {
        return {
            r: Math.floor(Math.pow(Math.abs(rgbv[0]), 1.2) * 255),
            g: Math.floor(Math.pow(Math.abs(rgbv[1]), 1.2) * 255),
            b: Math.floor(Math.pow(Math.abs(rgbv[2]), 1.2) * 255)
        }
    }

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

    const palettes = [
        ["#000000", "#fffffc", "#beb7a4", "#ff7f11", "#ff3f00"],
        // ["#af4d98", "#d66ba0", "#e5a9a9", "#f4e4ba", "#9df7e5"],
        ["#ffffff", "#00a7e1", "#00171f", "#003459", "#007ea7"],
        // ["#ff0000", "#00ff00", "#0000ff"],
        // ["#06c11c", "#3f1ba5"],
        // ["#ffb8d1", "#e4b4c2", "#e7cee3", "#e0e1e9", "#ddfdfe"],
        ["#5bcffa", "#f5abb9"],
        ["#ffeb00", "#fc0019", "#01ff4f", "#ff01d7", "#5600cc", "#00edf5"]
    ]

    const settings = {
        number_of_starting_squares: 5,
        deletion_factor: 0.3,
        deletion_power: 1,
        human_error_factor: 4,
        human_error_power: 2,
        width_factor: 0.08,
        width_power: 0,
        width_intercept: 0.05,
        edge_removal_probability: 0,
        region_size: 100,
        square_appearance_probability: .01,
        square_disappearance_probability: .015,
        colors: palettes[Math.floor(Math.random() * palettes.length)],
    }

    const url_parameters = new URLSearchParams(window.location.search);
    if (url_parameters.has("number_of_starting_squares")) number_of_starting_squares = parseInt(url_parameters.get("number_of_starting_squares"));
    if (url_parameters.has("deletion_factor")) deletion_factor = parseFloat(url_parameters.get("deletion_factor"));
    if (url_parameters.has("deletion_power")) deletion_power = parseFloat(url_parameters.get("deletion_power"));
    if (url_parameters.has("human_error_factor")) human_error_factor = parseFloat(url_parameters.get("human_error_factor"));
    if (url_parameters.has("human_error_power")) human_error_power = parseFloat(url_parameters.get("human_error_power"));
    if (url_parameters.has("width_factor")) width_factor = parseFloat(url_parameters.get("width_factor"));
    if (url_parameters.has("width_power")) width_power = parseFloat(url_parameters.get("width_power"));
    if (url_parameters.has("width_intercept")) width_intercept = parseFloat(url_parameters.get("width_intercept"));
    if (url_parameters.has("edge_removal_probability")) edge_removal_probability = parseFloat(url_parameters.get("edge_removal_probability"));
    if (url_parameters.has("region_size")) region_size = parseInt(url_parameters.get("region_size"));
    if (url_parameters.has("square_appearance_probability")) square_appearance_probability = parseFloat(url_parameters.get("square_appearance_probability"));
    if (url_parameters.has("square_disappearance_probability")) square_disappearance_probability = parseFloat(url_parameters.get("square_disappearance_probability"));
    if (url_parameters.has("colors")) colors = "colors".split(",");


    const color_vectors = [];
    settings.colors.forEach(hex => {
        color_vectors.push(rgb_to_rgbv(hex_to_rgb(hex)));
    });
    color_vectors.push(rgb_to_rgbv(hex_to_rgb(settings.colors[0])));

    class MolnartRegion {
        constructor(i, j, size) {
            this.i = i;
            this.j = j;
            this.size = size;
            this.x = this.j * this.size;
            this.y = this.i * this.size;
            this.squares = [];
        }

        add(square) {
            this.squares.push(square);
        }

        draw(context) {
            this.squares.forEach(square => {
                square.draw(context);
            });
        }

    }

    function draw_edge(context, destination, stroke) {
        if (stroke) {
            context.lineTo(Math.floor(destination.x), Math.floor(destination.y));
        } else {
            context.moveTo(Math.floor(destination.x), Math.floor(destination.y));
        }
    }

    class MolnartSquare {
        constructor(region, size, width) {
            this.region = region;
            this.size_relative = size;
            this.size_absolute = size * this.region.size;
            this.color_index = Math.random() * settings.colors.length;
            this.deleted = false;
            this.width = width;
            this.opacity_max = Math.random();
            this.opacity = this.opacity_max;

            this.reset_corners();

            this.has_top = true;
            this.has_right = true;
            this.has_left = true;
            this.has_bottom = true;

        }

        reset_corners() {
            this.top_left = {
                x: this.region.x + (this.region.size - this.size_absolute) / 2 + offset_x,
                y: this.region.y + (this.region.size - this.size_absolute) / 2 + offset_y
            };
            this.top_right = {
                x: this.region.x + (this.region.size + this.size_absolute) / 2 + offset_x,
                y: this.region.y + (this.region.size - this.size_absolute) / 2 + offset_y
            };
            this.bottom_left = {
                x: this.region.x + (this.region.size - this.size_absolute) / 2 + offset_x,
                y: this.region.y + (this.region.size + this.size_absolute) / 2 + offset_y
            }
            this.bottom_right = {
                x: this.region.x + (this.region.size + this.size_absolute) / 2 + offset_x,
                y: this.region.y + (this.region.size + this.size_absolute) / 2 + offset_y
            }
        }

        get_rgb_color() {
            const index_a = Math.floor(this.color_index) % settings.colors.length;
            return rgbv_to_rgb(lerp(color_vectors[index_a], color_vectors[index_a + 1], this.color_index - Math.floor(this.color_index)));
        }

        draw(context) {
            if (this.opacity <= 0) return;
            context.lineWidth = this.width;
            const rgb = this.get_rgb_color();
            context.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${this.opacity})`;
            context.beginPath();
            draw_edge(context, this.top_left, false);
            draw_edge(context, this.top_right, this.has_top);
            draw_edge(context, this.bottom_right, this.has_right);
            draw_edge(context, this.bottom_left, this.has_bottom);
            draw_edge(context, this.top_left, this.has_left);
            context.stroke();
        }
    }



    const canvas = document.getElementById("canvas");
    canvas.style.imageRendering = "crisp-edges";
    const context = canvas.getContext("2d");
    // context.lineJoin = "arcs";

    var width;
    var height;
    var nrows;
    var ncols;
    var squares;
    var movements;
    var offset_x;
    var offset_y;

    function setup() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        context.lineCap = "square";
        context.fillStyle = "black";
        context.fillRect(0, 0, width, height);

        nrows = Math.floor(height / settings.region_size);
        ncols = Math.floor(width / settings.region_size);

        offset_x = (width - ncols * settings.region_size) / 2;
        offset_y = (height - nrows * settings.region_size) / 2;

        squares = [];
        for (let i = 0; i < nrows; i++) {
            for (let j = 0; j < ncols; j++) {
                let region = new MolnartRegion(i, j, settings.region_size);
                for (let k = 0; k < settings.number_of_starting_squares; k++) {
                    let width = (Math.random() * Math.pow(10, settings.width_power) * settings.width_factor + settings.width_intercept) * settings.region_size;
                    let square = new MolnartSquare(region, 0.8 - k / (settings.number_of_starting_squares + 1), width);
                    region.add(square);
                    squares.push(square);
                }
            }
        }

        squares.forEach(square => {
            // Delete some random squares
            if (Math.random() * settings.deletion_factor > Math.pow(square.size_relative, settings.deletion_power)) {
                square.deleted = true;
            }

            // Delete random edges
            square.has_top = Math.random() > settings.edge_removal_probability;
            square.has_bottom = Math.random() > settings.edge_removal_probability;
            square.has_left = Math.random() > settings.edge_removal_probability;
            square.has_right = Math.random() > settings.edge_removal_probability;

            // Shift corners
            ["top_left", "top_right", "bottom_left", "bottom_right"].forEach(ppty => {
                ["x", "y"].forEach(axis => {
                    square[ppty][axis] += (Math.random() - 0.5) * settings.human_error_factor * Math.pow(square.size_relative, settings.human_error_power);
                });
            });

        });

        movements = [];
        squares.forEach(square => {
            ["top_left", "top_right", "bottom_left", "bottom_right"].forEach(ppty => {
                ["x", "y"].forEach(axis => {
                    movements.push({ t: Math.random(), f: Math.random() * 300, a: Math.random() * Math.pow(square.size_relative, 2) / 4 });
                });
            });
        });
    }

    async function draw() {
        context.fillRect(0, 0, width, height);
        squares.forEach(square => { square.draw(context); });
    }

    var t = 0;
    async function molnart() {
        setup();
        await draw();
        while (true) {
            await (new Promise(x => requestAnimationFrame(x)));
            t++;
            squares.forEach((square, i) => {
                square.hue = t % 360;
                square.opacity += (Math.random() - 0.5) / 100;
                if (square.deleted) {
                    if (Math.random() > (1 - settings.square_appearance_probability)) {
                        square.deleted = false;
                    } else if (square.opacity > 0) {
                        square.opacity -= Math.random() / 50;
                    }
                } else {
                    if (Math.random() > (1 - settings.square_disappearance_probability)) {
                        square.deleted = true;
                    } else if (square.opacity < square.opacity_max) {
                        square.opacity += Math.random() / 50;
                    }
                }
                square.color_index += Math.random() / 100;
                ["top_left", "top_right", "bottom_left", "bottom_right"].forEach((ppty, j) => {
                    ["x", "y"].forEach((axis, k) => {
                        const p = i + j * 4 + k * 2;
                        movements[p].t += Math.random();
                        square[ppty][axis] += Math.cos(movements[p].t * Math.PI / movements[p].f) * movements[p].a;
                    });
                });
            });
            await draw();
        }
    }

    window.addEventListener("resize", setup);
    async function main() { await molnart(); }
    main();
});
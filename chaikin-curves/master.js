window.addEventListener("load", () => {

    let max_lines = 3;
    let segments = 7;
    let min_iter = 5;
    let max_iter = 10;
    let fall_steps = 1000;
    let background_color = "#1c1b22";
    let line_color = "#de2227";

    const url_parameters = new URLSearchParams(window.location.search);
    if (url_parameters.has("maxlines")) max_lines = parseInt(url_parameters.get("maxlines"));
    if (url_parameters.has("segments")) segments = parseInt(url_parameters.get("segments"));
    if (url_parameters.has("miniter")) min_iter = parseInt(url_parameters.get("miniter"));
    if (url_parameters.has("maxiter")) max_iter = parseInt(url_parameters.get("maxiter"));
    if (url_parameters.has("fallsteps")) fall_steps = parseInt(url_parameters.get("fallsteps"));
    if (url_parameters.has("bg")) background_color = url_parameters.get("bg");
    if (url_parameters.has("fg")) line_color = url_parameters.get("fg");

    
    let width = window.innerWidth;
    let height = window.innerHeight;


    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;


    window.addEventListener("resize", () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        context.fillStyle = background_color;
        context.strokeStyle = line_color;
    });

    context.fillStyle = background_color;
    context.strokeStyle = line_color;

    context.fillRect(0, 0, width, height);

    function apply_chaikin_iteration(previous_points) {
        let next_points = [];
        for (let i = 0; i < previous_points.length - 1; i++) {
            let a = previous_points[i];
            let b = previous_points[i + 1];
            let u = { x: b.x - a.x, y: b.y - a.y };
            next_points.push({ x: a.x + 0.25 * u.x, y: a.y + 0.25 * u.y });
            next_points.push({ x: a.x + 0.75 * u.x, y: a.y + 0.75 * u.y });
        }
        return next_points;
    }

    function generate_chaikin_curve() {
        let points = [];
        points.push({ x: Math.random(), y: -1 });
        for (let i = 0; i < segments; i++) {
            points.push({
                x: Math.random(),
                y: (i + Math.random() + (Math.random() - 0.5)) * (1 / segments)
            });
        }
        points.push({ x: Math.random(), y: 2 });
        points.sort((a, b) => a.y - b.y);

        const number_of_iterations = Math.floor(Math.random() * (max_iter - min_iter)) + min_iter;
        for (let k = 0; k < number_of_iterations; k++) {
            points = apply_chaikin_iteration(points);
        }
        return points;
    }
    

    function draw_line(line, t, max_time) {
        const cache_height =  Math.floor(height * t/max_time);
        for (let i = 0; i < line.length - 1; i++) {
            context.lineWidth = Math.cos((t + line[i].y * height) / 10) + 1.1 + 1;
            context.beginPath();
            context.moveTo(line[i].x * width, line[i].y * height);
            context.lineTo(line[i + 1].x * width, line[i + 1].y * height);
            context.stroke();
            if (line[i].y > cache_height) break;
        }
    }

    function draw_lines(lines, t) {
        const cache_height =  Math.floor(height * t/fall_steps);
        context.fillRect(0, 0, width, height);
        lines.forEach(line => {
            draw_line(line, t, fall_steps);
        })
        context.fillRect(0, cache_height, width, height - cache_height);
    }

    function start_animation() {
        let line_count = Math.ceil(Math.random() * max_lines);

        let lines = [];
        for (let i = 0; i < line_count; i++) {
            lines.push(generate_chaikin_curve());
        }
        let t = 0;
        
        function step() {
            draw_lines(lines, t);
            t++;
            if (t > fall_steps) {
                line_count = Math.ceil(Math.random() * max_lines);
                lines = [];
                for (let i = 0; i < line_count; i++) {
                    lines.push(generate_chaikin_curve());
                }
                t = 0;
            }
            requestAnimationFrame(step);
        }
    
        requestAnimationFrame(step);
    }

    start_animation();

});
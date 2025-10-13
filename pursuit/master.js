const mainContext = mainCanvas.getContext("2d");

const shapeCanvas = document.createElement("canvas");
var shapeWidth = Math.floor(window.innerWidth / 4);
var shapeHeight = shapeWidth;
shapeCanvas.width = shapeWidth;
shapeCanvas.height = shapeHeight;
const shapeContext = shapeCanvas.getContext("2d");

var width;
var height;
var speed = 0.05;
var symmetry = 0;
var shape = "triangle";

const shapes = {
    triangle: {
        shapeHeightScale: Math.sqrt(3) / 2,
        points: [[0, 0], [1, 0], [0.5, 1]],
        tiler: tileTriangles,
    },
    square: {
        shapeHeightScale: 1,
        points: [[0, 0], [1, 0], [1, 1], [0, 1]],
        tiler: tileRectangular,
    },
    hexagon: {
        shapeHeightScale: Math.sqrt(3) / 2,
        points: [
            [0.25, 0],
            [0.75, 0],
            [1, 0.5],
            [0.75, 1],
            [0.25, 1],
            [0, 0.5],
        ],
        tiler: tileHexagonal,
    },
    random: {
        shapeHeightScale: 1,
        points: [],
        tiler: tilerNone,
    }
};

function setup() {
    width = window.innerWidth;
    height = window.innerHeight;
    mainCanvas.width = width;
    mainCanvas.height = height; 
}
setup();

function drawShapeTile(x, y, angle = 0, flipX = false, flipY = false) {
    mainContext.save();
    mainContext.translate(x, y);
    mainContext.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    mainContext.rotate(angle);
    mainContext.drawImage(shapeCanvas, -shapeCanvas.width / 2, -shapeCanvas.height / 2);
    mainContext.restore();
}

function tileRectangular() {
    const rows = Math.ceil(height / shapeHeight);
    const cols = Math.ceil(width / shapeWidth);
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const flipX = symmetry > 0 && (i + j) % 2 == 0;
            drawShapeTile(shapeWidth * (j + 0.5), shapeHeight * (i + 0.5), 0, flipX, false);
        }
    }
}

function tileTriangles(s) {
    const rows = 2 * Math.ceil(height / shapeHeight);
    const cols = Math.ceil(width / shapeWidth) + 1;
    for (let i = 0; i < rows; i++) {
        const k = Math.floor(i / 2);
        const offsetX = (i % 2 === 0) ? 0 : -shapeWidth / 2;
        for (let j = 0; j < cols; j++) {
            const angle = (i % 2 === 0) ? 0 : Math.PI;
            const flipX = symmetry > 0 && (i + j) % 2 == 0;
            drawShapeTile(shapeWidth * (j + 0.5) + offsetX, shapeHeight * (k + 0.5), angle, flipX, false);
        }
    }
}

function tileHexagonal() {
    const rows = 2 * Math.ceil(height / shapeHeight);
    const cols = Math.ceil(width / shapeWidth) + 1;
    for (let i = -1; i < rows; i++) {
        const k = i % 2;
        for (let j = -1; j < cols; j++) {
            const offsetX = j * 0.5 * shapeWidth + (i % 2 == 0 ? 0 : 0.75 * shapeWidth);
            const flipX = symmetry > 0 && (i + j) % 2 == 0;
            drawShapeTile(shapeWidth * (j + 0.5) + offsetX, shapeHeight * (i / 2 + 0.5), 0, flipX, false);
        }
    }
}

function tilerNone() {
    drawShapeTile(window.innerWidth / 2, window.innerHeight / 2);
}

function draw() {
    shapeHeight = Math.floor(shapes[shape].shapeHeightScale * shapeWidth);
    shapeCanvas.height = shapeHeight;
    shapeContext.clearRect(0, 0, shapeWidth, shapeHeight);
    const points = [];
    for (const [x, y] of shapes[shape].points) {
        points.push([x * shapeWidth, y * shapeHeight]);
    }
    const n = points.length;
    for (let i = 0; i <= Math.max(20, Math.min(200, -50*Math.log2(speed))); i++) {
        shapeContext.beginPath();
        const [firstX, firstY] = points[0];
        const [lastX, lastY] = points[n - 1];
        shapeContext.moveTo(lastX, lastY);
        for (const [x, y] of points) shapeContext.lineTo(x, y);
        shapeContext.stroke();
        for (let j = 0; j < n - 1; j++) {
            points[j][0] = (1 - speed) * points[j][0] + speed * points[j + 1][0];
            points[j][1] = (1 - speed) * points[j][1] + speed * points[j + 1][1];
        }
        points[n - 1][0] = (1 - speed) * points[n - 1][0] + speed * firstX;
        points[n - 1][1] = (1 - speed) * points[n - 1][1] + speed * firstY;
    }
    mainContext.clearRect(0, 0, width, height);
    shapes[shape].tiler();    
}
draw();

window.addEventListener("resize", () => {
    setup();
    draw();
});

window.addEventListener("mousemove", (event) => {
    const t = event.clientX / window.innerWidth - 0.5;
    speed = t < 0 ? (-2 * t) * 0.45 + 0.05 : (2 * t) * 0.45 + 0.05;
    draw();
});

window.addEventListener("wheel", (event) => {
    symmetry = 1 - symmetry;
    draw();
});

function generateRandomShape() {
    const n = Math.floor(4 * Math.random()) + 4;
    const randomPoints = [];
    for (let i = 0; i < n; i++) {
        const side = Math.floor(4 * Math.random());
        if (side == 0) {
            randomPoints.push([0, Math.random()]);
        } else if (side == 1) {
            randomPoints.push([1, Math.random()]);
        } else if (side == 2) {
            randomPoints.push([Math.random(), 0]);
        } else {
            randomPoints.push([Math.random(), 1]);
        }
    }
    randomPoints.sort(([x0, y0], [x1, y1]) => Math.atan2(y1, x1) - Math.atan2(y0, x0));
    shapes.random.points = randomPoints;
}

window.addEventListener("keydown", (event) => {
    disclaimerBox.classList.add("hidden");
    if (event.key == "t") {
        shape = "triangle";
    } else if (event.key == "s") {
        shape = "square";
    } else if (event.key == "h") {
        shape = "hexagon";
    } else if (event.key == "r") {
        shape = "random";
        generateRandomShape();
    } else {
        return;
    }
    draw();
});

mainCanvas.addEventListener("click", () => {
    disclaimerBox.classList.add("hidden");
});
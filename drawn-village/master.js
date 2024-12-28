const SPRITE_SIZE = 56;

async function loadImage(imageUrl) {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    return image;
}

function spiralIndex(j, i) {
    /** @see https://superzhu.gitbooks.io/bigdata/content/algo/get_spiral_index_from_location.html */
    let index = 0;
    if (j * j >= i * i) {
        index = 4 * j * j  - j - i;
        if (j < i) {
            index -= 2 * (j - i);
        }
    } else {
        index = 4 * i * i - j - i;
        if (j < i) {
            index += 2 * (j - i);
        }
    }
    return index;
}

function gradientAt(masterSeed, j, i) {
    /** @see https://github.com/davidbau/seedrandom */
    const localSeed = masterSeed + spiralIndex(j, i);
    const prng = (new Math.seedrandom(localSeed))();
    return rotate({x: 0, y: 1}, prng * 2 * Math.PI);
}

function interpLinear(t, x0, x1) {
    return (1 - t) * x0 + t * x1;
}

function interpSmooth(t, x0, x1) {
    return (x1 - x0) * (3.0 - t * 2.0) * t * t + x0;
}

function interpSmoother(t, x0, x1) {
    return (x1 - x0) * ((t * (t * 6.0 - 15.0) + 10.0) * t * t * t) + x0;
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

function rotate(vec, theta) {
    return {
        x: vec.x * Math.cos(theta) + vec.y * Math.sin(theta),
        y: -vec.x * Math.sin(theta) + vec.y * Math.cos(theta)
    }
}

class PerlinNoise {

    constructor(seed, period, harmonics, spread, gain, offsetX, offsetY, scaleX, scaleY) {
        this.seed = seed;
        this.period = period;
        this.harmonics = harmonics;
        this.spread = spread;
        this.gain = gain;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.scaleX = scaleX,
        this.scaleY = scaleY;
        this.gradients = {};
        this.totalAmplitude = 0;
        for (let i = 0; i <= this.harmonics; i++) {
            this.totalAmplitude += Math.pow(this.gain, i);
        }
    }

    gradientAt(i, j, k) {
        const localSeed = this.seed * (k + 1) + spiralIndex(j, i);
        if (localSeed in this.gradients) {
            return this.gradients[localSeed];
        }
        const prng = (new Math.seedrandom(localSeed))();
        const gradient = rotate({x: 0, y: 1}, prng * 2 * Math.PI);
        this.gradients[localSeed] = gradient;
        return gradient;
    }

    sampleHarmonic(x, y, k) {
        const period = this.period / Math.pow(this.spread, k);
        const j = (x - this.offsetX) * this.scaleX / period;
        const i = (y - this.offsetY) * this.scaleY / period;
        const j0 = Math.floor(j);
        const i0 = Math.floor(i);
        const j1 = j0 + 1;
        const i1 = i0 + 1;
        const dotUl = dot(this.gradientAt(i0, j0, k), {x: j - j0, y: i - i0});
        const dotBl = dot(this.gradientAt(i1, j0, k), {x: j - j0, y: i - i1});
        const interpLeft = interpSmoother(i - i0, dotUl, dotBl);
        const dotUr = dot(this.gradientAt(i0, j1, k), {x: j - j1, y: i - i0});
        const dotBr = dot(this.gradientAt(i1, j1, k), {x: j - j1, y: i - i1});
        const interpRight = interpSmoother(i - i0, dotUr, dotBr);
        const interpVert = (interpSmoother(j - j0, interpLeft, interpRight) * 0.5) + 0.5;
        return interpVert;
    }

    sample(x, y) {
        let value = 0;
        for (let k = 0; k <= this.harmonics; k++) {
            const amplitude = Math.pow(this.gain, k);
            value += amplitude * this.sampleHarmonic(x, y, k);
        }
        return value / this.totalAmplitude;
    }

}

async function main() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    const canvas = document.getElementById("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawSprite = (sheet, i, j, x, y) => {
        context.drawImage(sheet,
            j * SPRITE_SIZE, i * SPRITE_SIZE,
            SPRITE_SIZE, SPRITE_SIZE,
            x - 0.5 * SPRITE_SIZE, y - 0.5 * SPRITE_SIZE,
            SPRITE_SIZE, SPRITE_SIZE);
    }
    
    const assets = {};
    assets.trees = await loadImage("assets/trees.png");

    const randomSeed = Math.floor(Math.random() * 1000);
    const humidityNoise = new PerlinNoise((Math.random() * (2 ** 32 - 1))>>>0, 512, 0, 2, 0.5, 0, 0, 1, 1);
    const densityNoise = new PerlinNoise((Math.random() * (2 ** 32 - 1))>>>0, 512, 0, 2, 0.5, 0, 0, 1, 1);
    const baseNoise = new PerlinNoise((Math.random() * (2 ** 32 - 1))>>>0, 128, 0, 2, 0.5, 0, 0, 1, 1);

 
    context.clearRect(0, 0, width, height);
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {   
            if (Math.random() < 0.001) {
                const humidity = humidityNoise.sample(j, i);
                if (humidity > 0.5) {
                    let noise = baseNoise.sample(j, i);
                    let variant;
                    if (noise < 0.4) {
                        variant = 0;
                    } else if (noise < 0.8) {
                        variant = 1;
                    } else {
                        variant = 2;
                    }
                    context.drawSprite(assets.trees, 2, variant, j, i);
                }
            }
            if (Math.random() < 0.005) {
                const density = Math.pow(densityNoise.sample(j / 10, i / 10), 3);
                if (Math.random() < density) {
                    const humidity = humidityNoise.sample(j, i);
                    if (humidity < 0.4) {
                        const variant = Math.floor(Math.random() * 3);
                        context.drawSprite(assets.trees, 1, variant, j, i);
                    }
                };
            }
        }
    }
    
}


main();





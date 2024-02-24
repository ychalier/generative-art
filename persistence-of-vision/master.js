window.addEventListener("load", () => {
    
    class Vect3 {
        constructor(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
    
        copy() {
            return new Vect3(this.x, this.y, this.z);
        }
    
        addi(other) {
            this.x += other.x;
            this.y += other.y;
            this.z += other.z;
            return this;
        }
    
        add(other) {
            return this.copy().addi(other);
        }
    
        multi(lambda) {
            this.x *= lambda;
            this.y *= lambda;
            this.z *= lambda;
            return this;
        }
    
        mult(lambda) {
            return this.copy().multi(lambda);
        }
    
        dot(other) {
            return this.x * other.x + this.y * other.y + this.z * other.z;
        }
    
        l2() {
            return Math.sqrt(this.dot(this));
        }
    
        normalize() {
            this.multi(1/this.l2());
            return this;
        }
    
        rxi(theta) {
            let y = this.y;
            let z = this.z;
            this.y = Math.cos(theta) * y - Math.sin(theta) * z;
            this.z = Math.sin(theta) * y + Math.cos(theta) * z;
            return this; 
        }
    
        ryi(theta) {
            let x = this.x;
            let z = this.z;
            this.x = Math.cos(theta) * x + Math.sin(theta) * z;
            this.z = - Math.sin(theta) * x + Math.cos(theta) * z; 
            return this;
        }
    
        rzi(theta) {
            let x = this.x;
            let y = this.y;
            this.x = Math.cos(theta) * x - Math.sin(theta) * y;
            this.y = Math.sin(theta) * x + Math.cos(theta) * y;
            return this;
        }
    
    }
    
    function randVect() {
        return new Vect3(Math.random(), Math.random(), Math.random());
    }
    
    class Line {
        constructor() {
            this.anchor = randVect();
            this.direction = randVect().normalize().multi(0.5);
            this.speed = randVect().normalize().multi(0.8);
            this.angularSpeed = randVect();
        }
    
        update(dt) {
            this.anchor.addi(this.speed.mult(dt));
            this.direction.rxi(this.angularSpeed.x * dt).ryi(this.angularSpeed.y * dt).rzi(this.angularSpeed.z * dt);
            if (this.anchor.x < 0 || this.anchor.x > 1) {
                this.anchor.x = Math.min(1, Math.max(0, this.anchor.x));
                this.speed.x *= -1;
            }
            if (this.anchor.y < 0 || this.anchor.y > 1) {
                this.anchor.y = Math.min(1, Math.max(0, this.anchor.y));
                this.speed.y *= -1;
            }
            if (this.anchor.z < 0 || this.anchor.z > 1) {
                this.anchor.z = Math.min(1, Math.max(0, this.anchor.z));
                this.speed.z *= -1;
            }
            var B = this.anchor.add(this.direction);
            if (B.x < 0 || B.x > 1) {
                if (B.x < 0) {
                    this.anchor.x -= B.x;
                } else {
                    this.anchor.x -= B.x - 1;
                }
                this.speed.x *= -1;
            }
            if (B.y < 0 || B.y > 1) {
                if (B.y < 0) {
                    this.anchor.y -= B.y;
                } else {
                    this.anchor.y -= B.y - 1;
                }
                this.speed.y *= -1;
            }
            if (B.z < 0 || B.z > 1) {
                if (B.z < 0) {
                    this.anchor.z -= B.z;
                } else {
                    this.anchor.z -= B.z - 1;
                }
                this.speed.z *= -1;
            }
        }
    
        ends() {
            return [this.anchor.copy(), this.anchor.add(this.direction)];
        }
    
    }
    
    const width = Math.floor(window.innerWidth / 10);
    const height = Math.floor(window.innerHeight / 10);
    const fps = 60;
    const resolution = 300;
    
    const lines = [new Line()];
    window.addEventListener("keydown", (event) => {
        if (event.key == "l") {
            lines.push(new Line());
        } else if (event.key == "m") {
            lines.pop();
        }
    });
    
    const canvas = document.getElementById("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "black";
    const originalImageData = new ImageData(width, height);
    
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {            
            if (Math.random() > 0.5) {
                originalImageData.data[(i * width + j) * 4] = 255;
                originalImageData.data[(i * width + j) * 4 + 1] = 255;
                originalImageData.data[(i * width + j) * 4 + 2] = 255;
                originalImageData.data[(i * width + j) * 4 + 3] = 255;
            } else {
                originalImageData.data[(i * width + j) * 4] = 0;
                originalImageData.data[(i * width + j) * 4 + 1] = 0;
                originalImageData.data[(i * width + j) * 4 + 2] = 0;
                originalImageData.data[(i * width + j) * 4 + 3] = 255;
            }
            
        }
    }
    context.putImageData(originalImageData, 0, 0);
    
    async function startMovingLine() {
        let t0 = new Date();
        while (true) {
            const t1 = new Date();
            const dt = (t1 - t0) / 1000;
            if (dt < 1 / fps) {
                await new Promise(x => requestAnimationFrame(x));
                continue;
            };
            const timeScale = parseFloat(document.getElementById("input-vt").value);
            t0 = t1;
            const currentImageData = new ImageData(width, height);
            currentImageData.data.set(originalImageData.data);
            for (const line of lines) {
                line.update(timeScale * dt);
                let prevI = null;
                let prevJ = null;
                const ends = line.ends();
                const A = ends[0];
                const B = ends[1];
                for (let p = 0; p <= resolution; p++) {
                    const q = p / resolution;
                    let i = Math.max(0, Math.min(height - 1, Math.floor(((1 - q) * A.x + q * B.x) * height)));
                    let j = Math.max(0, Math.min(width - 1, Math.floor(((1 - q) * A.y + q * B.y) * width)));
                    if (i == prevI && j == prevJ) continue;
                    prevI = i;
                    prevJ = j;
                    currentImageData.data[(i * width + j) * 4] = 255 - currentImageData.data[(i * width + j) * 4];
                    currentImageData.data[(i * width + j) * 4 + 1] = 255 - currentImageData.data[(i * width + j) * 4 + 1];
                    currentImageData.data[(i * width + j) * 4 + 2] = 255 - currentImageData.data[(i * width + j) * 4 + 2];
                }
            }
            context.putImageData(currentImageData, 0, 0);
            await new Promise(x => requestAnimationFrame(x));
        }
    
    }
    
    startMovingLine();

    var commandsTimeout = null;
    const commands = document.getElementById("commands");
    commands.classList.add("hidden");
    window.addEventListener("mousemove", (event) => {
        if (commandsTimeout != null) {
            clearTimeout(commandsTimeout);
        }
        commands.classList.remove("hidden");
        commandsTimeout = setTimeout(() => {
            commands.classList.add("hidden");
            commandsTimeout = null;
        }, 1000);
    });

});

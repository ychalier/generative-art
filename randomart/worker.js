var random = Math.random;

var nodeCount = 0;

function xoshiro128ss(a, b, c, d) {
    return function() {
        let t = b << 9, r = b * 5;
        r = (r << 7 | r >>> 25) * 9;
        c ^= a;
        d ^= b;
        b ^= c;
        a ^= d;
        c ^= t;
        d = d << 11 | d >>> 21;
        return (r >>> 0) / 4294967296;
    }
}

function setRandomSeed(seed) {
    const a = seed>>>0;
    random = xoshiro128ss(a, a * 17, a * 19, a * 21);
}

function nodeBw(forcedA) {
    const a = forcedA == undefined ? random() * 2 - 1 : forcedA;
    const nodeId = nodeCount;
    nodeCount++;
    return {
        id: nodeId,
        arity: 0,
        toString() {
            return `${a}`;
        },
        toGlsl() {
            return `vec3 node${nodeId} = vec3(${a}, ${a}, ${a});`;
        },
        eval(x, y) {
            return [a, a, a];
        }
    }
}

function nodeConstant(a) {
    const nodeId = nodeCount;
    nodeCount++;
    return {
        id: nodeId,
        arity: 1,
        toString() {
            return `${a}`;
        },
        toGlsl() {
            return `vec3 node${nodeId} = vec3(${a}, ${a}, ${a});`;
        },
        eval(x, y) {
            return [a, a, a];
        }
    }
}

function nodeRgb(forcedR, forcedG, forcedB) {
    const r = forcedR == undefined ? random() * 2 - 1 : forcedR;
    const g = forcedG == undefined ? random() * 2 - 1 : forcedG;
    const b = forcedB == undefined ? random() * 2 - 1 : forcedB;
    const nodeId = nodeCount;
    nodeCount++;
    return {
        id: nodeId,
        arity: 0,
        toString() {
            return `rgb(${r}, ${g}, ${b})`;
        },
        toGlsl() {
            return `vec3 node${nodeId} = vec3(${r}, ${g}, ${b});`;
        },
        eval(x, y) {
            return [r, g, b];
        }
    }
}

function nodeX() {
    const nodeId = nodeCount;
    nodeCount++;
    return {
        id: nodeId,
        arity: 0,
        toString() {
            return `x`;
        },
        toGlsl() {
            return `vec3 node${nodeId} = 2.0 * vec3(uv.x, uv.x, uv.x) - 1.0;`;
        },
        eval(x, y) {
            return [x, x, x];
        }
    }
}

function nodeY() {
    const nodeId = nodeCount;
    nodeCount++;
    return {
        id: nodeId,
        arity: 0,
        toString() {
            return `y`;
        },
        toGlsl() {
            return `vec3 node${nodeId} = 2.0 * vec3(1.0 - uv.y, 1.0 - uv.y, 1.0 - uv.y) - 1.0;`;
        },
        eval(x, y) {
            return [y, y, y];
        }
    }
}

function nodeUnary(subexpr, label, apply, min=-1, max=1, params=[], glCode=undefined) {
    const nodeId = nodeCount;
    nodeCount++;
    return {
        id: nodeId,
        arity: 1,
        toString() {
            if (params.length == 0) return `${label}(${subexpr.toString()})`;
            const argString = [subexpr.toString()];
            for (const param of params) {
                argString.push(param.toString());
            }
            return `${label}(${argString.join(", ")})`;
        },
        toGlsl() {
            if (glCode != undefined) {
                return `${subexpr.toGlsl()}\nvec3 node${nodeId} = ${glCode(subexpr.id)};`;
            }
            return `${subexpr.toGlsl()}\nvec3 node${nodeId} = ${label}(node${subexpr.id});`;
        },
        eval(x, y) {
            const a = subexpr.eval(x, y);
            return [
                2 * (apply(a[0]) - min) / (max - min) - 1,
                2 * (apply(a[1]) - min) / (max - min) - 1,
                2 * (apply(a[2]) - min) / (max - min) - 1
            ];
        }
    }
}

function nodeSin(subexpr, forcedPhase, forcedFrequency) {
    const phase = forcedPhase == undefined ? random() * Math.PI : forcedPhase;
    const frequency = forcedFrequency == undefined ? random() * 5 + 1 : forcedFrequency;
    return nodeUnary(subexpr, "sin", a => Math.sin(a * frequency + phase), -1, 1, [phase, frequency], nodeId => {
        return `sin(node${nodeId} * ${frequency} + ${phase})`
    });
}

function nodeCos(subexpr, forcedPhase, forcedFrequency) {
    const phase = forcedPhase == undefined ? random() * Math.PI : forcedPhase;
    const frequency = forcedFrequency == undefined ? random() * 5 + 1 : forcedFrequency;
    return nodeUnary(subexpr, "cos", a => Math.cos(a * frequency + phase), -1, 1, [phase, frequency], nodeId => {
        return `cos(node${nodeId} * ${frequency} + ${phase})`
    });
}

function nodeExp(subexpr) {
    return nodeUnary(subexpr, "exp", Math.exp, 0, Math.exp(1), [], nodeId => {
        return `2.0 * exp(node${nodeId}) / exp(1.0) - 1.0`;
    });
}

function nodeSqrt(subexpr) {
    return nodeUnary(subexpr, "sqrt", a => Math.sqrt((a + 1) / 2) * 2 - 1, -1, 1, [], nodeId => {
        return `sqrt((node${nodeId} + 1.0) / 2.0) * 2.0 - 1.0`;
    });
}

function nodeBinary(left, right, label, apply, min=-1, max=1, glCode=undefined) {
    const nodeId = nodeCount;
    nodeCount++;
    return {
        id: nodeId,
        arity: 2,
        toString() {
            return `${label}(${left.toString()}, ${right.toString()})`;
        },
        toGlsl() {
            if (glCode != undefined) {
                return `${left.toGlsl()}\n${right.toGlsl()}\nvec3 node${nodeId} = ${glCode(left.id, right.id)};`;
            }
            return `${left.toGlsl()}\n${right.toGlsl()}\nvec3 node${nodeId} = ${label}(node${left.id}, node${right.id});`;
        },
        eval(x, y) {
            const a = left.eval(x, y);
            const b = right.eval(x, y);
            return [
                2 * (apply(a[0], b[0]) - min) / (max - min) - 1,
                2 * (apply(a[1], b[1]) - min) / (max - min) - 1,
                2 * (apply(a[2], b[2]) - min) / (max - min) - 1
            ];
        }
    }
}

function nodeSum(left, right) {
    return nodeBinary(left, right, "sum", (a, b) => a + b, -2, 2, (leftId, rightId) => {
        return `(node${leftId} + node${rightId}) / 2.0`;
    });
}

function nodeMult(left, right) {
    return nodeBinary(left, right, "mult", (a, b) => a * b, -1, 1, (leftId, rightId) => {
        return `node${leftId} * node${rightId}`;
    });
}

function nodeMod(left, right) {
    return nodeBinary(left, right, "mod", (a, b) => b == 0 ? a : a % b, -1, 1, (leftId, rightId) => {
        return `node${leftId} % node${rightId}`;
    });
}

function nodeSinBin(left, right) {
    return nodeBinary(left, right, "sinBin", (a, b) => Math.sin(a * b));
}

function nodeTriple(first, second, third) {
    const nodeId = nodeCount;
    nodeCount++;
    return {
        id: nodeId,
        arity: 3,
        toString() {
            return `triple(${first}, ${second}, ${third})`;
        },
        toGlsl() {
            return `${first.toGlsl()}\n${second.toGlsl()}\n${third.toGlsl()}\nvec3 node${nodeId} = vec3(node${first.id}.x, node${second.id}.y, node${third.id}.z);`;
        },
        eval(x, y, t) {
            return [first.eval(x, y)[0], second.eval(x, y)[1], third.eval(x, y)[2]];
        }
    }
}

function nodeTernary(left, middle, right, label, apply, min=-1, max=1, params=[], glCode=undefined) {
    const nodeId = nodeCount;
    nodeCount++;
    return {
        id: nodeId,
        arity: 3,
        toString() {
            if (params.length == 0) return `${label}(${left.toString()}, ${middle.toString()}, ${right.toString()})`;
            const argString = [left.toString(), middle.toString(), right.toString()];
            for (const param of params) {
                argString.push(param.toString());
            }
            return `${label}(${argString.join(", ")})`;
        },
        toGlsl() {
            if (glCode != undefined) {
                return `${left.toGlsl()}\n${middle.toGlsl()}\n${right.toGlsl()}\nvec3 node${nodeId} = ${glCode(left.id, middle.id, right.id)};`;
            }
            throw new Error("Not implemented!");
        },
        eval(x, y, t) {
            const a = left.eval(x, y);
            const b = middle.eval(x, y);
            const c = right.eval(x, y);
            return [
                2 * (apply(a[0], b[0], c[0]) - min) / (max - min) - 1,
                2 * (apply(a[1], b[1], c[1]) - min) / (max - min) - 1,
                2 * (apply(a[2], b[2], c[2]) - min) / (max - min) - 1
            ];
        }
    }
}

function nodeLevel(left, middle, right, forcedThreshold) {
    const threshold = forcedThreshold == undefined ? random() * 2 - 1 : forcedThreshold;
    return nodeTernary(left, middle, right, "level", (a, b, c) => a < threshold ? b : c, -1, 1, [threshold]);
}

function nodeMix(left, middle, right) {
    return nodeTernary(left, middle, right, "mix", (a, b, c) => {
        const w = (a + 1) / 2;
        return (1 - a) * b + a * c;
    }, -1, 1, [], (leftId, middleId, rightId) => {
        return `mix(node${middleId}, node${rightId}, (node${leftId} + 1.0) / 2.0)`
    });
}

function parseGrammar(grammarText) {
    const lines = grammarText.split("\n");
    const grammar = {};
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].trim();
        if (line == "" || line.startsWith("#") || line.startsWith(";")) {
            continue;
        }
        const primarySplit = line.split("::");
        if (primarySplit.length != 2) {
            throw new Error(`Could not parse grammar at line ${lineIndex+1}`);
        }
        const key = primarySplit[0].trim();
        const secondarySplit = primarySplit[1].trim().split("|");
        if (secondarySplit.length == 0 || (secondarySplit.length == 1 && secondarySplit[0].trim() == "")) {
            throw new Error(`At least one rule required at line ${lineIndex+1}`);
        }
        const rules = [];
        for (let ruleIndex = 0; ruleIndex < secondarySplit.length; ruleIndex++) {
            const ruleString = secondarySplit[ruleIndex].trim();
            const tertiarySplit = ruleString.match(/^([^\(]+)(?:\(([^\)]+)\))?:(\d+(?:\.\d+)?)$/);
            if (tertiarySplit == null) {
                throw new Error(`Invalid rule ${ruleIndex+1} at line ${lineIndex+1}`);
            }
            let ruleNode = tertiarySplit[1].trim();
            switch(tertiarySplit[1].trim()) {
                case "triple":
                    ruleNode = nodeTriple;
                    break;
                case "sum":
                    ruleNode = nodeSum;
                    break;
                case "mult":
                    ruleNode = nodeMult;
                    break;
                case "mod":
                    ruleNode = nodeMod;
                    break;
                case "sin":
                    ruleNode = nodeSin;
                    break;
                case "cos":
                    ruleNode = nodeCos;
                    break;
                case "exp":
                    ruleNode = nodeExp;
                    break;
                case "sqrt":
                    ruleNode = nodeSqrt;
                    break;
                case "level":
                    ruleNode = nodeLevel;
                    break;
                case "mix":
                    ruleNode = nodeMix;
                    break;
                case "rgb":
                    ruleNode = nodeRgb;
                    break;
                case "bw":
                    ruleNode = nodeBw;
                    break;
                case "constant":
                    ruleNode = nodeConstant;
                    break;
                case "x":
                    ruleNode = nodeX;
                    break;
                case "y":
                    ruleNode = nodeY;
                    break;
                case "sinbin":
                    ruleNode = nodeSinBin;
            }
            let ruleArgs = null;
            if (tertiarySplit[2] != undefined) {
                ruleArgs = tertiarySplit[2].split(",");
                for (let i = 0; i < ruleArgs.length; i++) {
                    ruleArgs[i] = ruleArgs[i].trim();
                }
            }
            if (typeof(ruleNode) == typeof("A")) {
                if (ruleArgs != null) {
                    throw new Error(`Node cannot accept arguments at line ${lineIndex+1} for rule ${ruleIndex+1}`);
                }
            } else {
                const fakeNode = ruleNode();
                if ((ruleArgs == null && fakeNode.arity != 0) || (ruleArgs != null && ruleArgs.length != fakeNode.arity)) {
                    throw new Error(`Invalid number of arguments at line ${lineIndex+1} for rule ${ruleIndex+1}`);
                }
            }
            const ruleWeight = parseFloat(tertiarySplit[3]);
            const rule = [ruleNode, ruleArgs, ruleWeight];
            rules.push(rule);
        }
        grammar[key] = rules;
    }
    return grammar;
}

function expandGrammar(grammar, key, depth) {
    // console.log("Generating rule", key, "at depth", depth);
    if (!(key in grammar)) {
        throw new Error(`Missing key ${key} in grammar`);
    }
    let rule;
    if (depth <= 0) {
        key = "A";
    }
    const nonce = random();
    let totalWeight = 0;
    for (let i = 0; i < grammar[key].length; i++) {
        totalWeight += grammar[key][i][2];
    }
    let cumulativeWeight = 0;
    for (let i = 0; i < grammar[key].length; i++) {
        cumulativeWeight += grammar[key][i][2];
        if (nonce < cumulativeWeight/totalWeight) {
            rule = grammar[key][i];
            break;
        }
    }
    if (rule == undefined) {
        throw new Error("Could not find rule");
    }
    // console.log("Using rule", rule);
    if (typeof(rule[0]) == typeof("A")) {
        return expandGrammar(grammar, rule[0], depth-1);
    }
    const args = [];
    if (rule[0] == nodeBw && rule[1] == null) {
        //pass
    } else if ((rule[0] == nodeConstant || rule[0] == nodeBw) && rule[1].length == 1 && rule[1][0].match(/^\d(?:\.\d+)?/)) {
        args.push(parseFloat(rule[1][0]));
    } else if (rule[1] != null) {
        for (let j = 0; j < rule[1].length; j++) {
            args.push(expandGrammar(grammar, rule[1][j], depth-1));
        }
    }
    const fakeNodeArity = rule[0]().arity;
    if (args.length != fakeNodeArity) {
        throw new Error(`Invalid arity for rule ${rule}`)
    }
    return rule[0](...args);
}

function ravelNode(bwNode) {
    return bwNode.eval(0, 0)[0];
}

function parseExpr(exprText) {
    // console.log("Parsing", exprText);
    if (exprText == "") {
        return null;
    }
    const nodeName = exprText.match(/^[^\(]+/)[0];
    if (nodeName.length == exprText.length) {
        switch(nodeName) {
            case "x":
                return nodeX();
            case "y":
                return nodeY();
            default:
                return nodeBw(parseFloat(nodeName));
        }
    }
    if (exprText.charAt(nodeName.length) != "(") {
        throw new Error(`Invalid character '${exprText.charAt(nodeName.length)}', expected '('`)
    }
    const args = [];
    let start = nodeName.length + 1;
    let end = start;
    while (start < exprText.length) {
        let depth = 0;
        for (let i = start; i < exprText.length; i++) {
            const c = exprText.charAt(i);
            if (c == "(") {
                depth++;
            } else if (c == ")") {
                depth--;
                if (i == exprText.length - 1) {
                    end = i;
                }
            } else if (c == "," && depth == 0) {
                end = i;
                break;
            }
        }
        args.push(parseExpr(exprText.substring(start, end).trim()));
        start = end + 1;
    }
    switch(nodeName) {
        case "rgb":
            return nodeRgb(ravelNode(args[0]), ravelNode(args[1]), ravelNode(args[2]));
        case "sin":
        case "cos":
            const sinArgs = [args[0]];
            if (args.length > 1) sinArgs.push(ravelNode(args[1]));
            if (args.length > 2) sinArgs.push(ravelNode(args[2]));
            if (nodeName == "sin") {
                return nodeSin(...sinArgs);
            } else {
                return nodeCos(...sinArgs);
            }
        case "exp":
            return nodeExp(...args);
        case "sqrt":
            return nodeSqrt(...args);
        case "sum":
            return nodeSum(...args);
        case "mult":
            return nodeMult(...args);
        case "mod":
            return nodeMod(...args);
        case "sinBin":
            return nodeSinBin(...args);
        case "triple":
            return nodeTriple(...args);
        case "level":
            const levelArgs = [args[0], args[1], args[2]];
            if (args.length > 3) levelArgs.push(ravelNode(args[3]));
            return nodeLevel(...levelArgs);
        case "mix":
            return nodeMix(...args);
        default:
            throw new Error(`Unknown node name ${nodeName}`);
    }
}

var canvas;
var context;
var gl;
var expr;
var iteration;
var width;
var height;
const steps = 8;
var pixels;
var step;
var timeStart;
var renderGl;

onmessage = (event) => {
    if (event.data.type == "start") {
        renderGl = event.data.renderGl;
        setRandomSeed(event.data.seed);
        if (event.data.exprText != undefined) {
            expr = parseExpr(event.data.exprText);
        } else if (event.data.grammarText != undefined && event.data.depth != undefined) {
            const grammar = parseGrammar(event.data.grammarText); // TODO: handle errors
            expr = expandGrammar(grammar, "E", event.data.depth); // TODO: handle errors
        } 
        if (expr == undefined) {
            throw new Error("Could not build expression");
        }
        postMessage({type: "expr", expr: expr.toString()});
        if (event.data.canvas != undefined) {
            canvas = event.data.canvas;
            if (renderGl) {
                gl = canvas.getContext("webgl2", { "preserveDrawingBuffer": true });
            } else {
                context = canvas.getContext("2d");
            }
        }
        iteration = 0;
        width = event.data.width;
        height = event.data.height;
        pixels = [];
        for (let i = 0; i < height; i++) {
            pixels.push([]);
            for (let j = 0; j < width; j++) {
                pixels[i].push(null);
            }
        }
        step = 2 ** (steps - 1);
        iteration = 0;
        timeStart = new Date();
    }
    if (renderGl && event.data.type == "start") {
        canvas.width = width;
        canvas.height = height;
        console.log(expr.toGlsl());
        const shaderText = `precision highp float;
        varying vec2 uv;
        void main() {
            ${expr.toGlsl()}
            gl_FragColor.xyz = (node${expr.id} + 1.0) / 2.0;
            gl_FragColor.w = 1.0;
        }`;
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, `attribute vec2 position; varying vec2 uv; void main() {uv = (position * 0.5) + 0.5; gl_Position = vec4(position, 0, 1);}`);
        gl.compileShader(vertexShader);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, shaderText);
        gl.compileShader(fragmentShader);
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.viewport(0, 0, width, height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        canvas.convertToBlob().then(blob => {
            postMessage({type: "progress", current: 1, total: 1,
                blob: blob, width: width, height: height,
                elapsed: ((new Date()) - timeStart) / 1000});
        });
    }
    if (!renderGl && (event.data.type == "start" || event.data.type == "next")) {        
        if (step < 1) return;
        iteration++;
        const r = Math.round(step);
        const imageWidth = Math.floor(width / r);
        const imageHeight = Math.floor(height / r);
        const imageData = context.createImageData(imageWidth, imageHeight);
        for (let i = 0; i < height; i += r) {
            for (let j = 0; j < width; j += r) {
                if (pixels[i][j] == null) {
                    pixels[i][j] = expr.eval((j / width) * 2 - 1, (i / height) * 2 - 1);
                }
                const k = Math.round((i / r) * imageWidth + (j / r)) * 4;
                imageData.data[k + 0] = (pixels[i][j][0] + 1) * 128;
                imageData.data[k + 1] = (pixels[i][j][1] + 1) * 128;
                imageData.data[k + 2] = (pixels[i][j][2] + 1) * 128;
                imageData.data[k + 3] = 255;
            }
        }
        canvas.width = imageWidth;
        canvas.height = imageHeight;
        context.putImageData(imageData, 0, 0);
        canvas.convertToBlob().then(blob => {
            postMessage({type: "progress", current: iteration, total: steps,
                blob: blob, width: imageWidth, height: imageHeight,
                elapsed: ((new Date()) - timeStart) / 1000});
        });
        step /= 2;
    }
}
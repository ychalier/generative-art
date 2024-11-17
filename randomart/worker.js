var random = Math.random;

var nodeCount = 0;
var canvas;
var context;
var gl;
var expr;
var iteration;
var width;
var height;
var steps;
var pixels;
var step;
var timeStart;
var renderGl;
var shaderText;
var vertexShader;
var fragmentShader;
var program;
var tLocation;
var hasTimeDependency = false;

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
            return `vec3 node${nodeId} = vec3(${a.toFixed(17)}, ${a.toFixed(17)}, ${a.toFixed(17)});`;
        },
        eval(x, y, t) {
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
            return `vec3 node${nodeId} = vec3(${a.toFixed(17)}, ${a.toFixed(17)}, ${a.toFixed(17)});`;
        },
        eval(x, y, t) {
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
            return `vec3 node${nodeId} = vec3(${r.toFixed(17)}, ${g.toFixed(17)}, ${b.toFixed(17)});`;
        },
        eval(x, y, t) {
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
        eval(x, y, t) {
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
        eval(x, y, t) {
            return [y, y, y];
        }
    }
}

function nodeT() {
    const nodeId = nodeCount;
    nodeCount++;
    hasTimeDependency = true;
    return {
        id: nodeId,
        arity: 0,
        toString() {
            return `t`;
        },
        toGlsl() {
            return `vec3 node${nodeId} = vec3(t, t, t);`;
        },
        eval(x, y, t) {
            return [t, t, t];
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
        eval(x, y, t) {
            const a = subexpr.eval(x, y, t);
            return [
                2 * (apply(a[0]) - min) / (max - min) - 1,
                2 * (apply(a[1]) - min) / (max - min) - 1,
                2 * (apply(a[2]) - min) / (max - min) - 1
            ];
        }
    }
}

function nodeSin(subexpr, forcedFrequency, forcedPhase) {
    const phase = forcedPhase == undefined ? random() * Math.PI : forcedPhase;
    const frequency = forcedFrequency == undefined ? random() * 5 + 1 : forcedFrequency;
    return nodeUnary(subexpr, "sin", a => Math.sin(a * frequency + phase), -1, 1, [frequency, phase], nodeId => {
        return `sin(node${nodeId} * ${frequency.toFixed(17)} + ${phase.toFixed(17)})`
    });
}

function nodeCos(subexpr, forcedFrequency, forcedPhase) {
    const phase = forcedPhase == undefined ? random() * Math.PI : forcedPhase;
    const frequency = forcedFrequency == undefined ? random() * 5 + 1 : forcedFrequency;
    return nodeUnary(subexpr, "cos", a => Math.cos(a * frequency + phase), -1, 1, [frequency, phase], nodeId => {
        return `cos(node${nodeId} * ${frequency.toFixed(17)} + ${phase.toFixed(17)})`
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

function nodeTan(subexpr) {
    return nodeUnary(subexpr, "tan", a => Math.tan(a) * 0.642092615934, -1, 1, [], nodeId => {
        return `tan(node${nodeId}) * 0.642092615934`;
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
        eval(x, y, t) {
            const a = left.eval(x, y, t);
            const b = right.eval(x, y, t);
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
        return `mod(node${leftId}, node${rightId})`;
    });
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
            return [first.eval(x, y, t)[0], second.eval(x, y, t)[1], third.eval(x, y, t)[2]];
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
            const a = left.eval(x, y, t);
            const b = middle.eval(x, y, t);
            const c = right.eval(x, y, t);
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
    return nodeTernary(left, middle, right, "level", (a, b, c) => a < threshold ? b : c, -1, 1, [threshold],
    (leftId, middleId, rightId) => {
        return `vec3(node${leftId}.x < ${threshold.toFixed(17)} ? node${middleId}.x : node${rightId}.x, node${leftId}.y < ${threshold.toFixed(17)} ? node${middleId}.y : node${rightId}.y, node${leftId}.z < ${threshold.toFixed(17)} ? node${middleId}.z : node${rightId}.z)`;
    });
}

function nodeMix(left, middle, right) {
    return nodeTernary(left, middle, right, "mix", (a, b, c) => {
        const w = (a + 1) / 2;
        return (1 - w) * b + w * c;
    }, -1, 1, [], (leftId, middleId, rightId) => {
        return `mix(node${middleId}, node${rightId}, (node${leftId} + 1.0) / 2.0)`;
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
                case "tan":
                    ruleNode = nodeTan;
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
                case "t":
                    ruleNode = nodeT;
                    break;
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
                    throw new Error(`Node '${ruleNode}' either do not exist or cannot accept arguments at line ${lineIndex+1} for rule ${ruleIndex+1}`);
                }
            } else {
                const fakeNode = ruleNode();
                if ((ruleArgs == null && fakeNode.arity != 0) 
                    || (ruleArgs != null && ruleArgs.length < fakeNode.arity)) {
                    throw new Error(`Not enough arguments at line ${lineIndex+1} for rule ${ruleIndex+1}`);
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
        key = "Z";
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
    const fakeNodeArity = rule[0]().arity;
    if (rule[0] == nodeBw && rule[1] == null) {
        //pass
    } else if ((rule[0] == nodeConstant || rule[0] == nodeBw) 
        && rule[1].length == 1
        && rule[1][0].match(/^\d(?:\.\d+)?/)) {
        args.push(parseFloat(rule[1][0]));
    } else if (rule[1] != null) {
        for (let j = 0; j < fakeNodeArity; j++) {
            args.push(expandGrammar(grammar, rule[1][j], depth-1));
        }
        for (let j = fakeNodeArity; j < rule[1].length; j++) {
            args.push(parseFloat(rule[1][j]));
        }
    }
    if (args.length < fakeNodeArity) {
        throw new Error(`Not enough arguments for rule ${rule}`)
    }
    return rule[0](...args);
}

function ravelNode(bwNode) {
    return bwNode.eval(0, 0, 0)[0];
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
            case "t":
                return nodeT();
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
        case "tan":
            return nodeTan(...args);
        case "sum":
            return nodeSum(...args);
        case "mult":
            return nodeMult(...args);
        case "mod":
            return nodeMod(...args);
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

function setup(grammarText, depth, seed, exprText) {
    setRandomSeed(seed);
    if (exprText != undefined) {
        expr = parseExpr(exprText);
    } else if (grammarText != undefined && depth != undefined) {
        const grammar = parseGrammar(grammarText);
        expr = expandGrammar(grammar, "A", depth);
    }
    if (expr == undefined) {
        throw new Error("Could not build expression");
    }
    if (canvas != undefined) {
        if (renderGl) {
            gl = canvas.getContext("webgl2", { "preserveDrawingBuffer": true });
        } else {
            context = canvas.getContext("2d");
        }
    }
    if (renderGl) {
        vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, [
            "attribute vec2 position;",
            "varying vec2 uv;",
            "void main() {",
            "uv = (position * 0.5) + 0.5;",
            "gl_Position = vec4(position, 0, 1);",
            "}",
        ].join("\n"));
        gl.compileShader(vertexShader);
        fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        shaderText = [
            "precision lowp float;",
            "varying vec2 uv;",
            "uniform float t;",
            "void main() {",
            expr.toGlsl(),
            `gl_FragColor.xyz = (node${expr.id} + 1.0) / 2.0;`,
            "gl_FragColor.w = 1.0;",
            "}",
        ].join("\n");
        gl.shaderSource(fragmentShader, shaderText);
        gl.compileShader(fragmentShader);
        program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        tLocation = gl.getUniformLocation(program, "t");
        gl.useProgram(program);
        gl.uniform1f(tLocation, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, 
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        steps = 1;
    } else {
        pixels = [];
        for (let i = 0; i < height; i++) {
            pixels.push([]);
            for (let j = 0; j < width; j++) {
                pixels[i].push(null);
            }
        }
        steps = 8;
        step = 2 ** steps;
    }
    iteration = 0;
    timeStart = new Date();
}

function render() {
    const t = Math.sin((new Date() - timeStart) / 1000);
    iteration++;
    step = Math.max(1, step / 2);
    if (renderGl) {
        canvas.width = width;
        canvas.height = height;
        gl.uniform1f(tLocation, t);
        gl.viewport(0, 0, width, height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        return [width, height];
    } else {
        const r = Math.round(step);
        const imageWidth = Math.floor(width / r);
        const imageHeight = Math.floor(height / r);
        const imageData = context.createImageData(imageWidth, imageHeight);
        for (let i = 0; i < height; i += r) {
            for (let j = 0; j < width; j += r) {
                if (pixels[i][j] == null) {
                    pixels[i][j] = expr.eval(
                        (j / width) * 2 - 1,
                        (i / height) * 2 - 1,
                        t);
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
        return [imageWidth, imageHeight];
    }
}

onmessage = (event) => {
    if (event.data.type == "start") {
        canvas = event.data.canvas; 
        width = event.data.width; 
        height = event.data.height; 
        renderGl = event.data.renderGl; 
        setup(
            event.data.grammarText,
            event.data.depth,
            event.data.seed,
            event.data.exprText);
        // TODO: directly export as blob?
        postMessage({type: "expr", expr: expr.toString(), shader: shaderText});
    }
    if (event.data.type == "start" || event.data.type == "next") {
        const size = render();
        canvas.convertToBlob().then(blob => {
            postMessage({type: "progress", current: iteration, total: steps,
                blob: blob, width: size[0], height: size[1],
                elapsed: ((new Date()) - timeStart) / 1000});
        });
        if (hasTimeDependency) {
            function animateRender() {
                render();
                requestAnimationFrame(animateRender);
            }
            requestAnimationFrame(animateRender);
        }
    }
}
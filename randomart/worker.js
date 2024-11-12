// const maxDepth = 5;

// const grammarTextGradient = `
// E :: triple(C, C, C):1 | mix(C, C, C):1
// C :: sum(C, C):3 | mult(C, C):3 | A:2 | mix(C, C, C):3
// A :: rgb:1 | x:1 | y:1
// `;

// const grammarTextGeneral = `
// E :: triple(C, C, C):1 | sin(C):1
// C :: sum(C, C):3 | mult(C, C):3 | A:2 | mix(C, C, C):2 | mod(C, C):0.1 | sin(C):3 | cos(C):3 | exp(C):3 | sqrt(C):3 | level(C, C, C):0.1
// A :: bw:1 | rgb:1 | x:1 | y:1
// `;

// const grammarInterferences = `
// E :: triple(C, C, C):1 | mix(C, C, C):1
// C :: sum(C, C):2 | mult(C, C):2 | A:2 | mix(C, C, C):2 | sin(C):1 | sinbin(C, D):3 | sinbin(A, D):3
// D :: constant(10):1
// A :: bw:1 | rgb:1 | x:2 | y:2
// `;

// const grammarText = grammarTextGradient;

function nodeConstant(constant) {
    return {
        arity: 1,
        toString() {
            return `${constant}`;
        },
        eval(x, y) {
            return [constant, constant, constant];
        }
    }
}

function nodeBw() {
    const a = Math.random() * 2 - 1;
    return {
        arity: 0,
        toString() {
            return `${a}`;
        },
        eval(x, y) {
            return [a, a, a];
        }
    }
}

function nodeRgb() {
    const r = Math.random() * 2 - 1;
    const g = Math.random() * 2 - 1;
    const b = Math.random() * 2 - 1;
    return {
        arity: 0,
        toString() {
            return `(${r}, ${g}, ${b})`;
        },
        eval(x, y) {
            return [r, g, b];
        }
    }
}

function nodeX() {
    return {arity: 0, toString() {return `x`;}, eval(x, y, t) {return [x, x, x];}}
}

function nodeY() {
    return {arity: 0, toString() {return `y`;}, eval(x, y, t) {return [y, y, y];}}
}

function nodeUnary(subexpr, label, apply, min=-1, max=1) {
    return {
        arity: 1,
        toString() {
            return `${label}(${subexpr.toString()})`;
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

function nodeSin(subexpr) {
    const phase = Math.random() * Math.PI;
    const frequency = Math.random() * 5 + 1;
    return nodeUnary(subexpr, "sin", a => Math.sin(a * frequency + phase));
}

function nodeCos(subexpr) {
    const phase = Math.random() * Math.PI;
    const frequency = Math.random() * 5 + 1;
    return nodeUnary(subexpr, "sin", a => Math.cos(a * frequency + phase));
}

function nodeExp(subexpr) {
    return nodeUnary(subexpr, "exp", Math.exp, 0, Math.exp(1));
}

function nodeSqrt(subexpr) {
    return nodeUnary(subexpr, "sqrt", a => Math.sqrt((a + 1) / 2) * 2 - 1);
}

function nodeBinary(left, right, label, apply, min=-1, max=1) {
    return {
        arity: 2,
        toString() {
            return `${label}(${left.toString()}, ${right.toString()})`;
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
    return nodeBinary(left, right, "sum", (a, b) => a + b, -2, 2);
}

function nodeMult(left, right) {
    return nodeBinary(left, right, "mult", (a, b) => a * b);
}

function nodeMod(left, right) {
    return nodeBinary(left, right, "mod", (a, b) => b == 0 ? a : a % b);
}

function nodeSinBin(left, right) {
    return nodeBinary(left, right, "sin", (a, b) => Math.sin(a * b));
}

function nodeTriple(first, second, third) {
    return {
        arity: 3,
        toString() {
            return `(${first}, ${second}, ${third})`;
        },
        eval(x, y, t) {
            return [first.eval(x, y)[0], second.eval(x, y)[1], third.eval(x, y)[2]];
        }
    }
}

function nodeTernary(left, middle, right, label, apply, min=-1, max=1) {
    return {
        arity: 3,
        toString() {
            return `${label}(${left.toString()}, ${middle.toString()}, ${right.toString()})`;
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

function nodeLevel(left, middle, right) {
    const threshold = Math.random() * 2 - 1;
    return nodeTernary(left, middle, right, "level", (a, b, c) => a < threshold ? b : c);
}

function nodeMix(left, middle, right) {
    return nodeTernary(left, middle, right, "mix", (a, b, c) => {
        const w = (a + 1) / 2;
        return (1 - a) * b + a * c;
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
                case "x":
                    ruleNode = nodeX;
                    break;
                case "y":
                    ruleNode = nodeY;
                    break;
                case "constant":
                    ruleNode = nodeConstant;
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
    const nonce = Math.random();
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
    if (rule[0] == nodeConstant && rule[1].length == 1 && rule[1][0].match(/^\d(?:\.\d+)?/)) {
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

function getImageData(context, width, height, expr) {
    const imageData = context.createImageData(width, height);
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const k = (i * width + j) * 4;
            const color = expr.eval((j / width) * 2 - 1, (i / height) * 2 - 1);
            imageData.data[k + 0] = (color[0] + 1) * 128;
            imageData.data[k + 1] = (color[1] + 1) * 128;
            imageData.data[k + 2] = (color[2] + 1) * 128;
            imageData.data[k + 3] = 255;
        }
    }
    return imageData;
}


onmessage = (event) => {
    console.log("Received message from main thread:", event.data);
    const grammar = parseGrammar(event.data.grammarText); // TODO: handle errors
    const expr = expandGrammar(grammar, "E", event.data.depth); // TODO: handle errors
    postMessage({type: "expr", expr: expr.toString()});
    const context = event.data.canvas.getContext("2d");
    var iteration = 0;
    var scale = 1 / Math.min(event.data.width, event.data.height);
    const steps = Math.ceil(-Math.log2(scale));
    function render() {
        iteration++;
        scale *= 2;
        const width = Math.min(event.data.width, Math.ceil(event.data.width * scale));
        const height = Math.min(event.data.height, Math.ceil(event.data.height * scale));
        console.log(`#${iteration} Rendering size ${width}x${height}`);
        event.data.canvas.width = width;
        event.data.canvas.height = height;
        const imageData = getImageData(context, width, height, expr);
        context.putImageData(imageData, 0, 0);
        postMessage({type: "progress", current: iteration, total: steps});
        if (scale < 1) requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}
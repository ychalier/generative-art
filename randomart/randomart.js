window.addEventListener("load", () => {
    const params = new URLSearchParams(window.location.search);
    var seed = (params.has("seed") && params.get("seed").trim() != "") ? parseInt(params.get("seed")) : (Math.random()*2**32)>>>0;
    var depth = params.has("depth") ? parseInt(params.get("depth")) : 5;
    var grammarText = params.has("grammar") ? params.get("grammar") : `E :: triple(C, C, C):1 | mix(C, C, C):1
C :: sum(C, C):2 | mult(C, C):2 | A:2 | mix(C, C, C):2 | sin(C):1 | sinbin(C, D):3 | sinbin(A, D):3
D :: constant(10):1
A :: bw:1 | rgb:1 | x:2 | y:2`;
    const exprText = params.has("expr") ? params.get("expr") : undefined;

    document.querySelector("input[name=depth]").value = depth;
    document.querySelector("textarea[name=grammar]").value = grammarText;

    var exprString;
    var blob;

    document.getElementById("button-copy").addEventListener("click", event => {
        navigator.clipboard.writeText(exprString == undefined ? "" : exprString);
        showToast(event, "expression copied to clipboard");
    });

    document.getElementById("button-share").addEventListener("click", event => {
        const params = new URLSearchParams();
        if (exprString == undefined) {
            params.set("depth", depth);
            params.set("seed", seed);
            params.set("grammar", grammarText);
        } else {
            params.set("expr", exprString);
        }
        navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?" + params.toString());
        showToast(event, "link copied to clipboard");
    });

    function showToast(event, message) {
        const toast = document.body.appendChild(document.createElement("div"));
        toast.className = "toast";
        toast.textContent = message;
        toast.style.top = event.clientY + "px";
        toast.style.left = event.clientX + "px";
        const onMouseMove = (e) => {
            toast.style.top = e.clientY + "px";
            toast.style.left = e.clientX + "px";
        }
        window.addEventListener("mousemove", onMouseMove);
        setTimeout(() => {
            window.removeEventListener("mousemove", onMouseMove);
            document.body.removeChild(toast);
        }, 700);
    }

    document.getElementById("button-download").addEventListener("click", event => {
        const link = document.createElement("a");
        link.setAttribute("download", `randomart-${parseInt((new Date()) * 1)}.png`);
        link.href = URL.createObjectURL(blob);
        link.click();   
    });

    var worker;
    
    function createWorker() {
        worker = new Worker("worker.js");
        worker.onmessage = event => {
            switch(event.data.type) {
                case "expr":
                    exprString = event.data.expr;
                    const url = new URL(location.protocol + "//" + location.host + location.pathname + "?");
                    url.searchParams.set("expr", exprString);
                    window.history.replaceState("", "", url);
                    break;
                case "progress":
                    const progress = document.getElementById("progress");
                    progress.value = event.data.current;
                    progress.max = event.data.total;
                    progress.style.display = event.data.current == event.data.total ? "none": "unset";
                    blob = event.data.blob;
                    worker.postMessage({type: "next"});
                    break;
            }
        };
    }

    function startWorker(useExprText) {
        const domCanvas = document.createElement("canvas");
        domCanvas.setAttribute("id", "canvas");
        document.getElementById("canvas").replaceWith(domCanvas);
        const canvas = document.getElementById("canvas").transferControlToOffscreen();
        const args = {
            canvas: canvas,
            width: window.innerWidth,
            height: window.innerHeight,
            depth: depth,
            seed: seed,
            grammarText: grammarText,
            type: "start",
        };
        if (useExprText) {
            args.exprText = exprText;
        }
        worker.postMessage(args, [canvas]);
    }

    createWorker();
    startWorker(true);

    document.getElementById("dashboard-form").addEventListener("submit", event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        depth = parseFloat(formData.get("depth"));
        grammarText = formData.get("grammar");
        seed = (Math.random()*2**32)>>>0;
        worker.terminate();
        createWorker();
        startWorker(false);
    });

});

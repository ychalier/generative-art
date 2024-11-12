window.addEventListener("load", () => {
    const params = new URLSearchParams(window.location.search);
    const depth = params.has("depth") ? parseInt(params.get("depth")) : 5;
    const seed = (params.has("seed") && params.get("seed").trim() != "") ? parseInt(params.get("seed")) : (Math.random()*2**32)>>>0;
    const grammarText = params.has("grammar") ? params.get("grammar") : `E :: triple(C, C, C):1 | mix(C, C, C):1
C :: sum(C, C):2 | mult(C, C):2 | A:2 | mix(C, C, C):2 | sin(C):1 | sinbin(C, D):3 | sinbin(A, D):3
D :: constant(10):1
A :: bw:1 | rgb:1 | x:2 | y:2`;
    
    document.querySelector("input[name=depth]").value = depth;
    document.querySelector("textarea[name=grammar]").value = grammarText;
    
    document.getElementById("button-share").addEventListener("click", event => {
        const params = new URLSearchParams();
        params.set("depth", depth);
        params.set("seed", seed);
        params.set("grammar", grammarText);
        navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?" + params.toString());
        showToast(event, "link copied to clipboard");
    });

    document.getElementById("button-download").addEventListener("click", event => {
        const link = document.createElement("a");
        link.setAttribute("download", `randomart-${parseInt((new Date()) * 1)}.png`);
        link.href = document.getElementById("canvas").toDataURL("image/png");
        link.click();
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

    const canvas = document.getElementById("canvas").transferControlToOffscreen();
    
    let worker = new Worker("worker.js");
    
    worker.onmessage = event => {
        switch(event.data.type) {
            case "expr":
                console.log(event.data.expr);
                break;
            case "progress":
                const progress = document.getElementById("progress");
                progress.value = event.data.current;
                progress.max = event.data.total;
                progress.style.display = event.data.current == event.data.total ? "none": "unset";
                break;
        }
    };

    worker.postMessage({
        canvas: canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        depth: depth,
        seed: seed,
        grammarText: grammarText
    }, [canvas]);

});

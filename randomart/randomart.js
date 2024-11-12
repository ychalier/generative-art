window.addEventListener("load", () => {
    const params = new URLSearchParams(window.location.search);
    const depth = params.has("depth") ? parseInt(params.get("depth")) : 12;
    const grammarText = params.has("grammar") ? params.get("grammar") : `E :: triple(C, C, C):1 | mix(C, C, C):1
C :: sum(C, C):2 | mult(C, C):2 | A:2 | mix(C, C, C):2 | sin(C):1 | sinbin(C, D):3 | sinbin(A, D):3
D :: constant(10):1
A :: bw:1 | rgb:1 | x:2 | y:2`;
    document.querySelector("input[name=depth]").value = depth;
    document.querySelector("textarea[name=grammar]").value = grammarText;
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
        grammarText: grammarText
    }, [canvas]);
    
});

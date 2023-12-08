# Belousov-Zhabotinsky Cellular Automaton

[![](belousov-zhabotinsky.gif)](https://chalier.fr/generative-art/belousov-zhabotinsky/index.html)

[Checkout the demo here.](https://chalier.fr/generative-art/belousov-zhabotinsky/index.html)

## Description

The [Belousov-Zhabotinsky reaction](https://en.wikipedia.org/wiki/Belousov%E2%80%93Zhabotinsky_reaction) is a chemical reaction that naturally oscillates. Here is a video of [NileRed](https://www.youtube.com/c/NileRed) reproducing it: *[Recreating one of the weirdest reactions](https://www.youtube.com/watch?v=LL3kVtc-4vY)*. Even though the reaction looks really complex, it can be easilly simulated using a simple cellular automaton. The window is divided into a grid of cells. Each cell has `n` possible states, representing its degree of infection. At each step, the cell state evolves based on simple rules about its surroundings. The cell is then colored relatively to its state, which provokes the emergence of patterns!

You may find more details in an [Acerola](https://www.youtube.com/c/Acerola_t) video, *[Cellular Automata: Complexity From Simplicity](https://www.youtube.com/watch?v=t_HcBAO_Yas)*.

## Demo Parameters

You may specify the following settings as GET parameters:

Parameter | Default | Description
--------- | ------- | -----------
`n` | 119 | Maximum number of states for each cell.
`g` | 15.2 | Constant infection rate.
`k1` | 1.4 | Infection rate from infected (current state lower than `n`) neighbors.
`k2` | 0.7 | Infection rate from ill (current state equal to `n`) neighbors.
`surface` | 30000 | Approximate number of cells on screen, greatly impacts performances.
`fps` | 60 | Target animation FPS.
`color_fill_1` | #062a37 | Dark filling color.
`color_fill_2` | #16485a | Light filling color.
`color_edge_1` | #cb0a1f | Edge color.
`color_edge_2` | #000000 | Edge color modification.

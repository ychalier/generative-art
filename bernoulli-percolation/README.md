# Bernoulli Percolation

[![](bernoulli-percolation.gif)](https://ychalier.github.io/generative-art/bernoulli-percolation/index.html)

[Checkout the demo here.](https://ychalier.github.io/generative-art/bernoulli-percolation/index.html)

## Description

The [Bernoulli percolation](https://en.wikipedia.org/wiki/Percolation_theory) is the model that first introduced the notion of percolation in a network. It is a type of behavior which exhibits a phase transition.

The canvas is a grid of pixels. Each pixel is a node in a graph, connected to its four surroundings neighbors. Each edge is given a random weight between 0 and 1. Given a threshold *p*, any edge above that threshold is considered missing. For instance, if *p* is zero, then every node is isolated. Each connected component of the graph shares the same color (which justifies the use of the term *percolation*: it is as if edges were pipes connecting nodes together, through which colored water would flow, as coffee spreading through the graph).

The animation is created by controlling the threshold *p* with an oscillating signal.

You may find more details in an [Spectral Collective](https://www.youtube.com/@SpectralCollective) video, *[Percolation: a Mathematical Phase Transition](https://www.youtube.com/watch?v=a-767WnbaCQ)*.

## Demo Parameters

You may specify the following settings as GET parameters:

Parameter | Default | Description
--------- | ------- | -----------
`surface` | 30000 | Approximate number of cells on screen, greatly impacts performances.
`fps` | 60 | Target animation FPS.
`period` | 10 | Period (in seconds) of an oscillation
`color` | `rgb` | Random color generation method. Either `rgb` (random RGB color), `hue` (saturated colors only), `bw` (black and white), `r` (nuances of red), `g` (nuances of green) or `b` (nuances of blue).
`signal` | `triangle` | Oscillation signal. Either `cos` (default cosinus), `triangle` (approximate triangle) or `saw` (sawtooth wave).

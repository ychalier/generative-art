# Molnart

[![](molnart.gif)](https://ychalier.github.io/generative-art/molnart/index.html)

[Checkout the demo here.](https://ychalier.github.io/generative-art/molnart/index.html)

## Description

[Vera Molnár](https://en.wikipedia.org/wiki/Vera_Moln%C3%A1r) is a French artist working on computer art and generative art ever since computers and displays or plotters existed. She developped a program called [Molnart](http://www.veramolnar.com/blog/wp-content/uploads/VM1976_molnart.pdf) (junction of "Molnár" and "art") that draws squares trying to simulate a human doing it, with small errors here and there. She was interviewed by the Franco-German channel Arte for [Tracks](https://www.youtube.com/c/TRACKSARTEFr) where she talks more about her work: *[Du pinceau à l'informatique : Vera Molnar révolutionne l'art !](https://www.youtube.com/watch?v=ElKNKxWrXk8)*



## Demo Parameters

You may specify the following settings as GET parameters:

Parameter | Default | Description
--------- | ------- | -----------
`number_of_starting_squares` | 5 | Number of intricated squares per region.
`deletion_factor` | 0.3 | Probability factor for square deletion based on its relative size.
`deletion_power` | 1 | Probability power for square deletion based on its relative size.
`human_error_factor` | 4 | Slight vertices offset at start.
`human_error_power` | 2 | Slight vertices offset at start.
`width_factor` | 0.08 | Probability factor for square line width based on its relative size.
`width_power` | 0 | Probability power for square line width based on its relative size.
`width_intercept` | 0.05 | Probability constant for square line width based on its relative size.
`edge_removal_probability` | 0 | Probability of deletion for every edges.
`region_size` | 100 | Region size in pixels.
`square_appearance_probability` | 0.01 | Probability of a square appearing.
`square_disappearance_probability` | 0.015 | Probability of a square disappearing.
`colors` | #000000,#fffffc,#beb7a4,#ff7f11,#ff3f00 | Color palette that squares go through.


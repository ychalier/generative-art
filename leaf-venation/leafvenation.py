import random
from PIL import Image, ImageDraw
from tqdm import tqdm
import rtree

# https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.Voronoi.html


class Vec2:

    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

    def __eq__(self, value: object) -> bool:
        if not isinstance(value, Vec2):
            return False
        return self.x == value.x and self.y == value.y
    
    def __hash__(self):
        return hash((self.x, self.y))

    def __add__(self, value: object):
        if not isinstance(value, Vec2):
            raise ValueError(value)
        return Vec2(self.x + value.x, self.y + value.y)

    def __sub__(self, other: "Vec2"):
        return Vec2(self.x - other.x, self.y - other.y)

    def __rmul__(self, alpha: float):
        return Vec2(alpha * self.x, alpha * self.y)
    
    def __truediv__(self, value: object):
        if isinstance(value, int) or isinstance(value, float):
            return Vec2(self.x / value, self.y / value)
        raise ValueError(value)
    
    def __repr__(self):
        return f"({self.x}, {self.y})"

    @property
    def norm(self) -> float:
        return (self.x * self.x + self.y * self.y) ** .5

    def copy(self) -> "Vec2":
        return Vec2(self.x, self.y)
    
    def normalized(self) -> "Vec2":
        norm_ = self.norm
        assert norm_ > 0
        return Vec2(self.x / norm_, self.y / norm_)

    def distance(self, other: "Vec2") -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** .5



width, height = 3200, 3200
birth_distance_auxin_source = 10
birth_distance_vein_node = birth_distance_auxin_source
kill_distance = 20
rho = 600e-6
d = 1
width_pow = 3
initial_leaf_radius = 270
end_leaf_radius = 1600
delta_l = 8

origin = Vec2(.5 * width, .5 * height)

vein_nodes: dict[int, Vec2] = {0: origin.copy()}
ppties = rtree.index.Property()
ppties.dimension = 2
vein_nodes_index = rtree.index.Index(properties=ppties)
vein_nodes_index.insert(0, (origin.x, origin.y, origin.x, origin.y))
auxin_sources: dict[int, Vec2] = {}
auxin_sources_index = rtree.index.Index(properties=ppties)
parents: dict[int, int | None] = {0: None}
edges: list[tuple[int, int]] = []
auxin_source_counter = 0
vein_nodes_counter = 1


# leaf_contour = [
#     [Vec2(915.19414, 590.79297), Vec2(877.32251, 634.44264), Vec2(876.78729, 684.61474)],
#     [Vec2(876.25208, 734.78683), Vec2(901.32777, 738.38129), Vec2(923.73855, 750.94703)],
#     [Vec2(936.75904, 758.24763), Vec2(936.00370, 765.14159), Vec2(949.12498, 765.14159)],
#     [Vec2(962.14652, 765.14159), Vec2(957.81782, 760.59050), Vec2(969.59790, 754.49567)],
#     [Vec2(988.10442, 744.92070), Vec2(1018.6211, 716.52799), Vec2(1018.7329, 685.70663)],
#     [Vec2(1018.8447, 654.88526), Vec2(985.72535, 590.84338), Vec2(949.94389, 552.49611)],
# ]
# leaf_origin = Vec2(949, 762)


# Pre-compute auxin sources for marginal growth
area = width * height
ndarts = int(area * rho) + 1
precomputed_auxin_sources: list[Vec2] = []
for _ in range(ndarts):
    p = Vec2(random.random() * width, random.random() * height)
    if precomputed_auxin_sources:
        valid = True
        for q in precomputed_auxin_sources:
            if p.distance(q) < birth_distance_auxin_source:
                valid = False
                break
        if not valid:
            continue
    precomputed_auxin_sources.append(p)


niters = 1000

leaf_radius = initial_leaf_radius
pbar = tqdm(range(niters))
try:
    for _ in pbar:

        pbar.set_postfix({
            "auxin_sources": len(auxin_sources),
            "vein_nodes": len(vein_nodes),
        })
        
        influences: dict[int, list[int]] = {}
        for j, p in auxin_sources.items():
            i = list(vein_nodes_index.nearest((p.x, p.y, p.x, p.y), 1))[0]
            influences.setdefault(i, [])
            influences[i].append(j)

        added_vein_nodes = 0
        for i, qs in influences.items():
            p = vein_nodes[i]
            if not qs:
                continue
            dp = Vec2(0, 0)
            for j in qs:
                q = auxin_sources[j]
                dp += (q - p).normalized()
            r = p + (d / len(qs)) * dp
            
            # if r.distance(vein_nodes[list(vein_nodes_index.nearest((r.x, r.y, r.x, r.y), 1))[0]]) < .1*d:
            #     continue

            edges.append((i, vein_nodes_counter))
            parents[vein_nodes_counter] = i
            vein_nodes[vein_nodes_counter] = r
            vein_nodes_index.insert(vein_nodes_counter, (r.x, r.y, r.x, r.y))
            vein_nodes_counter += 1
            added_vein_nodes += 1
        
        # print(len(auxin_sources), added_vein_nodes)

        for i, p in list(auxin_sources.items()):
            j = next(vein_nodes_index.nearest((p.x, p.y, p.x, p.y), 1))
            q = vein_nodes[j]
            if p.distance(q) < kill_distance:
                del auxin_sources[i]
                auxin_sources_index.delete(i, (p.x, p.y, p.x, p.y))
        
        # Generate new auxin sources
        # area = 3.14159 * (leaf_radius ** 2)
        # ndarts = int(area * rho) + 1
        # for _ in range(ndarts):
        #     p = Vec2(random.random() * width, random.random() * height)
        #     if p.distance(origin) > leaf_radius:
        #         continue
        #     if auxin_sources:
        #         i = list(auxin_sources_index.nearest((p.x, p.y, p.x, p.y), 1))[0]
        #         q = auxin_sources[i]
        #         if p.distance(q) < birth_distance_auxin_source:
        #             continue
        #     if vein_nodes:
        #         i = list(vein_nodes_index.nearest((p.x, p.y, p.x, p.y), 1))[0]
        #         q = vein_nodes[i]
        #         if p.distance(q) < birth_distance_vein_node:
        #             continue
        #     auxin_sources_index.insert(auxin_source_counter, (p.x, p.y, p.x, p.y))
        #     auxin_sources[auxin_source_counter] = p
        #     auxin_source_counter += 1

        old_radius = leaf_radius
        leaf_radius = min(end_leaf_radius, leaf_radius + delta_l)

        for p in precomputed_auxin_sources:
            distance = p.distance(origin)
            if distance > old_radius and distance <= leaf_radius:
                auxin_sources_index.insert(auxin_source_counter, (p.x, p.y, p.x, p.y))
                auxin_sources[auxin_source_counter] = p
                auxin_source_counter += 1
        
                    
except KeyboardInterrupt:
    pbar.close()

vein_widths = [0 for _ in vein_nodes]
for i in range(len(vein_nodes) - 1, -1, -1):
    if vein_widths[i] == 0:
        vein_widths[i] = 1
    else:
        vein_widths[i] = vein_widths[i] ** (1/width_pow)
    j = parents[i]
    if j is None:
        continue
    vein_widths[j] += vein_widths[i] ** width_pow

# weighted_edges: dict[float, list[tuple[int, int]]] = {}
# for i, j in edges:
#     u, v = vein_nodes[i], vein_nodes[j]
#     w = round(min(vein_widths[i], vein_widths[j]), 0)
#     weighted_edges.setdefault(w, [])
#     weighted_edges[w].append((i, j))


for i in range(len(vein_widths)):
    vein_widths[i] = round(vein_widths[i], 1)

vein_widths_dict: dict[float, list[int]] = {}
for i, vein_width in enumerate(vein_widths):
    vein_widths_dict.setdefault(vein_width, [])
    vein_widths_dict[vein_width].append(i)


parents_dict = {i: j for i, j in parents.items()}




with open("venation.svg", "w") as file:
    file.write(f"""<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">""")
    file.write(f"""<g stroke="black" fill="none" stroke-linejoin="round">""")
    for w, vein_ids in vein_widths_dict.items():
        reached = set()
        concerned_parents = [j for i, j in parents_dict.items() if i in vein_ids]
        leaf_nodes = set(parents_dict.keys()).difference(concerned_parents)
        for leaf in leaf_nodes.intersection(vein_ids):
            assert leaf is not None
            i = leaf
            u = vein_nodes[i]
            file.write(f"""<path stroke-width="{w}" d="M {u.x} {u.y} """)
            while True:
                i = parents_dict[i]
                if i is None:
                    break
                u = vein_nodes[i]
                file.write(f"""L {u.x} {u.y} """)
                if i in reached:
                    break
                if vein_widths[i] != w:
                    break
                reached.add(i)
            file.write("\" />")


    # for w, wedges in weighted_edges.items():
    #     file.write(f"""<path stroke="black" stroke-width="{w}" d=" """)
    #     for i, j in wedges:
    #         u, v = vein_nodes[i], vein_nodes[j]
    #         file.write(f"""M {u.x} {v.y} L {v.x} {v.y}""")
    #     file.write("\" />")

    # last_v = last_w = None
    # edges.sort()
    # for i, j in edges:
    #     i, j = sorted([i, j])
    #     u, v = vein_nodes[i], vein_nodes[j]
    #     w = round(min(vein_widths[i], vein_widths[j]), 0)
    #     if u == last_v and w == last_w:
    #         print("Continuation!")
    #         file.write(f"""L {u.x} {u.y}""")
    #     else:
    #         if last_v is not None:
    #             file.write("\"/>")
    #         file.write(f"""<path stroke="black" stroke-width="{w}" d="M {u.x} {u.y} L {v.x} {v.y} """)
    #     last_v = u
    #     last_w = w
    #     # file.write(f"""<g stroke="black" stroke-width="{w}">""")
    #     # file.write(f"""<line x1="{u.x}" y1="{u.y}" x2="{v.x}" y2="{v.y}" />""")
    #     # file.write(f"""</g>""")
    file.write(f"</g>")
    file.write(f"</svg>")


# image = Image.new("RGB", (width, height), (255, 255, 255))
# draw = ImageDraw.Draw(image)
# for i, j in edges:
#     u, v = vein_nodes[i], vein_nodes[j]
#     draw.line(((u.x, u.y), (v.x, v.y)), (0, 0, 0), width=round(min(vein_widths[i], vein_widths[j])))
# for p in auxin_sources.values():
#     draw.circle((p.x, p.y), 2, (255, 0, 0))
# image.show()


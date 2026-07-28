import numpy as np

from ifc_geometry import Mesh


def unit_cube() -> Mesh:
    verts = np.array([
        [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
        [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
    ], dtype=np.float64)
    # 12 triangles, outward-facing winding, covering all 6 faces of the cube
    faces = np.array([
        [0, 2, 1], [0, 3, 2],  # bottom (z=0)
        [4, 5, 6], [4, 6, 7],  # top (z=1)
        [0, 1, 5], [0, 5, 4],  # y=0
        [2, 3, 7], [2, 7, 6],  # y=1
        [1, 2, 6], [1, 6, 5],  # x=1
        [0, 4, 7], [0, 7, 3],  # x=0
    ])
    return Mesh(verts=verts, faces=faces)

"""Low-level geometry loading and raw mesh metrics for a single IFC element."""
from __future__ import annotations

from dataclasses import dataclass

import ifcopenshell
import ifcopenshell.geom
import numpy as np
from scipy.spatial import ConvexHull, QhullError

_SETTINGS = ifcopenshell.geom.settings()
_SETTINGS.set(_SETTINGS.USE_WORLD_COORDS, True)

EPS = 1e-9


@dataclass
class Mesh:
    verts: np.ndarray  # (N, 3)
    faces: np.ndarray  # (M, 3) triangle vertex indices


def get_single_element(ifc_file: ifcopenshell.file) -> ifcopenshell.entity_instance:
    """Each IFCNetCoreIFC file contains exactly one IfcElement instance."""
    elements = ifc_file.by_type("IfcElement")
    if len(elements) != 1:
        raise ValueError(f"expected exactly 1 IfcElement, found {len(elements)}")
    return elements[0]


def load_mesh(element: ifcopenshell.entity_instance) -> Mesh:
    shape = ifcopenshell.geom.create_shape(_SETTINGS, element)
    verts = np.asarray(shape.geometry.verts, dtype=np.float64).reshape(-1, 3)
    faces = np.asarray(shape.geometry.faces, dtype=np.int64).reshape(-1, 3)
    return Mesh(verts=verts, faces=faces)


def triangle_areas(mesh: Mesh) -> np.ndarray:
    v0 = mesh.verts[mesh.faces[:, 0]]
    v1 = mesh.verts[mesh.faces[:, 1]]
    v2 = mesh.verts[mesh.faces[:, 2]]
    return 0.5 * np.linalg.norm(np.cross(v1 - v0, v2 - v0), axis=1)


def surface_area(mesh: Mesh) -> float:
    return float(triangle_areas(mesh).sum())


def signed_volume(mesh: Mesh) -> float:
    """Divergence-theorem volume of the (assumed closed) triangle mesh."""
    v0 = mesh.verts[mesh.faces[:, 0]]
    v1 = mesh.verts[mesh.faces[:, 1]]
    v2 = mesh.verts[mesh.faces[:, 2]]
    return float(np.einsum("ij,ij->i", v0, np.cross(v1, v2)).sum() / 6.0)


def convex_hull_volume_area(points: np.ndarray) -> tuple[float, float]:
    """3D convex hull volume and surface area. Falls back to (0, 0) on degenerate input."""
    try:
        hull = ConvexHull(points)
    except QhullError:
        return 0.0, 0.0
    return float(hull.volume), float(hull.area)


def convex_hull_area_2d(points_xy: np.ndarray) -> float:
    """Area of the 2D convex hull (footprint)."""
    try:
        hull = ConvexHull(points_xy)
    except QhullError:
        return 0.0
    return float(hull.volume)  # in 2D, ConvexHull.volume is the enclosed area


def convex_hull_perimeter_2d(points_xy: np.ndarray) -> float:
    """Perimeter of the 2D convex hull (footprint outline length)."""
    try:
        hull = ConvexHull(points_xy)
    except QhullError:
        return 0.0
    ring = points_xy[hull.vertices]
    ring = np.vstack([ring, ring[:1]])
    return float(np.linalg.norm(np.diff(ring, axis=0), axis=1).sum())


def pca_axes(points: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Principal axes (columns, unit vectors) of a point set and the point-set extent
    (max-min) projected onto each axis, sorted descending (axes[:, 0] = longest)."""
    centroid = points.mean(axis=0)
    centered = points - centroid
    cov = np.cov(centered, rowvar=False)
    eigvals, eigvecs = np.linalg.eigh(cov)
    order = np.argsort(eigvals)[::-1]
    eigvecs = eigvecs[:, order]
    projected = centered @ eigvecs
    extents = projected.max(axis=0) - projected.min(axis=0)
    return eigvecs, extents


def project_onto_axes(points: np.ndarray, axes: np.ndarray) -> np.ndarray:
    """Coordinates of `points` in the (centroid-centered) principal-axis frame."""
    centroid = points.mean(axis=0)
    return (points - centroid) @ axes


def cross_section_profile(points: np.ndarray, axes: np.ndarray, n_bins: int = 20) -> np.ndarray:
    """Slice the point cloud into `n_bins` bands along the major axis (axes[:, 0])
    and, for each band, estimate the cross-section "area" as the product of the
    point spread along the two remaining axes. A prismatic element (constant
    cross-section, e.g. a beam or an extruded wall/slab) yields a near-constant
    profile; a stepped element (e.g. a stair) yields a strongly varying one."""
    proj = project_onto_axes(points, axes)
    main = proj[:, 0]
    lo, hi = main.min(), main.max()
    if hi - lo < EPS:
        return np.array([])
    edges = np.linspace(lo, hi, n_bins + 1)
    sizes = []
    for i in range(n_bins):
        mask = (main >= edges[i]) & (main <= edges[i + 1])
        if mask.sum() < 3:
            continue
        ext_a = proj[mask, 1].max() - proj[mask, 1].min()
        ext_b = proj[mask, 2].max() - proj[mask, 2].min()
        sizes.append(max(ext_a, EPS) * max(ext_b, EPS))
    return np.array(sizes)

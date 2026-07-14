"""Feature engineering for structural IFC elements (Beam, Slab, Stair, Wall).

All features are derived purely from element geometry (world-coordinate
triangle mesh), so they are independent of the (possibly wrong) IFC entity
type stored in the file. IFC world coordinates reliably encode the true
vertical (gravity) direction as global Z, so a handful of "gravity-aware"
features are included alongside orientation-invariant shape descriptors.
"""
from __future__ import annotations

import numpy as np
from scipy.signal import find_peaks

from ifc_geometry import (
    Mesh,
    EPS,
    convex_hull_area_2d,
    convex_hull_perimeter_2d,
    convex_hull_volume_area,
    cross_section_profile,
    pca_axes,
    signed_volume,
    surface_area,
    triangle_areas,
)

UP = np.array([0.0, 0.0, 1.0])


def extract_features(mesh: Mesh) -> dict:
    verts = mesh.verts
    faces = mesh.faces
    n_vertices = verts.shape[0]
    n_faces = faces.shape[0]

    # --- raw size / mass properties -----------------------------------
    area = surface_area(mesh)
    volume = abs(signed_volume(mesh))
    hull_volume, hull_area = convex_hull_volume_area(verts)

    bbox_min = verts.min(axis=0)
    bbox_max = verts.max(axis=0)
    bbox_dims = bbox_max - bbox_min  # (dx, dy, dz), axis-aligned
    bbox_volume = float(np.prod(bbox_dims))

    # --- orientation-invariant shape descriptors (3D PCA) --------------
    # L1 >= L2 >= L3: extents of the point cloud along its principal axes.
    axes, extents = pca_axes(verts)
    L1, L2, L3 = (float(x) for x in np.clip(extents, EPS, None))

    elongation = L1 / L2               # rod-like (beam) when large
    flatness = L2 / L3                 # plate-like (slab/wall) when large
    linearity = 1.0 - L2 / L1          # ~1 for a thin rod
    planarity = (L2 - L3) / L1         # ~1 for a thin plate
    sphericity = L3 / L1               # ~1 for a blocky/cubic element

    # --- classic structural slenderness ---------------------------------
    # Treat the element as prismatic along its longest axis: cross-section
    # area A = volume / length, equivalent radius of gyration i = sqrt(A/pi),
    # slenderness ratio lambda = L / i  (same idea as beam/column slenderness).
    equiv_cross_section_area = volume / L1
    equiv_radius_of_gyration = np.sqrt(max(equiv_cross_section_area, EPS) / np.pi)
    slenderness_ratio = L1 / max(equiv_radius_of_gyration, EPS)

    # --- shape "quality" ratios ------------------------------------------
    rectangularity = volume / max(bbox_volume, EPS)          # bbox packing
    convexity = volume / max(hull_volume, EPS)                # 1 = fully convex
    convexity = float(np.clip(convexity, 0.0, 1.5))
    compactness = (area ** 1.5) / max(volume, EPS)             # isoperimetric-like
    specific_surface = area / max(volume, EPS)                 # "bulkiness"
    mesh_complexity = n_faces / max(area, EPS)                 # facets per unit area

    # --- gravity-aware features (global Z is a reliable "up") ------------
    vertical_extent = float(bbox_dims[2])
    xy = verts[:, :2]
    _, xy_extents = pca_axes(np.c_[xy, np.zeros(len(xy))])
    horizontal_major = float(max(xy_extents[0], EPS))
    horizontal_minor = float(max(xy_extents[1], EPS))
    horizontal_aspect_ratio = horizontal_major / horizontal_minor
    footprint_area = convex_hull_area_2d(xy)

    verticality_ratio = vertical_extent / max(horizontal_major, EPS)
    thickness_to_span_ratio = L3 / max(L1, EPS)

    # alignment of each principal axis with global "up"
    axis_z_alignment = np.abs(axes.T @ UP)  # shape (3,), one per principal axis
    max_axis_verticality = float(axis_z_alignment.max())

    # incline of the element's own long (major) axis vs. the horizontal plane:
    # 0 deg = lying flat/horizontal (typical beam), 90 deg = standing vertical
    # (typical wall); stair flights fall in between.
    incline_angle_deg = float(np.degrees(np.arcsin(np.clip(axis_z_alignment[0], 0.0, 1.0))))

    # footprint (XY projection) shape: perimeter and isoperimetric compactness.
    # compactness -> 1 for a compact/round footprint, -> 0 for a long thin strip
    # (typical of a wall segment) or a long thin rectangle (typical of a beam).
    footprint_perimeter = convex_hull_perimeter_2d(xy)
    footprint_compactness = float(
        np.clip(4 * np.pi * footprint_area / max(footprint_perimeter ** 2, EPS), 0.0, 1.0)
    )

    # --- cross-section uniformity along the element's major axis ---------
    # A prismatic element (beam, extruded wall/slab) keeps a near-constant
    # cross-section along its length -> low coefficient of variation. A
    # stepped element (stair) does not -> high coefficient of variation.
    profile = cross_section_profile(verts, axes)
    if len(profile) >= 2 and profile.mean() > EPS:
        cross_section_area_cv = float(profile.std() / profile.mean())
    else:
        cross_section_area_cv = 0.0

    # --- stair-step proxy: count z-banded clusters of triangle area -----
    step_count = _estimate_step_count(mesh)

    return {
        "n_vertices": n_vertices,
        "n_faces": n_faces,
        "surface_area_m2": area,
        "volume_m3": volume,
        "hull_volume_m3": hull_volume,
        "hull_area_m2": hull_area,
        "bbox_dx_m": float(bbox_dims[0]),
        "bbox_dy_m": float(bbox_dims[1]),
        "bbox_dz_m": float(bbox_dims[2]),
        "bbox_volume_m3": bbox_volume,
        "pca_L1_m": L1,
        "pca_L2_m": L2,
        "pca_L3_m": L3,
        "elongation": elongation,
        "flatness": flatness,
        "linearity_index": linearity,
        "planarity_index": planarity,
        "sphericity_index": sphericity,
        "equiv_cross_section_area_m2": equiv_cross_section_area,
        "equiv_radius_of_gyration_m": equiv_radius_of_gyration,
        "slenderness_ratio": slenderness_ratio,
        "rectangularity": rectangularity,
        "convexity": convexity,
        "compactness": compactness,
        "specific_surface": specific_surface,
        "mesh_complexity": mesh_complexity,
        "vertical_extent_m": vertical_extent,
        "horizontal_major_m": horizontal_major,
        "horizontal_minor_m": horizontal_minor,
        "horizontal_aspect_ratio": horizontal_aspect_ratio,
        "footprint_area_m2": footprint_area,
        "verticality_ratio": verticality_ratio,
        "thickness_to_span_ratio": thickness_to_span_ratio,
        "max_axis_verticality": max_axis_verticality,
        "incline_angle_deg": incline_angle_deg,
        "footprint_perimeter_m": footprint_perimeter,
        "footprint_compactness": footprint_compactness,
        "cross_section_area_cv": cross_section_area_cv,
        "step_count_proxy": step_count,
    }


def _estimate_step_count(mesh: Mesh, n_bins: int = 80) -> int:
    """Proxy for the number of stair treads/risers: bin triangle area by the
    z-height of its centroid, then count local-maxima clusters in the
    resulting area-vs-height profile (flat treads/risers concentrate area
    into narrow height bands; a smooth prismatic element does not)."""
    verts = mesh.verts
    faces = mesh.faces
    z_min, z_max = verts[:, 2].min(), verts[:, 2].max()
    if z_max - z_min < EPS:
        return 0
    centroid_z = verts[faces].mean(axis=1)[:, 2]
    areas = triangle_areas(mesh)
    hist, _ = np.histogram(centroid_z, bins=n_bins, range=(z_min, z_max), weights=areas)
    if hist.max() <= 0:
        return 0
    hist = hist / hist.max()
    peaks, _ = find_peaks(hist, height=0.15, distance=2)
    return int(len(peaks))

import math

import pytest

from feature_engineering import extract_features
from helpers import unit_cube


def test_extract_features_unit_cube_shape_descriptors():
    feats = extract_features(unit_cube())

    assert feats["n_vertices"] == 8
    assert feats["n_faces"] == 12
    assert feats["volume_m3"] == 1.0
    assert feats["surface_area_m2"] == 6.0
    # a cube is fully convex: volume == hull volume
    assert feats["convexity"] == pytest.approx(1.0, abs=1e-6)
    # a cube is not rod- or plate-like: low linearity/planarity, high sphericity
    assert feats["sphericity_index"] == pytest.approx(1.0, abs=1e-6)
    assert feats["linearity_index"] == pytest.approx(0.0, abs=1e-6)


def test_extract_features_all_values_finite():
    feats = extract_features(unit_cube())
    for key, value in feats.items():
        assert math.isfinite(value), f"{key} is not finite: {value}"


def test_extract_features_expected_keys():
    feats = extract_features(unit_cube())
    expected = {
        "n_vertices", "n_faces", "surface_area_m2", "volume_m3", "hull_volume_m3",
        "hull_area_m2", "bbox_dx_m", "bbox_dy_m", "bbox_dz_m", "bbox_volume_m3",
        "pca_L1_m", "pca_L2_m", "pca_L3_m", "elongation", "flatness",
        "linearity_index", "planarity_index", "sphericity_index",
        "equiv_cross_section_area_m2", "equiv_radius_of_gyration_m",
        "slenderness_ratio", "rectangularity", "convexity", "compactness",
        "specific_surface", "mesh_complexity", "vertical_extent_m",
        "horizontal_major_m", "horizontal_minor_m", "horizontal_aspect_ratio",
        "footprint_area_m2", "verticality_ratio", "thickness_to_span_ratio",
        "max_axis_verticality", "incline_angle_deg", "footprint_perimeter_m",
        "footprint_compactness", "cross_section_area_cv", "step_count_proxy",
    }
    assert set(feats.keys()) == expected

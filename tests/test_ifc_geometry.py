import numpy as np
import pytest

from helpers import unit_cube
from ifc_geometry import pca_axes, signed_volume, surface_area


def test_surface_area_unit_cube():
    assert surface_area(unit_cube()) == pytest.approx(6.0)


def test_signed_volume_unit_cube():
    assert abs(signed_volume(unit_cube())) == pytest.approx(1.0)


def test_pca_axes_axis_aligned_box():
    verts = np.array([
        [0, 0, 0], [4, 0, 0], [4, 2, 0], [0, 2, 0],
        [0, 0, 1], [4, 0, 1], [4, 2, 1], [0, 2, 1],
    ], dtype=np.float64)
    _, extents = pca_axes(verts)
    # sorted descending: 4 (x), 2 (y), 1 (z)
    assert extents[0] == pytest.approx(4.0, abs=1e-6)
    assert extents[1] == pytest.approx(2.0, abs=1e-6)
    assert extents[2] == pytest.approx(1.0, abs=1e-6)

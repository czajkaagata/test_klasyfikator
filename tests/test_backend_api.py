from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import app

ROOT = Path(__file__).parent.parent
SAMPLE_IFC = next((ROOT / "data" / "raw" / "IFCNetCoreIFC" / "IfcBeam" / "test").glob("*.ifc"), None)

client = TestClient(app)


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["model"] == "random_forest"
    assert set(body["classes"]) == {"Beam", "Slab", "Stair", "Wall"}


def test_classify_rejects_non_ifc_file():
    resp = client.post(
        "/api/classify",
        files={"file": ("notes.txt", b"not an ifc file", "text/plain")},
    )
    assert resp.status_code == 400


@pytest.mark.skipif(SAMPLE_IFC is None, reason="IFCNetCoreIFC dataset not present locally")
def test_classify_real_ifc_file():
    with open(SAMPLE_IFC, "rb") as f:
        resp = client.post(
            "/api/classify",
            files={"file": (SAMPLE_IFC.name, f, "application/octet-stream")},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["candidateCount"] >= 1
    assert "elements" in body
    first = body["elements"][0]
    assert first["suggestedType"] in {"IfcBeam", "IfcSlab", "IfcStair", "IfcWall"}

"""FastAPI backend for the IFC Classifier review app.

Wraps the Random Forest trained in `02_train_classifiers.ipynb`: given an
uploaded (real, multi-element) .ifc file, scores every Beam/Slab/Stair/Wall
(or generic IfcBuildingElementProxy) candidate element from its geometry
alone and reports whether the type stored in the file looks right.

Run with:
    .venv\\Scripts\\uvicorn backend.app:app --reload --port 8000
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import ifcopenshell
import joblib
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from feature_engineering import extract_features  # noqa: E402
from ifc_geometry import iter_candidate_elements, load_mesh  # noqa: E402

MODELS_DIR = ROOT / "models"
LABEL_TO_IFC_CLASS = {"Beam": "IfcBeam", "Slab": "IfcSlab", "Stair": "IfcStair", "Wall": "IfcWall"}

rf = joblib.load(MODELS_DIR / "random_forest.joblib")
feature_cols: list[str] = joblib.load(MODELS_DIR / "feature_cols.joblib")

app = FastAPI(title="IFC Classifier API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": "random_forest",
        "classes": sorted(rf.classes_.tolist()),
        "featureCount": len(feature_cols),
    }


@app.post("/api/classify")
async def classify(file: UploadFile = File(...)) -> dict:
    if not file.filename or not file.filename.lower().endswith(".ifc"):
        raise HTTPException(400, "Oczekiwano pliku z rozszerzeniem .ifc")

    payload = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".ifc", delete=False) as tmp:
        tmp.write(payload)
        tmp_path = Path(tmp.name)

    try:
        try:
            ifc_file = ifcopenshell.open(str(tmp_path))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, f"Nie udalo sie odczytac pliku IFC: {exc}") from exc

        elements_out = []
        failed = 0
        for element in iter_candidate_elements(ifc_file):
            try:
                mesh = load_mesh(element)
                feats = extract_features(mesh)
            except Exception:  # noqa: BLE001
                failed += 1
                continue

            row = np.array([[feats[c] for c in feature_cols]])
            proba = rf.predict_proba(row)[0]
            best_idx = int(proba.argmax())
            predicted_label = str(rf.classes_[best_idx])
            confidence = float(proba[best_idx])
            stored_type = element.is_a()
            suggested_type = LABEL_TO_IFC_CLASS[predicted_label]

            elements_out.append({
                "expressId": element.id(),
                "guid": element.GlobalId,
                "name": element.Name or stored_type,
                "currentType": stored_type,
                "suggestedType": suggested_type,
                "mismatch": stored_type != suggested_type,
                "confidence": round(confidence, 4),
                "probabilities": {
                    str(cls): round(float(p), 4) for cls, p in zip(rf.classes_, proba)
                },
            })
    finally:
        tmp_path.unlink(missing_ok=True)

    # most actionable first: mismatches, most confident first
    elements_out.sort(key=lambda e: (not e["mismatch"], -e["confidence"]))

    return {
        "fileName": file.filename,
        "candidateCount": len(elements_out),
        "failedCount": failed,
        "mismatchCount": sum(1 for e in elements_out if e["mismatch"]),
        "elements": elements_out,
    }

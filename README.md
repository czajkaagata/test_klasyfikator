# IFC entity-type QA (Beam / Slab / Stair / Wall)

Geometry-only classifier that predicts an IFC element's true structural
class from its mesh shape, and flags elements whose *stored* IFC entity
type doesn't match what the geometry says it should be.

## Setup

```
py -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

(already done in this repo — `.venv/` exists and is populated)

## Pipeline

The pipeline lives in four notebooks (run in order — each depends on the
previous one's output). Shared geometry/feature-engineering code lives in
`src/ifc_geometry.py` and `src/feature_engineering.py` and is imported by
the notebooks, rather than duplicated in cells.

0. **`00_feature_engineering.ipynb`** — pedagogical walkthrough: takes one
   example element of each class and shows, step by step, how a raw
   triangle mesh becomes bounding box → PCA axes → slenderness → shape
   descriptors → gravity-aware features → cross-section uniformity, with a
   3D plot of each element's mesh + principal axes and a side-by-side
   feature comparison table. This is not part of the production pipeline —
   it's meant to make the feature engineering in
   `src/feature_engineering.py` inspectable/explainable.
1. **`01_build_dataset.ipynb`** — walks `IFCNetCoreIFC/{IfcBeam,IfcSlab,IfcStair,IfcWall}/{train,test}/*.ifc`,
   loads the single `IfcElement` in each file via `ifcopenshell.geom`, computes
   geometric + engineered features (see below), and writes `data/ifc_features.csv`.
   Also records the entity type actually stored in the file (`stored_ifc_class`),
   separate from the ground-truth class implied by the folder (`label`).
2. **`02_train_classifiers.ipynb`** — trains a `RandomForestClassifier` and an
   `MLPClassifier` on the existing train/test split, saves models to `models/`
   and metrics/plots to `reports/`, and runs an overfitting-diagnostics
   section (train vs test accuracy, learning curves, RF validation curve
   over `n_estimators`, MLP loss curve) — see below.
3. **`03_check_entity_types.ipynb`** — scores every element with the trained
   Random Forest and writes `data/entity_qa_report.csv`, flagging elements
   where the stored IFC entity type disagrees with the geometry-predicted class.

Open them in Jupyter with the `ifc_test (.venv)` kernel (already registered),
or re-run headless:

```
.venv\Scripts\jupyter nbconvert --to notebook --execute --inplace 00_feature_engineering.ipynb --ExecutePreprocessor.kernel_name=ifc_test_venv
.venv\Scripts\jupyter nbconvert --to notebook --execute --inplace 01_build_dataset.ipynb --ExecutePreprocessor.kernel_name=ifc_test_venv
.venv\Scripts\jupyter nbconvert --to notebook --execute --inplace 02_train_classifiers.ipynb --ExecutePreprocessor.kernel_name=ifc_test_venv
.venv\Scripts\jupyter nbconvert --to notebook --execute --inplace 03_check_entity_types.ipynb --ExecutePreprocessor.kernel_name=ifc_test_venv
```

## Results (current run)

| model | train accuracy | test accuracy |
|---|---|---|
| Random Forest | 99.9% | 95.9% |
| MLP | 97.3% | 93.5% |

The ~4pp train/test gap is stable across training-set size (see
`reports/learning_curves.png`) and doesn't grow with more RF trees (see
`reports/validation_curve_rf.png`) or more MLP epochs (see
`reports/mlp_loss_curve.png`) — i.e. no sign of overfitting, just the
expected small generalization gap for this dataset size.

Dataset found **217/1378 (16%)** elements whose stored IFC entity type does
not match their true class — mostly `IfcBuildingElementProxy` (a generic
"unknown element" type) instead of `IfcBeam`/`IfcSlab`/etc. The geometry
model recovers the correct class for **206/209** such proxy elements, which
is the practical value of this pipeline: it can suggest a correction for
elements exported with the wrong (or generic) IFC entity type.

## Feature engineering

All features come from the element's triangulated world-coordinate mesh
(`ifcopenshell.geom`), so they don't depend on the (possibly wrong) stored
IFC class or on the authoring tool (Tekla, Revit, ...). See
`src/feature_engineering.py`. Groups:

- **Raw mesh metrics**: vertex/face count, surface area, volume (divergence
  theorem), axis-aligned bounding box, convex-hull volume/area.
- **3D shape descriptors** (PCA of vertices, eigenvalue-based, same family
  used for LiDAR point-cloud classification): `linearity_index` (rod-like),
  `planarity_index` (plate-like), `sphericity_index` (blocky), `elongation`,
  `flatness`.
- **Structural slenderness**: cross-section area ≈ volume / length, radius
  of gyration ≈ sqrt(area/π), `slenderness_ratio` = length / radius of
  gyration — the classic beam/column λ = L/i, computed without needing a
  parametric profile.
- **Shape quality**: `rectangularity` (volume/bbox volume), `convexity`
  (volume/hull volume — very effective at catching stairs, whose steps make
  them strongly non-convex), `compactness`, `specific_surface`,
  `mesh_complexity` (facets per unit area).
- **Gravity-aware features** (IFC world Z is a reliable "up", independent of
  element orientation): `vertical_extent`, footprint dimensions from a 2D
  PCA on the XY projection, `horizontal_aspect_ratio`, `footprint_area`,
  `verticality_ratio` (height / horizontal span — separates walls from
  slabs/beams cleanly), `thickness_to_span_ratio`, `incline_angle_deg`
  (angle of the element's major axis from horizontal: ~0° for a beam,
  ~90° for a wall, in between for a stair flight).
- **Footprint shape**: `footprint_perimeter_m` and `footprint_compactness`
  (isoperimetric ratio 4π·area/perimeter² of the XY footprint — near 1 for
  a compact footprint, near 0 for a long thin strip such as a wall segment).
- **Cross-section uniformity along the span**: `cross_section_area_cv` —
  slices the element into bands along its major axis and measures the
  coefficient of variation of the cross-section size; near 0 for a
  prismatic/extruded element (beam, wall, slab), high for a stepped one
  (stair).
- **`step_count_proxy`**: bins mesh surface area by height and counts
  distinct bands — a rough tread/riser counter that helps flag stairs.

`00_feature_engineering.ipynb` walks through every one of these formulas by
hand on one example element per class. Top features by Random Forest
importance: `horizontal_minor_m`, `vertical_extent`, `bbox_dz`,
`max_axis_verticality`, `verticality_ratio` — i.e. the model leans heavily
on the gravity-aware features, confirming they matter for these four classes.

## Overfitting checks

`02_train_classifiers.ipynb` includes a diagnostics section producing:
- `reports/train_vs_test_accuracy.png` — train vs test accuracy per model.
- `reports/learning_curves.png` — 5-fold CV train/validation accuracy vs.
  training-set size, for both models.
- `reports/validation_curve_rf.png` — RF train/validation accuracy vs.
  `n_estimators` (checks that adding trees doesn't hurt generalization).
- `reports/mlp_loss_curve.png` — MLP training loss and internal validation
  accuracy per epoch (`early_stopping=True`).
- `reports/train_vs_test_auc.png` — macro-average ROC-AUC (one-vs-rest) on
  train vs test, per model (RF gap 0.002, MLP gap 0.008 — negligible).
- `reports/roc_curves.png` — per-class ROC curves (one-vs-rest) on the test
  set; AUC ranges 0.96–1.00 across all four classes for both models.

## Files

```
src/ifc_geometry.py            mesh loading, volume/area/PCA/convex-hull/cross-section utilities
src/feature_engineering.py     the engineered feature set described above
00_feature_engineering.ipynb   step-by-step walkthrough of the feature formulas on example elements
01_build_dataset.ipynb         dataset builder -> data/ifc_features.csv
02_train_classifiers.ipynb     RF + MLP training/evaluation + overfitting diagnostics -> models/, reports/
03_check_entity_types.ipynb    entity-type QA report -> data/entity_qa_report.csv
```

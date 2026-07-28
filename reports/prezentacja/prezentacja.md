# IFC Entity-Type QA — Geometry-Only Classifier
### Prezentacja projektu dyplomowego

---

## Slajd 1 — Tytuł

**Wykrywanie błędnie zaklasyfikowanych elementów IFC na podstawie geometrii**

Klasyfikator Beam / Slab / Stair / Wall + serwis QA dla modeli BIM

Agata Czajka — 2026-07-20

---

## Slajd 2 — Problem

- Eksportery IFC (Revit, Tekla, ...) czasem zapisują element pod złym typem —
  najczęściej jako `IfcBuildingElementProxy` (generyczny "nieznany element"),
  zamiast właściwego `IfcBeam` / `IfcSlab` / `IfcStair` / `IfcWall`.
- To utrudnia automatyczne analizy modelu (ilości, kolizje, zgodność z normami),
  bo narzędzia BIM filtrują po typie IFC.
- **Pytanie badawcze**: czy sama geometria elementu (mesh) wystarczy, żeby
  rozpoznać jego prawdziwą klasę strukturalną — niezależnie od tego, co
  zapisano w pliku?
- **Metryka sukcesu**: accuracy > 90% na zbiorze testowym + realne odzyskanie
  poprawnej klasy dla elementów z błędnym/generycznym typem.

---

## Slajd 3 — Dane

- **Źródło**: IFCNetCore (1378 plików .ifc, po jednym elemencie na plik),
  4 klasy: Beam, Slab, Stair, Wall.
- **Rozkład klas**: Wall 537, Slab 507, Beam 282, Stair 52 — wyraźnie
  niezbalansowany (Stair to 3.8% danych) → `class_weight="balanced"` we
  wszystkich modelach.
- **Split**: 965 train / 413 test (istniejący podział train/test w danych).
- **Cechy**: 39 cech geometrycznych liczonych z trójkątnego mesha (patrz
  Slajd 5) — zero zależności od (potencjalnie błędnego) zapisanego typu IFC.

---

## Slajd 4 — EDA — odkrycia

(pełne wykresy: `reports/eda/`)

- Brak braków danych (NaN) — dataset kompletny.
- Klasy wyraźnie rozdzielają się na kilku cechach, np. `verticality_ratio`
  (Wall wysoko, Beam/Slab nisko), `convexity` (Stair wyraźnie niżej — schody
  są mocno niewypukłe przez stopnie), `slenderness_ratio` (Beam najwyższy).
- Macierz korelacji: silne korelacje w obrębie grup cech pochodzących z tego
  samego pomiaru (np. `elongation`/`linearity_index`), co jest oczekiwane i
  nie stanowi problemu dla modeli drzewiastych.
- **217/1378 (16%) elementów** ma `stored_ifc_class` niezgodny z folderem
  (ground truth) — to sedno problemu z Slajdu 2, potwierdzone w danych.

---

## Slajd 5 — Feature engineering

Cechy liczone wyłącznie z mesha (`src/feature_engineering.py`), pogrupowane:

- **Surowe metryki mesha**: liczba wierzchołków/ścian, pole, objętość
  (twierdzenie o dywergencji), bbox, objętość/pole otoczki wypukłej.
- **3D deskryptory kształtu (PCA)**: `linearity_index` (pręt), `planarity_index`
  (płyta), `sphericity_index` (bryła), `elongation`, `flatness`.
- **Smukłość strukturalna**: `slenderness_ratio` = L / promień bezwładności —
  klasyczne λ = L/i dla belki/słupa, bez potrzeby znajomości profilu.
- **Cechy grawitacyjne** (IFC Z = "góra"): `verticality_ratio`,
  `incline_angle_deg`, `footprint_area_m2`, `horizontal_aspect_ratio`.
- **Jednorodność przekroju wzdłuż osi**: `cross_section_area_cv` — niska dla
  elementów pryzmatycznych, wysoka dla schodów (stopnie).

Top 5 wg Random Forest: `horizontal_minor_m`, `vertical_extent_m`, `bbox_dz_m`,
`max_axis_verticality`, `verticality_ratio`.

---

## Slajd 6 — Modelowanie — podejście

5 modeli porównanych na tym samym split train/test:

| Model | Typ |
|---|---|
| Baseline | `DummyClassifier` (stratified) |
| Logistic Regression | liniowy, cechy standaryzowane |
| Random Forest | ensemble drzew, `class_weight="balanced"` |
| Gradient Boosting | boosting drzew |
| MLP | sieć (64, 32), `early_stopping=True` |

- Walidacja: `StratifiedKFold(5)` (learning curves, validation curve, tuning).
- Hyperparameter tuning: `GridSearchCV` na Random Forest (`n_estimators`,
  `max_depth`, `min_samples_leaf`) — najlepszy CV score 0.9658 vs. ręcznie
  dobrane 0.9588 na teście (brak istotnej różnicy, patrz Slajd 8).

---

## Slajd 7 — Wyniki — porównanie

| Model | Test accuracy |
|---|---|
| Baseline | 35.1% |
| MLP | 93.5% |
| Logistic Regression | 95.2% |
| Random Forest | 95.9% |
| **Gradient Boosting** | **96.6%** |

- Wszystkie modele nietrywialne biją baseline o >55 pp.
- Gradient Boosting najdokładniejszy, ale najwolniejszy w treningu (patrz
  Green IT, Slajd 10).
- Random Forest: train/test accuracy 99.9%/95.9% — mała luka (~4pp), stabilna
  względem rozmiaru zbioru (`reports/learning_curves.png`) i liczby drzew
  (`reports/validation_curve_rf.png`) — brak sygnału overfittingu.
- ROC-AUC (one-vs-rest, macro): 0.96–1.00 dla wszystkich klas, wszystkich
  modeli poza baseline.

---

## Slajd 8 — Analiza błędów

- Największa liczba pomyłek: Beam ↔ Slab (podobna smukłość przy krótkich
  belkach) i Stair ↔ Beam (schody proste bywają zbliżone kształtem do belki
  w rzucie) — widoczne w `reports/confusion_matrix_random_forest.png`.
- GridSearchCV nie poprawił wyniku na teście (0.9588 → 0.9588) mimo wyższego
  CV score (0.9658) — sygnał, że model manualny już jest blisko sufitu dla
  tego zestawu cech i rozmiaru danych; dalsza poprawa wymagałaby raczej
  nowych cech niż tuningu.
- Feature importance (RF) potwierdza, że cechy grawitacyjne (`vertical_extent`,
  `verticality_ratio`) niosą najwięcej sygnału — zgodnie z intuicją
  inżynierską (orientacja względem grawitacji rozróżnia te 4 klasy).

---

## Slajd 9 — Wdrożenie

- **Backend**: FastAPI (`backend/app.py`), `POST /api/classify` — przyjmuje
  realny (wieloelementowy) plik .ifc, zwraca dla każdego elementu: typ
  zapisany, typ sugerowany przez model, confidence, pełne prawdopodobieństwa.
- **Frontend**: React + Three.js (`@thatopen/components`) — prawdziwy podgląd
  3D modelu, lista elementów oflagowanych jako niezgodne, panel
  accept/reject/manual reclassification.
- **Docker**: `backend/Dockerfile` (`docker build -f backend/Dockerfile -t
  ifc-classifier .`), `python:3.11-slim` + `uvicorn`.
- Model produkcyjny: Random Forest (`models/random_forest.joblib`) +
  `models/metadata.json` (wersjonowanie, uzasadnienie wyboru).

---

## Slajd 10 — Green IT

| Model | Test acc. | Czas treningu | Rozmiar modelu |
|---|---|---|---|
| Logistic Regression | 95.2% | 0.02 s | 2 KB |
| MLP | 93.5% | 0.10 s | 120 KB |
| Random Forest | 95.9% | 0.48 s | 2.5 MB |
| Gradient Boosting | 96.6% | 4.23 s | 970 KB |

- Gradient Boosting: +0.7 pp accuracy vs Random Forest za **~9x** dłuższy
  trening; +1.4 pp vs Logistic Regression za **~215x** dłuższy trening —
  świadomie **nie** wybrany do produkcji mimo najwyższej accuracy.
- Logistic Regression: najlepszy kompromis efektywność/accuracy spośród
  modeli nietrywialnych — model 1000x mniejszy niż Random Forest.
- Random Forest zostaje w produkcji z powodów integracyjnych i
  interpretowalności (feature importances), nie czystej wydajności — to
  świadomy, udokumentowany trade-off (`reports/green_it_comparison.csv`,
  `models/metadata.json`).

---

## Slajd 11 — Wnioski

- Sama geometria mesha wystarcza, żeby odróżnić Beam/Slab/Stair/Wall z
  accuracy 95.9% (RF) — 96.6% (GB), znacznie ponad próg sukcesu (>90%).
- Model poprawnie sugeruje właściwą klasę dla **206/209 (98.6%)** elementów
  wyeksportowanych z generycznym/błędnym typem — to praktyczna wartość
  całego pipeline'u: automatyczna sugestia korekty typu IFC.
- Największe ograniczenie: mała próbka klasy Stair (52 elementy) — więcej
  danych schodowych prawdopodobnie poprawiłoby recall na tej klasie.
- Co zrobiłabym inaczej: zebrałabym więcej przykładów Stair i dodała cechy
  bezpośrednio liczące liczbę stopni (obecny `step_count_proxy` to tylko
  przybliżenie).

---

## Slajd 12 — Następne kroki

- Rozszerzenie na więcej klas IFC (Column, Door, Window, Railing).
- SHAP dla pełnej interpretowalności predykcji per-element (nie tylko
  globalnej feature importance).
- Zapis decyzji recenzenta (accept/reject/manual) z frontendu do backendu —
  obecnie tylko client-side.
- Deploy backendu do chmury (Cloud Run/podobne) z regionem zasilanym OZE.
- CI/CD: uruchamianie `tests/` na każdym pushu (GitHub Actions).

---

## Slajd 13 — Q&A

- Kod: `github.com/czajkaagata/test_klasyfikator`
- Uruchomienie: `README.md` (setup, pipeline, review app)
- Pytania?

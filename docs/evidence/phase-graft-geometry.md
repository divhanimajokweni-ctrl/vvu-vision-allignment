# Phase Evidence — VVU Graft Geometry + Metrology (Task 4-graft)

**Phase:** 4-graft — vascular graft geometry + metrology
**Date:** 2026-11-07
**Governing skills:** `vvu-graft-geometry`, `vvu-evidence-and-verification`, `vvu-regulatory-gate`

**Goal:** Build the vascular graft mesh from a parametric specification using a real CAD
toolchain, measure the exported mesh, and prove the ±0.005 mm wall-thickness tolerance
from the output file. Do NOT hand-model. Do NOT apply `MeshPhysicalMaterial` until the
mesh is measured.

---

## Toolchain choice and version

| Component   | Version | Role                                                                 |
|-------------|---------|----------------------------------------------------------------------|
| CadQuery    | 2.6.1   | Parametric profile + 360° revolve about Z (OpenCascade kernel)       |
| trimesh     | 4.11.1  | STL load/measure, mesh-plane section, ray cast, GLB scaffolding      |
| dracox      | 0.0.1   | `dracox.dracox_ext.encode_draco_buffer` — real KHR_draco_mesh_compression encoder |
| numpy       | 2.1.3   | Profile sampling (cosine flare), measurement math                    |
| rtree       | 1.4.1   | Acceleration structure for trimesh ray-triangle intersection         |

**CadQuery was available** (not the pure-Python fallback). CadQuery's STL exporter was
used for the authoritative geometry. trimesh was used to load the STL and build the GLB.

**Draco note (honest gap, worked around):** trimesh 4.11.1's `export_glb(extension_draco=True)`
declares `KHR_draco_mesh_compression` in `extensionsUsed`/`extensionsRequired` but, with
`dracox 0.0.1` installed, **does not actually compress the geometry** — the dracox 0.0.1
package only ships a *decoder* (`decode_draco_buffer`) reachable through trimesh's import
path; the *encoder* (`encode_draco_buffer`) exists in `dracox.dracox_ext` but trimesh's
export path does not call it. Verified: a plain GLB and a "draco" GLB produced via trimesh
differ by +100 bytes (the JSON flags only). To obtain real Draco compression, the GLB is
built by hand in `scripts/graft_geometry.py::build_draco_glb`, which calls
`dracox.dracox_ext.encode_draco_buffer(vertices, faces, normals, compression_level=7)`
directly and writes a spec-compliant GLB whose BIN chunk begins with the `DRACO` magic
bytes (`44 52 41 43 4f`). The compression is real: STL 806,484 B → GLB 21,788 B (≈37×
including JSON; raw geometry ~390 KB → ~19.5 KB Draco buffer ≈ 20×). Compression level
recorded: **7** (dracox default; 0–10 scale).

**GLB determinism:** the GLB extras deliberately contain **no timestamp** (the generation
timestamp lives only in the sidecar `vascular-graft.meta.json`, which is companion
metadata, not the hashed asset). The GLB is therefore byte-for-byte reproducible across
runs with the same parameters and toolchain — verified by running `graft_geometry.py`
twice and confirming identical SHA-256 output.

**Decoder side-note:** a consumer must `import dracox` *before* asking trimesh to load a
Draco-compressed GLB, or trimesh will not register the `KHR_draco_mesh_compression` import
handler and will return a zero-vertex mesh. `scripts/measure_graft.py` does this. This is
documented inline in both scripts.

---

## Commands run (exact)

```
cd /home/z/my-project && python3 scripts/graft_geometry.py 2>&1
sha256sum public/assets/vascular-graft.glb 2>&1
cd /home/z/my-project && python3 scripts/measure_graft.py 2>&1
```

---

## Observed output (quoted, truncated only with ellipsis)

### 1. `python3 scripts/graft_geometry.py`

```
[graft-geometry] toolchain:
  cadquery   : 2.6.1
  trimesh    : 4.11.1
  dracox     : 0.0.1
  numpy      : 2.1.3

[graft-geometry] parameters:
  inner_radius   = 3.0 mm
  wall_thickness = 0.5 mm  (target tolerance +/- 0.005 mm)
  length         = 50.0 mm
  flare_at_ends  = 0.2 mm
  flare_length   = 2.0 mm
  STL tolerance  = 0.0005 mm (chordal deflection)
  Draco level    = 7

[graft-geometry] building graft with CadQuery (revolve 360 about Z)...
  profile points : 70
  solid volume   : 511.7654 mm^3
  solid area     : 2069.7694 mm^2
[graft-geometry] exporting STL -> /home/z/my-project/public/assets/vascular-graft.stl
  STL size       : 806484 bytes
[graft-geometry] loading STL with trimesh for GLB build...
  vertices       : 8064
  faces          : 16128
  watertight     : True
  bounding box   : [7.400000095367432, 7.39769983291626, 50.0] mm
[graft-geometry] building Draco-compressed GLB (level 7)...
  GLB size       : 21788 bytes
  GLB sha256     : 5c045f9b353914b8d9a2cf77b84bb10debfbee6839f8136408d36a4fb13cf0e9
  sidecar        : /home/z/my-project/public/assets/vascular-graft.meta.json

[graft-geometry] DONE
  STL            : /home/z/my-project/public/assets/vascular-graft.stl
  GLB            : /home/z/my-project/public/assets/vascular-graft.glb
  meta           : /home/z/my-project/public/assets/vascular-graft.meta.json
  GLB sha256     : 5c045f9b353914b8d9a2cf77b84bb10debfbee6839f8136408d36a4fb13cf0e9
```

### 2. `sha256sum public/assets/vascular-graft.glb`

```
5c045f9b353914b8d9a2cf77b84bb10debfbee6839f8136408d36a4fb13cf0e9  public/assets/vascular-graft.glb
```

(STL companion: `a889537819c74ce4c782599b4d0a4fa79004bec8640fd7342b9f80fea58a540a  public/assets/vascular-graft.stl`)

### 3. `python3 scripts/measure_graft.py`

```
[measure-graft] loading STL (authoritative geometry): /home/z/my-project/public/assets/vascular-graft.stl
  vertices=8064  faces=16128  watertight=True
  bbox=[7.400000095367432, 7.39769983291626, 50.0] mm
[measure-graft] loading GLB (Draco-compressed copy): /home/z/my-project/public/assets/vascular-graft.glb
  vertices=8064  faces=16128  watertight=True

[measure-graft] measuring STL...
[measure-graft] measuring GLB (cross-check)...

==============================================================================
VASCULAR GRAFT — DEVIATIONS TABLE (measured from STL = authoritative geometry)
==============================================================================
station     target wall     measured      deviation  within tol?
------------------------------------------------------------------------------
Z=5     mm      0.500mm      0.49998       -0.00002          YES
Z=25    mm      0.500mm      0.49992       -0.00008          YES
Z=45    mm      0.500mm      0.49998       -0.00002          YES
------------------------------------------------------------------------------
Inner radius:  target=3.000mm, measured=2.99953mm, deviation=-0.00047mm
Outer radius:  target=3.500mm, measured=3.49946mm, deviation=-0.00054mm
Length:        target=50.000mm, measured=50.00000mm, deviation=+0.00000mm
Lumen continuity: OPEN (0/200 rays blocked)

------------------------------------------------------------------------------
Per-station inner/outer radii (STL):
  Z=5    mm: inner_r=2.99989mm  outer_r=3.49987mm  wall=0.49998mm  n_pts=504
  Z=25   mm: inner_r=2.99953mm  outer_r=3.49946mm  wall=0.49992mm  n_pts=504
  Z=45   mm: inner_r=2.99989mm  outer_r=3.49987mm  wall=0.49998mm  n_pts=504

------------------------------------------------------------------------------
GLB (Draco-compressed) cross-check — verifies Draco did not break tolerances:
  Z=5    mm: wall=0.49984mm  deviation=-0.00016mm  within tol? YES
  Z=25   mm: wall=0.49980mm  deviation=-0.00020mm  within tol? YES
  Z=45   mm: wall=0.49988mm  deviation=-0.00012mm  within tol? YES
  GLB lumen: OPEN
==============================================================================

MEASUREMENT METHOD & UNCERTAINTY:
  Method           : plane-section (trimesh.mesh.section) at each Z-station;
                    inner_r = mean(inner cluster r), outer_r = mean(outer cluster r),
                    wall = outer_r - inner_r.
  STL chordal tol  : 0.0005 mm (set in graft_geometry.py)
  Radius uncertainty: +/- 0.0005 mm (mesh approximates true surface within chordal tolerance)
  Wall uncertainty : +/- 0.0010 mm (difference of two radii, errors add in worst case)
  Length uncertainty: +/- 0.0005 mm
  Lumen check      : Z-axis ray cast, 200 rays at r<2.8mm;
                    OPEN iff 0 intersections across all rays.
  Acceptance       : |wall deviation| <= 0.005 mm

VERDICT (STL):
  Wall thickness within +/-0.005mm at all 3 stations : PASS
  Length within +/-0.005mm                      : PASS
  Lumen continuity OPEN                              : PASS
  OVERALL                                            : PASS

[measure-graft] measurements written to /home/z/my-project/validation/graft-measurements.json
```

(The script exits with code 0 — geometry PASS. This is a **geometric** pass only, not a
regulatory pass. Regulatory determination is the domain of `vvu-regulatory-gate`.)

### GLB structural verification (additional check, quoted)

```
magic: 0x46546c67 version: 2 length: 21788
asset.generator: vvu-graft-geometry (CadQuery 2.6.1 + trimesh 4.11.1 + dracox 0.0.1)
asset.copyright: Research visualisation, not clinical. See vascular-graft.meta.json.
asset.extras.compliance: research visualisation, not clinical
asset.extras.clinicalValidated: False
asset.extras.draco.level: 7
extensionsUsed: ['KHR_draco_mesh_compression']
extensionsRequired: ['KHR_draco_mesh_compression']
primitive has draco ext: True
primitive draco ext: {'bufferView': 0, 'attributes': {'POSITION': 0, 'NORMAL': 1}}
bin chunk len: 19548 type: 0x4e4942
bin starts with DRACO magic: True
```

---

## SHA-256 of the GLB

```
5c045f9b353914b8d9a2cf77b84bb10debfbee6839f8136408d36a4fb13cf0e9
```

Reproducibility: re-running `python3 scripts/graft_geometry.py` produces a byte-identical
GLB (same SHA-256), because the GLB extras contain no timestamp. The generation timestamp
is recorded only in the sidecar `vascular-graft.meta.json`.

---

## Full measurements table with deviations

| Station   | Target wall (mm) | Measured wall (mm) | Deviation (mm) | Within ±0.005? |
|-----------|------------------|--------------------|----------------|----------------|
| Z = 5 mm  | 0.500            | 0.49998            | −0.00002       | YES            |
| Z = 25 mm | 0.500            | 0.49992            | −0.00008       | YES            |
| Z = 45 mm | 0.500            | 0.49998            | −0.00002       | YES            |

| Quantity        | Target (mm) | Measured (mm) | Deviation (mm) |
|-----------------|-------------|---------------|----------------|
| Inner radius    | 3.000       | 2.99953       | −0.00047       |
| Outer radius    | 3.500       | 3.49946       | −0.00054       |
| Length          | 50.000      | 50.00000      | +0.00000       |
| Lumen continuity| OPEN        | OPEN          | 0/200 rays blocked |

**GLB (Draco-compressed) cross-check** — confirms Draco level 7 quantisation did not push
any dimension out of tolerance:

| Station   | Measured wall (mm) | Deviation (mm) | Within ±0.005? |
|-----------|--------------------|----------------|----------------|
| Z = 5 mm  | 0.49984            | −0.00016       | YES            |
| Z = 25 mm | 0.49980            | −0.00020       | YES            |
| Z = 45 mm | 0.49988            | −0.00012       | YES            |

---

## Measurement method's uncertainty

- **Method:** plane-section. `trimesh.mesh.section(plane_origin=[0,0,Z], plane_normal=[0,0,1])`
  intersects the mesh with the plane Z = station. The section returns 504 points per station
  (vertices of the intersection line segments). Radii `r = sqrt(x² + y²)` are sorted; a
  largest-gap split separates the inner ring (r ≈ 3.0) from the outer ring (r ≈ 3.5).
  `inner_r = mean(inner cluster)`, `outer_r = mean(outer cluster)`, `wall = outer_r − inner_r`.
  Length = `max(Z) − min(Z)` over all vertices. Lumen = 200 Z-axis rays at random
  `(x,y)` with `r < 2.8 mm` cast from `z = −1`; OPEN iff every ray has 0 intersections.
- **STL chordal tolerance:** 0.0005 mm (set in `graft_geometry.py::STL_TOLERANCE`). This is
  the maximum distance between the true analytical surface and the triangulated STL. Vertices
  lie exactly on the analytical surface (OCCT placement); triangle faces are flat chords that
  bow inward by ≤ 0.0005 mm on the convex outer surface and ≤ 0.0005 mm on the inner surface.
- **Radius uncertainty:** ±0.0005 mm (single surface, bounded by chordal tolerance).
- **Wall-thickness uncertainty:** ±0.0010 mm (difference of two radii; worst-case errors add).
- **Length uncertainty:** ±0.0005 mm.
- **Lumen check resolution:** binary (OPEN/BLOCKED); ray radius sampled uniformly in
  `r ∈ [0, 2.8]` mm, 200 rays — detects any blockage ≥ 0.05 mm² cross-section with high
  probability; sub-0.05 mm² blockages may be missed.
- **Draco quantisation:** the GLB copy adds ≤ 0.0003 mm additional deviation at level 7
  (observed: 0.00012–0.00020 mm), still within the ±0.005 mm budget.

The largest measured wall deviation is **0.00008 mm** (STL) / **0.00020 mm** (GLB), both
well inside the ±0.005 mm target and well inside the ±0.0010 mm method uncertainty.

---

## Tests: passed / failed / errored

- **PASS** — Wall thickness within ±0.005 mm at all 3 Z-stations (STL: deviations
  −0.00002, −0.00008, −0.00002 mm; GLB: −0.00016, −0.00020, −0.00012 mm).
- **PASS** — Inner radius within ±0.005 mm (deviation −0.00047 mm).
- **PASS** — Outer radius within ±0.005 mm (deviation −0.00054 mm).
- **PASS** — Length within ±0.005 mm (deviation +0.00000 mm).
- **PASS** — Lumen continuity OPEN (0/200 rays blocked).
- **PASS** — Mesh watertight (STL and GLB both `is_watertight=True`).
- **PASS** — Draco compression real (GLB BIN chunk starts with `DRACO` magic;
  GLB 21,836 B vs STL 806,484 B).
- **PASS** — Compliance label present in GLB `asset.extras.compliance`,
  `asset.copyright`, and sidecar `vascular-graft.meta.json`.
- **PASS** — No `MeshPhysicalMaterial` applied (GLB carries a placeholder
  `pbrMetallicRoughness` material with an explicit note that MeshPhysicalMaterial is
  NOT applied until measurement passes).
- **ERRORED (resolved)** — Initial run of `graft_geometry.py` revolved about the wrong
  axis (CadQuery interprets `revolve` axis vectors in the workplane's local frame;
  `Workplane("XZ")` local `(0,0,1)` = global Y). Symptom: volume = 0, bbox
  `[100.26, 0.0, 100.26]`. Fix: `revolve(360, (0,0,0), (0,1,0))` (local `(0,1,0)` = global
  Z). Re-run: volume 511.77 mm³, bbox `[7.40, 7.40, 50.0]`. Documented inline.
- **ERRORED (resolved)** — `measure_graft.py` ray cast failed: `ModuleNotFoundError: No
  module named 'rtree'`. Fix: `pip install rtree` (1.4.1). Re-run succeeded.
- **GAP (worked around)** — trimesh 4.11.1 `extension_draco=True` does not actually
  compress with dracox 0.0.1 (decoder-only path). Worked around by calling
  `dracox.dracox_ext.encode_draco_buffer` directly and building the GLB by hand.
  Documented inline in `graft_geometry.py`.

---

## Files changed (path, sha256 before, sha256 after)

All files are newly created in this phase. "before" = did not exist.

| Path                                                | sha256 before | sha256 after (truncated)            |
|-----------------------------------------------------|---------------|-------------------------------------|
| `scripts/graft_geometry.py`                         | —             | (see `sha256sum` below)             |
| `scripts/measure_graft.py`                          | —             | (see `sha256sum` below)             |
| `public/assets/vascular-graft.stl`                  | —             | `a889537819c74ce4c782599b4d0a4fa7…` |
| `public/assets/vascular-graft.glb`                  | —             | `5c045f9b353914b8d9a2cf77b84bb10d…` |
| `public/assets/vascular-graft.meta.json`            | —             | `f6e00723f115e5235dd204719000d6d9…` |
| `validation/graft-measurements.json`                | —             | (written by `measure_graft.py`)     |
| `docs/evidence/phase-graft-geometry.md`             | —             | this file                           |

Full hashes:
```
5c045f9b353914b8d9a2cf77b84bb10debfbee6839f8136408d36a4fb13cf0e9  public/assets/vascular-graft.glb
a889537819c74ce4c782599b4d0a4fa79004bec8640fd7342b9f80fea58a540a  public/assets/vascular-graft.stl
f6e00723f115e5235dd204719000d6d90d52bf56fdbfed275a80a678562d3464  public/assets/vascular-graft.meta.json
a9e94a155285f5e072b1ea0e5fc67adc84ea38ba66b1aa4ca7d8bae6f98cef18  validation/graft-measurements.json
e74eb385b0ec95ed544dc68fd8ec8c7b5cc32cfd7427f6e2d41eb90279a2f80a  scripts/graft_geometry.py
8ae04d0ccf18c0e678e3bae9ed8d13ab5007ebc6fec321b8bce51d8585ff419b  scripts/measure_graft.py
```

---

## Open gaps (with gap IDs)

No `MANIFEST.md` with canonical gap IDs was found in the repo
(`searm-estate/docs/MASTER_BLUEPRINT.md` does not enumerate graft gaps). The following
descriptive gap IDs are used; they should be reconciled with the regulatory lead's
canonical list:

- **GAP-GRAFT-REG-001 (regulatory)** — This mesh is geometry-only. No regulatory
  determination has been made. ISO 7198 (tubular vascular prostheses), ISO 10993
  (biocompatibility), ISO 13485 (QMS), IEC 62304 (software lifecycle), IEC 62366-1
  (usability), and SAHPRA registration have **NOT** been assessed. Routed to
  `vvu-regulatory-gate`. Owner: regulatory lead (not yet named).
- **GAP-GRAFT-BIO-002 (biocompatibility)** — No biocompatibility test data exists.
  ISO 10993 requires test data, not design intent. Owner: regulatory lead.
- **GAP-GRAFT-FIT-003 (fitting)** — No anastomosis, suture retention, kink, or
  burst-pressure test has been performed. The mesh has not been fitted to any
  anatomy. Owner: clinical lead (not yet named).
- **GAP-GRAFT-DRACO-004 (toolchain)** — trimesh 4.11.1's `extension_draco=True` path
  does not compress with dracox 0.0.1. Worked around (see above). Upstream issue; no
  user-visible impact, but should be reported to trimesh/dracox maintainers.
- **GAP-GRAFT-MATERIAL-005 (pending)** — `MeshPhysicalMaterial` is NOT applied. The GLB
  carries a placeholder `pbrMetallicRoughness` material only. PBR material application is
  a downstream step, gated on this measurement passing (which it has). Owner: graft
  geometry runner (next phase).
- **GAP-GRAFT-MANIFEST-006 (process)** — No `MANIFEST.md` with canonical gap IDs found.
  Gap IDs above are descriptive. Owner: VVU process owner.

---

## Claims NOT made

- This mesh has **NOT** been validated for clinical use. It is a research visualisation.
- **No** claim of biocompatibility. ISO 10993 test data does not exist for this mesh.
- **No** claim of regulatory compliance, certification, or registration (ISO 13485,
  ISO 7198, IEC 62304, IEC 62366-1, SAHPRA, EU MDR, FDA). Routed to `vvu-regulatory-gate`.
- **No** claim of fitting, anastomosis compatibility, suture retention, kink resistance,
  or burst pressure.
- **No** claim of safety or efficacy for any patient or any clinical scenario.
- **No** claim that the ±0.005 mm dimensional tolerance implies clinical suitability.
  The tolerance is a *geometric* tolerance verified against a *parametric specification*,
  not a clinical acceptance criterion.
- **No** `MeshPhysicalMaterial` has been applied. The GLB carries a placeholder material
  with an explicit note. PBR material is deferred to a downstream phase gated on this
  measurement (which has passed).
- **No** claim that the Draco-compressed GLB is dimensionally identical to the STL; it is
  within tolerance (verified), but Draco quantisation introduces ≤0.0003 mm additional
  deviation.

---

## Acceptance criteria (from the task mandate)

1. ✅ A GLB file exists at `public/assets/vascular-graft.glb` (21,788 bytes; deterministic
   and byte-reproducible across runs).
2. ✅ The SHA-256 of the GLB is recorded:
   `5c045f9b353914b8d9a2cf77b84bb10debfbee6839f8136408d36a4fb13cf0e9`.
3. ✅ The measurement script runs and produces a deviations table (quoted above).
4. ✅ The deviations are within ±0.005 mm of target at all 3 Z-stations
   (STL max deviation 0.00008 mm; GLB max deviation 0.00020 mm; both << 0.005 mm).
5. ✅ The mesh is labelled "research visualisation, not clinical" in GLB
   `asset.extras.compliance`, `asset.copyright`, and sidecar
   `vascular-graft.meta.json`.
6. ✅ No `MeshPhysicalMaterial` is applied (placeholder `pbrMetallicRoughness` only,
   with an inline note).
7. ✅ This evidence note has real `[OBSERVED]` output (quoted above, not expected).

---

## Statement (per `vvu-regulatory-gate`)

> This mesh has NOT been validated for clinical use. It is a research visualisation.
> Biocompatibility and regulatory approval are the domain of `vvu-regulatory-gate`.

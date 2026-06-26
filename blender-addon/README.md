# PatternGen Importer (Blender add-on)

Imports a PatternGen export (the `scene_name_pattern_gen.zip` produced by
the app) into Blender as three emissive, alpha-blended image-sequence
planes — one each for **titles**, **patterns** and **dots**.

## Install

1. In Blender: **Edit → Preferences → Add-ons → Install…**, pick
   `patterngen_importer.py`, then tick the checkbox to enable it.
2. Open the 3D Viewport's **N-panel** and find the **PatternGen** tab.

Tested on Blender 3.4 and Blender 4.x.

## Export your scene from the app first

1. In PatternGen, click **EXPORT**. You'll get
   `<sceneName>_pattern_gen.zip`.
2. Unzip it — you should see three subfolders:
   ```
   <sceneName>_pattern_gen/
     titles/
     patterns/
     dots/
   ```

## Import into Blender

1. In the **PatternGen** tab, set **Scene Folder** to the unzipped
   folder (the one that contains `titles/`, `patterns/`, `dots/` and
   `manifest.json`).
2. Click **Import Scene Folders**.

Three planes are created at the origin:

| Layer     | Cyclic | Location (m)   | Rotation         | Scale       |
| --------- | ------ | -------------- | ---------------- | ----------- |
| titles    | off    | (0, 0, 0)      | 90° on X         | 6 × 6 × 6   |
| patterns  | off    | (0, 0.1, 0)    | 90° on X         | 6 × 6 × 6   |
| dots      | **on** | (0, 0.2, 0)    | 90° on X         | 6 × 6 × 6   |

Each plane gets a material with these nodes:

```
Image Texture (SEQUENCE, auto-refresh on)
  Color ─┬─► Principled BSDF › Base Color
         └─► Principled BSDF › Emission Color (strength = 1)
  Alpha ───► Principled BSDF › Alpha
```

Image sequence settings applied to every layer:

- **Start Frame** — `1`
- **Frames** — number of PNGs found in the folder (one fewer for the cyclic
  `dots` layer, so the loop wraps cleanly — see note below)
- **Offset** — `0`
- **Auto Refresh** — on
- **Cyclic** — on for `dots`, off for `titles` and `patterns`

The plane mesh itself is stretched to the image's aspect ratio
(16 : 9 for PatternGen exports), so the object scale stays uniform.

## The manifest: fps, frame step, and "on 2s"

PatternGen exports include a `manifest.json` that declares the export
contract. On import the add-on reads it and configures the **scene** so it
matches the footage, instead of leaving you to guess:

| Manifest field | What the importer does |
| -------------- | ---------------------- |
| `fps`          | Sets the scene/render frame rate (e.g. `30`) so you can animate and scrub in real time against an audio track. |
| `frameStep`    | Sets **Output ▸ Frame Range ▸ Step** (e.g. `2`). Rendering then advances 2 frames per rendered frame — the "**on 2s**" look at roughly **half the render time** — while interactive playback stays smooth at the full fps. |
| `output.resolution` | Sets Blender's render resolution to `1280 × 720` at 100%. |
| `output.fileType` | Sets Blender's output file format to JPG/RGB. |
| per-layer `frameDuration` | The image-sequence **Frames** value for each plane (one less than the file count for the cyclic `dots` layer; see note below). |
| layer `loop`   | Whether that layer's sequence is **Cyclic**. |

The importer also sets the scene frame range to cover the longest sequence.
If you extend the timeline for a longer camera move, the non-cyclic title and
pattern layers hold on their final PNG after the reveal finishes, while the
cyclic `dots` layer keeps looping.
If a `manifest.json` is missing (older exports), the add-on falls back to
counting PNGs and uses sensible defaults, leaving fps/step alone.

To render the stepped "on 2s" look, just render normally — `Step = 2` is
already set. To preview every frame instead, set **Step** back to `1`.

## Sync Start Frame across selected planes

1. Select the plane(s) you want to nudge (usually all three: click one,
   then `Shift`-click the others, or press `A` to select all).
2. In the **Sync Start Frame** section of the panel, type the new
   timeline **Start Frame** value.
3. Click **Apply to Selected**. Every image-sequence texture on the
   selected meshes is updated at once.

The status line shows how many sequences are about to be affected so you
know what you're pointing at before clicking.

## Notes

- The add-on creates materials with `blend_method = 'BLEND'` so that the
  alpha channel renders cleanly in Eevee / Cycles. If you see
  sort-order artifacts, switch individual materials to `HASHED`.
- Re-importing into the same scene does not delete old planes — Blender
  will just suffix new objects with `.001`, `.002`, etc. Delete the
  old group manually if you want a clean re-import.
- The 0.1 m spacing between layers is just there to avoid z-fighting.
  Move the planes along any axis that fits your camera setup.
- **Cyclic loop seam:** the `dots` sequence ends on a frame that is identical
  to its first frame (the loop returns to time 0), and Blender's cyclic image
  resolver overruns by one at the wrap, which renders as a one-frame magenta
  "missing frame" placeholder — and yes, it shows up in renders / OpenGL
  playblasts, not just the viewport. The add-on works around this by setting
  the cyclic layer's **Frames** to one less than the PNG count. If you build
  your own cyclic image-sequence planes, do the same (or render one extra
  trailing frame) so the loop never requests a frame past the last file.

bl_info = {
    "name": "PatternGen Importer",
    "author": "PatternGen",
    "version": (1, 0, 0),
    "blender": (3, 4, 0),
    "location": "View3D > Sidebar > PatternGen",
    "description": "Import PatternGen PNG sequences (titles / patterns / dots) as emissive image-sequence planes",
    "category": "Import-Export",
}

import os
import json
import math
import bpy
from bpy.props import StringProperty, IntProperty, PointerProperty
from bpy.types import Operator, Panel, PropertyGroup


LAYERS = [
    # (folder_name, cyclic, y_offset)
    ("titles",   False, 0.0),
    ("patterns", False, 0.1),
    ("dots",     True,  0.2),
]

TARGET_SCALE = 6.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _list_pngs(folder):
    return sorted(
        f for f in os.listdir(folder)
        if f.lower().endswith(".png")
    )


def _load_manifest(root):
    """Return the parsed manifest.json from the scene root, or None.

    The PatternGen exporter writes manifest.json alongside the layer folders to
    declare the export contract (fps, frame step, and per-layer image-sequence
    duration). When present it is the source of truth; when absent (older
    exports) the importer falls back to counting PNGs.
    """
    path = os.path.join(root, "manifest.json")
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else None
    except (ValueError, OSError):
        return None


def _find_layer_folder(root, layer_name):
    """Return path to <root>/<layer_name> (case-insensitive) if it exists and has PNGs."""
    if not os.path.isdir(root):
        return None
    candidates = []
    for entry in os.listdir(root):
        full = os.path.join(root, entry)
        if os.path.isdir(full) and entry.lower() == layer_name.lower():
            candidates.append(full)
    for folder in candidates:
        if _list_pngs(folder):
            return folder
    return None


def _make_plane(name, first_png_path, frame_duration, cyclic, location):
    """Create a plane, add a PNG-sequence shader, return the object."""
    # Load the first PNG as an image sequence.
    img = bpy.data.images.load(first_png_path, check_existing=True)
    img.source = 'SEQUENCE'

    w = img.size[0] or 1920
    h = img.size[1] or 1080
    aspect = w / h if h else (16.0 / 9.0)

    # Create a unit plane (1 × 1), then edit its mesh vertices so the plane
    # has aspect:1 (width:height) at object scale 1.
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    plane = bpy.context.active_object
    plane.name = name

    for v in plane.data.vertices:
        v.co.x *= aspect
    plane.data.update()

    # Rotate 90° on X so the plane stands up facing +Y, then scale uniformly
    # to TARGET_SCALE. (Blender's stock "Images as Planes" sits at 0.5 scale
    # after a 90° X rotation — we skip that intermediate state and go
    # straight to the final uniform scale the user wants.)
    plane.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    plane.scale = (TARGET_SCALE, TARGET_SCALE, TARGET_SCALE)

    # ---- Material ----------------------------------------------------------
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    mat.blend_method = 'BLEND'
    try:
        mat.shadow_method = 'NONE'
    except AttributeError:
        pass

    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.location = (420, 0)

    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)

    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.location = (-420, 0)
    tex.image = img
    tex.interpolation = 'Linear'

    iu = tex.image_user
    # frame_duration is decided by the caller (from the export manifest, or a
    # fallback heuristic). For a cyclic layer it is one less than the files on
    # disk: Blender's cyclic resolver overruns the loop by one at the wrap, and
    # the extra trailing file absorbs that overrun so the seam never requests a
    # missing frame (which would render as the magenta placeholder).
    iu.frame_duration = max(1, frame_duration)
    iu.frame_start = 0
    iu.frame_offset = 0
    iu.use_cyclic = cyclic
    iu.use_auto_refresh = True

    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])

    # Emission input name changed between Blender versions.
    for emission_name in ("Emission Color", "Emission"):
        if emission_name in bsdf.inputs:
            nt.links.new(tex.outputs['Color'], bsdf.inputs[emission_name])
            break
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = 1.0

    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    plane.data.materials.append(mat)
    return plane


def _get_sequence_nodes(obj):
    """Yield every Image Texture node on obj that drives a SEQUENCE image."""
    if obj.type != 'MESH' or obj.data is None:
        return
    for slot in obj.data.materials:
        if slot is None or not slot.use_nodes:
            continue
        for node in slot.node_tree.nodes:
            if (
                node.type == 'TEX_IMAGE'
                and node.image is not None
                and node.image.source == 'SEQUENCE'
            ):
                yield node


# ---------------------------------------------------------------------------
# Properties
# ---------------------------------------------------------------------------

class PG_Properties(PropertyGroup):
    scene_folder: StringProperty(
        name="Scene Folder",
        description="Root folder containing titles/, patterns/ and dots/ subfolders",
        default="",
        subtype='DIR_PATH',
    )
    start_frame: IntProperty(
        name="Start Frame",
        description="Timeline frame where the image sequence begins playing",
        default=0,
    )


# ---------------------------------------------------------------------------
# Operators
# ---------------------------------------------------------------------------

class PG_OT_Import(Operator):
    bl_idname = "patterngen.import_scene"
    bl_label = "Import Scene Folders"
    bl_description = (
        "Create titles/patterns/dots planes from a folder containing "
        "titles/, patterns/ and dots/ PNG sequences"
    )
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        props = context.scene.patterngen_props
        root = bpy.path.abspath(props.scene_folder or "").rstrip(os.sep) or ""
        if not os.path.isdir(root):
            self.report({'ERROR'}, f"Scene folder not found: {root or '(empty)'}")
            return {'CANCELLED'}

        manifest = _load_manifest(root)
        manifest_layers = (manifest or {}).get("layers", {})

        created = []
        missing = []
        max_files = 0
        for layer_name, cyclic_default, y_offset in LAYERS:
            folder = _find_layer_folder(root, layer_name)
            if folder is None:
                missing.append(layer_name)
                continue

            pngs = _list_pngs(folder)
            if not pngs:
                missing.append(layer_name)
                continue

            first_png = os.path.join(folder, pngs[0])
            frame_count = len(pngs)
            max_files = max(max_files, frame_count)

            # Prefer the exporter's declared contract; fall back to a heuristic
            # for older, manifest-less exports.
            spec = manifest_layers.get(layer_name, {})
            cyclic = bool(spec.get("loop", cyclic_default))
            if "frameDuration" in spec:
                frame_duration = int(spec["frameDuration"])
            else:
                frame_duration = frame_count - 1 if (cyclic and frame_count > 1) else frame_count

            plane = _make_plane(
                name=layer_name,
                first_png_path=first_png,
                frame_duration=max(1, frame_duration),
                cyclic=cyclic,
                location=(0.0, y_offset, 0.0),
            )
            created.append((plane.name, frame_count))

        if not created:
            self.report({'ERROR'}, "No titles/, patterns/ or dots/ folder with PNGs found.")
            return {'CANCELLED'}

        # Apply the project-level settings the exporter declared so the scene
        # matches the footage without the user guessing: fps for real-time /
        # audio playback, frame step for the "on 2s" stepped render, and a
        # frame range that covers the longest sequence.
        notes = []
        if manifest:
            fps = manifest.get("fps")
            if fps:
                context.scene.render.fps = int(round(fps))
                context.scene.render.fps_base = 1.0
                notes.append(f"{int(round(fps))}fps")
            step = manifest.get("frameStep")
            if step:
                context.scene.frame_step = int(step)
                notes.append(f"step {int(step)}")
            if max_files:
                context.scene.frame_start = 1
                context.scene.frame_end = max_files
                notes.append(f"range 1-{max_files}")

        summary = ", ".join(f"{name} ({n})" for name, n in created)
        if missing:
            summary += f" — missing: {', '.join(missing)}"
        if notes:
            summary += f" | scene set to {', '.join(notes)}"
        self.report({'INFO'}, f"Imported: {summary}")
        return {'FINISHED'}


class PG_OT_ApplyStartFrame(Operator):
    bl_idname = "patterngen.apply_start_frame"
    bl_label = "Apply to Selected"
    bl_description = (
        "Set the sequence Start Frame on every selected plane's "
        "image-sequence texture"
    )
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        props = context.scene.patterngen_props
        start = int(props.start_frame)

        targets = [o for o in context.selected_objects if o.type == 'MESH']
        if not targets:
            self.report({'WARNING'}, "No mesh objects selected.")
            return {'CANCELLED'}

        count = 0
        for obj in targets:
            for node in _get_sequence_nodes(obj):
                node.image_user.frame_start = start
                count += 1

        if count == 0:
            self.report({'WARNING'}, "Selected objects have no image-sequence textures.")
            return {'CANCELLED'}

        self.report({'INFO'}, f"Start Frame {start} applied to {count} sequence(s).")
        return {'FINISHED'}


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------

class PG_PT_Panel(Panel):
    bl_label = "PatternGen"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'PatternGen'

    def draw(self, context):
        layout = self.layout
        props = context.scene.patterngen_props

        box = layout.box()
        box.label(text="Import", icon='IMPORT')
        box.prop(props, "scene_folder", text="")
        box.operator(PG_OT_Import.bl_idname, icon='PLAY')

        box = layout.box()
        box.label(text="Sync Start Frame", icon='TIME')
        row = box.row(align=True)
        row.prop(props, "start_frame", text="Start Frame")
        box.operator(PG_OT_ApplyStartFrame.bl_idname, icon='FILE_REFRESH')

        sel_seq = sum(1 for o in context.selected_objects
                      if o.type == 'MESH'
                      for _ in _get_sequence_nodes(o))
        sub = box.row()
        sub.enabled = False
        sub.label(text=f"Selected sequences: {sel_seq}")


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

classes = (
    PG_Properties,
    PG_OT_Import,
    PG_OT_ApplyStartFrame,
    PG_PT_Panel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.patterngen_props = PointerProperty(type=PG_Properties)


def unregister():
    del bpy.types.Scene.patterngen_props
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()

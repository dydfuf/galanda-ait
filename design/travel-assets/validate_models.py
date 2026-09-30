#!/usr/bin/env python3
"""Independent saved-file validation: opens every .blend from disk.

blender -b --python source/validate_models.py -- --root .
Does not modify the Blender files. Writes source/model-validation.json.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy

NAMES=['empty-trips','create-trip','empty-saved','invite-companions',
       'compare-plans','confirm-plan','empty-explore','empty-search']

def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    root=ap.parse_args(args).root.resolve(); reports=[]; camera_rotation=None
    manifest=json.loads((root/'manifest.json').read_text())
    assert len(manifest['assets'])==8
    for name in NAMES:
        path=root/'models'/f'{name}.blend'
        bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False)
        scene=bpy.context.scene
        asset=bpy.data.collections.get('ASSET / '+name)
        assert asset is not None and len(asset.objects)>0
        assert len(scene.collection.children)==2,'One asset collection and one studio collection expected'
        assert all(o.type in ('MESH','CURVE') for o in asset.objects)
        meshes=[o for o in asset.objects if o.type=='MESH']
        curves=[o for o in asset.objects if o.type=='CURVE']
        assert len(meshes)>0
        assert all(len(o.data.vertices)>0 and len(o.data.polygons)>0 for o in meshes)
        assert all(len(o.data.splines)>0 and o.data.bevel_depth>0 for o in curves)
        assert all(math.isfinite(v) for o in meshes for p in o.data.vertices for v in p.co)
        assert len(bpy.data.libraries)==0,'Models must not link external libraries'
        assert not any(n.type=='TEX_IMAGE' for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes)
        assert scene.render.engine=='CYCLES' and scene.cycles.samples==512
        assert scene.render.film_transparent
        assert (scene.render.resolution_x,scene.render.resolution_y)==(768,768)
        assert scene.render.resolution_percentage==100
        assert scene.render.image_settings.file_format=='PNG'
        assert scene.render.image_settings.color_mode=='RGBA'
        assert scene.render.filepath==f'//../renders/{name}.png'
        assert scene.camera is not None and scene.camera.data.type=='ORTHO'
        rotation=tuple(scene.camera.rotation_euler)
        if camera_rotation is None:camera_rotation=rotation
        assert all(abs(a-b)<1e-6 for a,b in zip(camera_rotation,rotation))
        lights=[o for o in scene.objects if o.type=='LIGHT']
        assert len(lights)==3 and all(o.data.type=='AREA' for o in lights)
        assert len(scene.objects)==len(asset.objects)+4,'No floor, background or unaccounted object expected'
        reports.append({'name':name,'savedFile':str(path.relative_to(root)),
                        'status':'PASS','meshes':len(meshes),'editableCurves':len(curves),
                        'baseVertices':sum(len(o.data.vertices) for o in meshes),
                        'basePolygons':sum(len(o.data.polygons) for o in meshes),
                        'editableModifiers':sum(len(o.modifiers) for o in asset.objects),
                        'materials':sorted(set(m.name for o in asset.objects for m in o.data.materials)),
                        'cameraType':scene.camera.data.type,'cameraEuler':list(rotation),
                        'orthoScale':scene.camera.data.ortho_scale,'areaLights':len(lights),
                        'samples':scene.cycles.samples,'resolution':[768,768],
                        'filmTransparent':True,'externalImageTextures':False,
                        'renderPath':scene.render.filepath})
        print(f'REOPEN PASS {name}: {len(meshes)} meshes, {len(curves)} editable curves',flush=True)
    result={'validation':'Independent Blender saved-file reopen','application':bpy.app.version_string,
            'allPassed':True,'modelCount':len(reports),'models':reports}
    (root/'source'/'model-validation.json').write_text(json.dumps(result,indent=2)+'\n')
    print('PASS: all 8 .blend files reopened and validated',flush=True)

if __name__=='__main__':main()

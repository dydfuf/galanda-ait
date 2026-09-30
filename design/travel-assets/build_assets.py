#!/usr/bin/env python3
"""Galanda travel spots: editable original geometry, Blender 4.3+.

Run: blender -b --python source/build_assets.py -- --output . --resolution 768 --samples 512
Optional: --assets empty-trips create-trip --resolution 768 --no-render
All geometry is generated here. No downloaded assets, fonts, textures or HDRIs.
"""
import argparse
import math
import json
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

NAMES = ['empty-trips', 'create-trip', 'empty-saved', 'invite-companions',
         'compare-plans', 'confirm-plan', 'empty-explore', 'empty-search']
PALETTE = {
    'blue': '#3182F6', 'blue-light': '#73ACFA', 'blue-pale': '#CEE4FF',
    'ivory': '#F5F8FF', 'mint': '#83DBCE', 'slate': '#536B8F', 'ink': '#31547A',
}

def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def mat(name, value):
    c = [linear(int(value[i:i+2], 16) / 255) for i in (1, 3, 5)]
    m = bpy.data.materials.new('Clay / ' + name)
    m.diffuse_color = (*c, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*c, 1)
    p.inputs['Roughness'].default_value = .32
    p.inputs['IOR'].default_value = 1.44
    p.inputs['Coat Weight'].default_value = .10
    p.inputs['Coat Roughness'].default_value = .30
    p.inputs['Subsurface Weight'].default_value = .015
    return m

def finish(obj, name, material, smooth=True):
    obj.name = name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    ASSET.objects.link(obj)
    obj.data.materials.append(M[material])
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj

def bevel(obj, amount=.08, segments=5):
    mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
    mod.width = amount
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    norm = obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    norm.keep_sharp = True

def box(name, loc, scale, material, radius=.08, rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = rotation
    finish(obj, name, material)
    bevel(obj, min(radius, min(scale) * .48))
    return obj

def sphere(name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale if isinstance(scale, tuple) else (scale,) * 3
    return finish(obj, name, material)

def tube(name, pts, radius, material):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 24
    curve.bevel_depth = radius
    curve.bevel_resolution = 5
    curve.use_fill_caps = True
    s = curve.splines.new('BEZIER')
    s.bezier_points.add(len(pts)-1)
    for bp, co in zip(s.bezier_points, pts):
        bp.co = co
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    ASSET.objects.link(obj)
    obj.data.materials.append(M[material])
    sphere(name + ' / rounded start', pts[0], radius, material)
    sphere(name + ' / rounded end', pts[-1], radius, material)
    return obj

def segment(name, a, b, radius, material):
    return tube(name, [a, b], radius, material)

def disk(name, loc, radius, depth, material, bevel_width=.03):
    bpy.ops.mesh.primitive_cylinder_add(vertices=80, radius=radius, depth=depth,
                                      location=loc, rotation=(math.pi/2,0,0))
    obj = finish(bpy.context.object, name, material)
    bevel(obj, min(bevel_width, depth * .45))
    return obj

def ring(name, loc, radius, thickness, material):
    bpy.ops.mesh.primitive_torus_add(major_segments=96, minor_segments=24,
                                    location=loc, major_radius=radius,
                                    minor_radius=thickness, rotation=(math.pi/2,0,0))
    return finish(bpy.context.object, name, material)

def shape(name, points, y, depth, material, rounding=.035):
    """Extruded front-facing x/z polygon; remains a simple editable mesh."""
    n = len(points)
    verts = [(x,y-depth/2,z) for x,z in points] + [(x,y+depth/2,z) for x,z in points]
    faces = [tuple(range(n-1,-1,-1)), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    bm=bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(mesh); bm.free()
    obj = bpy.data.objects.new(name, mesh)
    ASSET.objects.link(obj)
    obj.data.materials.append(M[material])
    for p in mesh.polygons:
        p.use_smooth=True
    if rounding:
        bevel(obj, min(rounding, depth*.45), 5)
    return obj

def plus(name, x, y, z, size, material):
    box(name+' / horizontal', (x,y,z), (size,.09,size*.27), material, .04)
    box(name+' / vertical', (x,y-.006,z), (size*.27,.09,size), material, .04)

def pin(name, x,y,z, size=1, material='blue'):
    pts = [(0,-.67)]
    pts += [(.44*math.cos(t), .20+.44*math.sin(t))
            for t in [math.radians(-40+i*260/48) for i in range(49)]]
    shape(name, [(x+a*size,z+b*size) for a,b in pts], y, .22*size, material, .065*size)
    disk(name+' / center', (x,y-.14*size,z+.20*size), .155*size, .05*size, 'ivory', .02*size)

def suitcase():
    box('Case / main shell', (0,0,0), (1.68,.72,2.05), 'blue', .26)
    box('Case / front shell', (0,-.37,.005), (1.51,.105,1.86), 'blue', .05)
    # Long rounded raised ribs: no tiny UI-scale details.
    for x in (-.40,0,.40):
        box('Case / molded rib', (x,-.444,-.03), (.09,.08,1.25), 'blue-light', .04)
    for x in (-.53,.53):
        sphere('Case / wheel', (x,.05,-1.075), (.17,.21,.17), 'ink')
    tube('Case / telescoping handle', [(-.34,.05,1.00),(-.34,.05,1.43),
                                      (.34,.05,1.43),(.34,.05,1.00)], .063, 'slate')
    box('Case / soft handle grip', (0,.05,1.44), (.65,.20,.15), 'ivory', .07)
    tag = box('Case / luggage tag', (.57,-.49,.68), (.32,.10,.42), 'ivory', .048,
              rotation=(0,math.radians(-12),0))
    segment('Case / tag loop', (.52,-.49,.85), (.46,-.45,1.00), .026, 'mint')

def folded_map():
    # Three thick paper panels, deliberately alternating depth for clear real folds.
    xs = [-1.18,-.40,.40,1.18]
    ys = [.04,-.17,.08,-.15]
    for i in range(3):
        x0,x1=xs[i],xs[i+1]; y0,y1=ys[i],ys[i+1]
        mid=((x0+x1)/2,(y0+y1)/2,0)
        angle=math.atan2(y1-y0,x1-x0)
        obj=box('Map / folded panel '+str(i+1), mid,
                (math.hypot(x1-x0,y1-y0)+.025,.085,1.75),
                'ivory' if i!=1 else 'blue-pale', .04, rotation=(0,0,angle))
    def front_y(x):
        idx=0 if x<xs[1] else 1 if x<xs[2] else 2
        r=(x-xs[idx])/(xs[idx+1]-xs[idx])
        return ys[idx]+r*(ys[idx+1]-ys[idx])-.065
    path=[(-.90,-.40),(-.57,-.24),(-.26,-.32),(.10,-.20),(.22,.02)]
    tube('Map / wandering route', [(x,front_y(x)-.028,z) for x,z in path], .055,'mint')
    disk('Map / start point',(-.90,front_y(-.90)-.06,-.40),.11,.06,'blue-light')
    pin('Map / destination',.48,-.38,.64,.88)

def saved():
    box('Saved / back card', (-.20,.20,.10), (1.73,.23,2.05), 'blue-pale', .10,
        rotation=(0,math.radians(-9),0))
    box('Saved / front card', (.12,-.10,-.10), (1.73,.25,2.05), 'ivory', .11)
    # Bookmark has an actual notched silhouette.
    shape('Saved / bookmark ribbon',[(.37,.97),(.88,.97),(.88,.04),(.625,.25),(.37,.04)],
          -.30,.13,'blue',.045)
    disk('Saved / place dot',(-.39,-.267,.50),.17,.065,'mint')
    box('Saved / primary line',(-.12,-.261,-.26),(.82,.07,.12),'blue-light',.035)
    box('Saved / secondary line',(-.25,-.26,-.58),(.55,.06,.10),'blue-pale',.028)

def companions():
    # Friendly abstract people: intentionally no gender or facial features.
    sphere('Companion left / shoulders',(-.64,.20,-.27),(.61,.40,.63),'mint')
    sphere('Companion left / head',(-.64,.18,.69),.36,'ivory')
    sphere('Companion right / shoulders',(.43,-.14,-.42),(.69,.46,.68),'blue')
    sphere('Companion right / head',(.43,-.16,.62),.40,'ivory')
    disk('Companions / invitation badge',(1.02,-.30,1.04),.29,.14,'blue-pale',.055)
    plus('Companions / plus',1.02,-.40,1.04,.29,'blue')

def compare():
    for i,x in enumerate((-.66,.66)):
        # Identical dimensions, depths and header colors carry equal candidate weight.
        pre='Candidate '+str(i+1)
        box(pre+' / card',(x,0,0),(1.10,.25,1.84),'ivory',.115)
        box(pre+' / header',(x,-.14,.60),(.83,.10,.24),'blue-light',.045)
        tube(pre+' / route',[(x-.29,-.18,.14),(x-.09,-.19,.02),
                            (x+.15,-.19,.09),(x+.26,-.19,-.09)],.045,'blue')
        disk(pre+' / route start',(x-.29,-.20,.14),.083,.05,'mint')
        box(pre+' / detail line',(x-.05,-.16,-.46),(.63,.07,.095),'blue-pale',.03)

def confirm():
    box('Calendar / body',(0,0,0),(1.95,.33,1.96),'ivory',.14)
    box('Calendar / blue header',(0,-.19,.69),(1.80,.12,.45),'blue',.055)
    for x in (-.51,.51):
        tube('Calendar / binding',[ (x,-.26,.83),(x,-.25,1.11),
                                    (x,.08,1.11),(x,.12,.90)],.066,'blue-pale')
    for x in (-.58,-.10):
        for z in (.13,-.32):
            box('Calendar / day',(x,-.21,z),(.22,.09,.21),'blue-pale',.043)
    disk('Calendar / confirmed schedule badge',(.61,-.43,-.46),.49,.18,'blue',.065)
    tube('Calendar / check',[(.38,-.56,-.45),(.54,-.57,-.60),(.85,-.57,-.26)],.068,'ivory')

def compass():
    disk('Compass / back case',(0,0,0),1.02,.34,'blue',.09)
    disk('Compass / porcelain dial',(0,-.21,0),.86,.095,'ivory',.04)
    ring('Compass / bezel',(0,-.17,0),.96,.105,'blue')
    ring('Compass / top loop',(0,.04,1.11),.21,.075,'blue-pale')
    for x,z in [(0,.66),(.66,0),(0,-.66),(-.66,0)]:
        if x:
            box('Compass / direction tick',(x,-.275,z),(.12,.04,.045),'blue-light',.018)
        else:
            box('Compass / direction tick',(x,-.275,z),(.045,.04,.12),'blue-light',.018)
    shape('Compass / north needle',[(.36,.57),(-.18,.07),(.18,-.07)],-.34,.07,'blue',.028)
    shape('Compass / south needle',[(-.36,-.57),(.18,-.07),(-.18,.07)],-.34,.07,'mint',.028)
    sphere('Compass / needle hub',(0,-.405,0),.125,'ivory')

def search():
    box('Search / route card',(-.25,.12,.03),(1.63,.22,1.88),'ivory',.105,
        rotation=(0,math.radians(-7),0))
    tube('Search / route',[(-.77,-.04,-.34),(-.42,-.04,-.10),
                           (-.43,-.04,.24),(-.03,-.04,.44),(.32,-.04,.23)],.055,'mint')
    disk('Search / route start',(-.77,-.09,-.34),.12,.07,'blue-light')
    box('Search / card title',(-.30,-.04,.68),(.69,.06,.10),'blue-pale',.025,
        rotation=(0,math.radians(-7),0))
    ring('Search / magnifier rim',(.41,-.42,.12),.58,.115,'blue')
    segment('Search / magnifier handle',(.81,-.42,-.31),(1.15,-.42,-.84),.135,'blue')

BUILDERS = dict(zip(NAMES,[suitcase,folded_map,saved,companions,compare,confirm,compass,search]))

def area(studio,name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size; data.color=color
    obj=bpy.data.objects.new(name,data); studio.objects.link(obj); obj.location=loc
    obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()

def configure(name,resolution,samples):
    global ASSET,M
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene
    scene.name='Galanda / '+name
    ASSET=bpy.data.collections.new('ASSET / '+name); scene.collection.children.link(ASSET)
    studio=bpy.data.collections.new('STUDIO / transparent orthographic'); scene.collection.children.link(studio)
    M={k:mat(k,v) for k,v in PALETTE.items()}
    scene.render.engine='CYCLES'; scene.cycles.samples=samples
    scene.cycles.use_denoising=False; scene.cycles.seed=27
    scene.cycles.max_bounces=7; scene.cycles.transparent_max_bounces=4
    scene.render.resolution_x=resolution; scene.render.resolution_y=resolution; scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'; scene.render.image_settings.color_depth='8'
    scene.render.threads_mode='FIXED'; scene.render.threads=8
    scene.render.image_settings.compression=55
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    world=bpy.data.worlds.new('Neutral studio ambience'); world.use_nodes=True
    world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.78,.85,1,1)
    world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.32; scene.world=world
    area(studio,'Key / large softbox',(-3.8,-4.5,7),600,4.4,(1,.96,.91))
    area(studio,'Fill / cool softbox',(4.4,-2.2,3.1),390,4.0,(.86,.93,1))
    area(studio,'Rim / upper back',(1,4,5.8),650,3.5,(1,1,1))
    camdata=bpy.data.cameras.new('Camera / consistent 3-quarter'); cam=bpy.data.objects.new('Camera / consistent 3-quarter',camdata); studio.objects.link(cam)
    camdata.type='ORTHO'; camdata.lens=50; camdata.clip_start=.1; camdata.clip_end=100
    direction=Vector((4.3,-9,5.4)).normalized()
    cam.location=direction*12
    cam.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler(); scene.camera=cam
    return scene

def frame(scene):
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    pts=[]
    for o in ASSET.objects:
        if o.type not in ('MESH','CURVE'): continue
        eo=o.evaluated_get(deps)
        # Curve bound_box includes generous control-handle padding. Evaluate to
        # the real tessellated geometry so all silhouettes fill the same slot.
        mesh=eo.to_mesh()
        pts.extend(eo.matrix_world @ v.co for v in mesh.vertices)
        eo.to_mesh_clear()
    cam=scene.camera
    inverse=cam.rotation_euler.to_matrix().transposed()
    pp=[inverse @ p for p in pts]
    lo=Vector(tuple(min(p[i] for p in pp) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in pp) for i in range(3)))
    center=(lo+hi)/2
    target=cam.rotation_euler.to_matrix() @ center
    direction=cam.location.normalized()
    cam.location=target+direction*12
    cam.data.ortho_scale=max(hi.x-lo.x,hi.y-lo.y)/.785
    cam.data['occupancy_target']=.785
    scene['asset_name']=ASSET.name.replace('ASSET / ','')
    scene['transparent_background']=True
    scene['purpose']='Decorative 128px Galanda spot; text owns meaning.'
    scene['palette']=json.dumps(PALETTE)
    # Make each .blend pleasant to open in camera view with actual material previews.
    for scr in bpy.data.screens:
        for area_ in scr.areas:
            if area_.type=='VIEW_3D':
                area_.spaces.active.region_3d.view_perspective='CAMERA'
                area_.spaces.active.shading.type='MATERIAL'
    bpy.ops.object.select_all(action='DESELECT')
    obj=next((o for o in ASSET.objects if o.type=='MESH'),None)
    if obj: obj.select_set(True); bpy.context.view_layer.objects.active=obj
    return {'objects':len(ASSET.objects),'meshes':sum(o.type=='MESH' for o in ASSET.objects),
            'curves':sum(o.type=='CURVE' for o in ASSET.objects),
            'orthoScale':cam.data.ortho_scale,'projectedBounds':[list(lo),list(hi)]}

def main():
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument('--assets',nargs='+',choices=NAMES,default=NAMES)
    parser.add_argument('--resolution',type=int,default=768)
    parser.add_argument('--samples',type=int,default=512)
    parser.add_argument('--no-render',action='store_true')
    args=parser.parse_args(argv); root=Path(args.output).resolve()
    for d in ('models','renders','source'): (root/d).mkdir(parents=True,exist_ok=True)
    stats={}
    for name in args.assets:
        scene=configure(name,args.resolution,args.samples)
        BUILDERS[name]()
        stats[name]=frame(scene)
        # Portable when the delivery folder is moved: the blend lives in models/.
        scene.render.filepath=f'//../renders/{name}.png'
        bpy.ops.wm.save_as_mainfile(filepath=str(root/'models'/f'{name}.blend'),compress=True)
        if not args.no_render: bpy.ops.render.render(write_still=True)
        print('GALANDA_READY '+name,flush=True)
    path=root/'source'/'model-stats.json'
    old=json.loads(path.read_text()) if path.exists() else {}
    old.update(stats); path.write_text(json.dumps(old,indent=2)+'\n')

if __name__=='__main__':main()

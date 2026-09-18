"""Build Sol: a golden 3D sun with glossy sunglasses and speech morphs."""
import sys
sys.path.append('/usr/lib/python3/dist-packages')
import bpy, math, os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0,rough=.4):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
gold=material('Golden sunshine',(1,.72,.04),.04,.35)
raygold=material('Soft gold rays',(1,.38,.025),.08,.4)
dark=material('Burgundy frames',(.08,.012,.008),.1,.23)
lens=material('Spanish red lenses',(.36,.016,.009),.52,.14)
white=material('Warm smile',(.99,.94,.76),0,.3)
brown=material('Smile interior',(.10,.032,.012),0,.55)
blush=material('Peach cheeks',(1,.32,.10),0,.6)
root=bpy.data.objects.new('Sol',None);bpy.context.collection.objects.link(root)
def sphere(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat);o.parent=root
    for p in o.data.polygons:p.use_smooth=True
    return o
def curve(name,points,radius,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=4
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat);o.parent=root;return o
sphere('Sun',(0,0,.08),(.84,.32,.84),gold)
for i in range(12):
    a=i*math.pi/6
    # Rounded tapered rays, separated from the face by a little daylight.
    pts=[(-.105,0,.94),(.105,0,.94),(0,0,1.32)]
    verts=[]
    for y in [-.065,.065]:
        for x,_,z in pts:verts.append((x*math.cos(a)+z*math.sin(a),y,-x*math.sin(a)+z*math.cos(a)+.08))
    mesh=bpy.data.meshes.new('RayMesh');mesh.from_pydata(verts,[],[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)]);mesh.update()
    o=bpy.data.objects.new('Ray'+str(i),mesh);bpy.context.collection.objects.link(o);o.parent=root;o.data.materials.append(gold if i%2 else raygold)
    bevel=o.modifiers.new('Soft edges','BEVEL');bevel.width=.06;bevel.segments=5
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
for side,x in [('L',-.36),('R',.36)]:
    sphere('Frame_'+side,(x,-.303,.29),(.33,.07,.235),dark)
    sphere('Lens_'+side,(x,-.362,.295),(.282,.045,.186),lens)
    curve('Reflection_'+side,[(x-.19,-.406,.34),(x-.08,-.412,.43)],.012,white)
    sphere('Cheek_'+side,(x*1.45,-.25,-.13),(.10,.025,.055),blush)
curve('Bridge',[(-.08,-.36,.35),(0,-.385,.38),(.08,-.36,.35)],.033,dark)
curve('LeftTemple',[(-.62,-.30,.38),(-.77,-.20,.40)],.034,dark)
curve('RightTemple',[(.62,-.30,.38),(.77,-.20,.40)],.034,dark)
# Smile is on the front surface. jawOpen preserves the smile corners.
verts=[(0,-.328,-.24)];N=64
for i in range(N):
    a=2*math.pi*i/N;x=.32*math.cos(a);z=-.25+.075*math.sin(a)+.14*(x/.32)**2
    verts.append((x,-.335,z))
mesh=bpy.data.meshes.new('SmileMesh');mesh.from_pydata(verts,[],[(0,i+1,(i+1)%N+1) for i in range(N)]);mesh.update()
mouth=bpy.data.objects.new('Smile',mesh);bpy.context.collection.objects.link(mouth);mouth.parent=root;mesh.materials.append(brown)
mouth.shape_key_add(name='Basis')
key=mouth.shape_key_add(name='jawOpen')
for v in key.data:
    center=-.25+.14*(v.co.x/.32)**2
    if v.co.z<center:v.co.z-=.18*max(0,1-(v.co.x/.32)**2)
key=mouth.shape_key_add(name='mouthRound')
for v in key.data:v.co.x*=.75;v.co.z=-.22+(v.co.z+.22)*1.2
curve('SmileTeeth',[(x,-.345,-.23+.14*(x/.32)**2) for x in [-.265+i*.53/40 for i in range(41)]],.022,white)
os.makedirs('public/assets',exist_ok=True)
os.makedirs('design',exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('design/sol.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/assets/host-avatar.glb'),export_format='GLB',export_morph=True,export_animations=False)
print('Sol exported with jawOpen and mouthRound speech morphs.')

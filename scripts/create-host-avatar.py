"""Build Lola: a Spanish classical-guitar host with speech morphs."""
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
root=bpy.data.objects.new('Lola',None);bpy.context.collection.objects.link(root)
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
# A smooth hourglass outline, extruded with warm wood and rounded binding.
wood=material('Honey cedar',(.66,.29,.075),0,.36)
edge=material('Rosewood binding',(.16,.043,.017),0,.32)
eye=material('Eye whites',(1,.93,.75),0,.28)
pupil=material('Dark eyes',(.022,.012,.006),0,.2)
outline=[(0,.43),(.27,.50),(.48,.42),(.55,.24),(.50,.08),(.36,-.10),(.42,-.27),(.62,-.47),(.69,-.70),(.62,-.98),(.38,-1.15),(0,-1.20)]
outline=outline+[(-x,z) for x,z in reversed(outline[1:-1])]
# Catmull-Rom rounds each shoulder without a heavy subdivision mesh.
pts=[]
for i,p1 in enumerate(outline):
 p0=outline[(i-1)%len(outline)];p2=outline[(i+1)%len(outline)];p3=outline[(i+2)%len(outline)]
 for j in range(8):
  t=j/8;pts.append(tuple(.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in range(2)))
n=len(pts);verts=[(x,y,z) for y in [-.16,.14] for x,z in pts]
faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
mesh=bpy.data.meshes.new('GuitarBody');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Cedar soundboard',mesh);bpy.context.collection.objects.link(o);o.parent=root;o.data.materials.append(wood)
bevel=o.modifiers.new('Rounded body','BEVEL');bevel.width=.045;bevel.segments=4;o.modifiers.new('Normals','WEIGHTED_NORMAL')
curve('Binding',[(x,-.19,z) for x,z in pts]+[(pts[0][0],-.19,pts[0][1])],.025,edge)
sphere('Neck',(0,0,.82),(.105,.075,.57),edge)
sphere('Headstock',(0,0,1.36),(.15,.085,.26),wood)
for z in [1.22,1.36,1.50]:
 curve('Tuning axle',[(-.19,0,z),(.19,0,z)],.018,gold)
 for x in [-.21,.21]:sphere('Tuning peg',(x,0,z),(.045,.032,.023),white)
sphere('Sound hole',(0,-.198,-.32),(.195,.018,.195),brown)
for r,mat in [(.205,gold),(.23,edge),(.248,gold)]:curve('Rosette',[(r*math.cos(i*math.pi/48),-.218,-.32+r*math.sin(i*math.pi/48)) for i in range(97)],.008,mat)
sphere('Bridge',(0,-.19,-.72),(.22,.035,.037),edge)
for x in [-.055,-.033,-.011,.011,.033,.055]:curve('String',[(x,-.236,-.72),(x,-.12,1.49)],.0026,white)
for side,x in [('L',-.27),('R',.27)]:
 sphere('EyeWhite_'+side,(x,-.225,.14),(.15,.045,.18),eye)
 sphere('Iris_'+side,(x,-.269,.13),(.080,.020,.108),edge)
 sphere('Pupil_'+side,(x,-.285,.13),(.054,.012,.079),pupil)
 sphere('Catchlight_'+side,(x-.022,-.298,.17),(.021,.009,.024),white)
 curve('Brow_'+side,[(x-.11+i*.22/20,-.235,.36+.04*math.sin(i*math.pi/20)) for i in range(21)],.017,edge)
curve('Red ribbon',[(-.14,-.12,.49),(0,-.16,.43),(.14,-.12,.49)],.045,lens)
curve('Ribbon tail',[(0,-.18,.43),(.16,-.20,.28)],.033,lens)
# Smile is on the front surface. jawOpen preserves the smile corners.
verts=[(0,-.328,-.24)];N=64
for i in range(N):
    a=2*math.pi*i/N;x=.32*math.cos(a);z=-.25+.075*math.sin(a)+.14*(x/.32)**2
    verts.append((x,-.335,z))
mesh=bpy.data.meshes.new('SmileMesh');mesh.from_pydata(verts,[],[(0,i+1,(i+1)%N+1) for i in range(N)]);mesh.update()
mouth=bpy.data.objects.new('Smile',mesh);bpy.context.collection.objects.link(mouth);mouth.parent=root;mesh.materials.append(brown)
for v in mesh.vertices:v.co.z-=.70;v.co.y+=.09
mouth.shape_key_add(name='Basis')
key=mouth.shape_key_add(name='jawOpen')
for v in key.data:
    center=-.95+.14*(v.co.x/.32)**2
    if v.co.z<center:v.co.z-=.18*max(0,1-(v.co.x/.32)**2)
key=mouth.shape_key_add(name='mouthRound')
for v in key.data:v.co.x*=.75;v.co.z=-.92+(v.co.z+.92)*1.2
curve('SmileTeeth',[(x,-.255,-.93+.14*(x/.32)**2) for x in [-.265+i*.53/40 for i in range(41)]],.022,white)
os.makedirs('public/assets',exist_ok=True)
os.makedirs('design',exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('design/lola.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/assets/lola-avatar.glb'),export_format='GLB',export_morph=True,export_animations=False)
print('Lola exported with jawOpen and mouthRound speech morphs.')

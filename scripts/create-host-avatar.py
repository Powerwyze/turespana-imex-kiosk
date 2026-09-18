"""Trace the official España sun symbol and extrude it in Blender. Cloud build only."""
import sys
sys.path.append('/usr/lib/python3/dist-packages')
import bpy, cv2, numpy as np, os, math
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Source is the unchanged official 512px PNG. Everything below row 320 is lettering.
source=cv2.imread('public/assets/spain-info-logo.png')[:320]
b,g,r=cv2.split(source)
masks=[('Yellow crescent',(r>150)&(g>130)&(b<110),'#ffe500',(1,.79,.005),.015),
       ('Black sun and star',(r<105)&(g<105)&(b<105),'#151515',(.014,.014,.014),0),
       ('Red sun',(r>140)&(g<110)&(b<100),'#ee2106',(.86,.025,.004),.055)]
shapes=[]
for name,mask,hexcolor,color,depth in masks:
 contours,hierarchy=cv2.findContours(mask.astype(np.uint8)*255,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
 paths=[]
 for contour in contours:
  if abs(cv2.contourArea(contour))<8:continue
  points=cv2.approxPolyDP(contour,.6,True).reshape(-1,2)
  paths.append(points)
 shapes.append((name,paths,hexcolor,color,depth))
allpoints=np.concatenate([p for _,paths,_,_,_ in shapes for p in paths]);low=allpoints.min(axis=0);high=allpoints.max(axis=0);center=(low+high)/2;scale=3.05/(high-low).max()
root=bpy.data.objects.new('SpainSun',None);bpy.context.collection.objects.link(root)
svg=[]
for name,paths,hexcolor,color,depth in shapes:
 material=bpy.data.materials.new(name);material.diffuse_color=(*color,1);material.use_nodes=True
 bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*color,1);bsdf.inputs['Metallic'].default_value=.08;bsdf.inputs['Roughness'].default_value=.32
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='2D';curve.resolution_u=1;curve.fill_mode='BOTH';curve.extrude=.085;curve.bevel_depth=.014;curve.bevel_resolution=3;curve.resolution_u=2
 d=[]
 for points in paths:
  spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
  for point,(x,y) in zip(spline.points,points):point.co=((float(x)-center[0])*scale,(center[1]-float(y))*scale,0,1)
  spline.use_cyclic_u=True
  d.append('M '+' L '.join(str(int(x))+' '+str(int(y)) for x,y in points)+' Z')
 obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.location.z=depth;obj.parent=root;curve.materials.append(material)
 bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH');obj.select_set(False)
 svg.append('<path fill="'+hexcolor+'" fill-rule="evenodd" d="'+' '.join(d)+'"/>')
os.makedirs('public/assets',exist_ok=True);os.makedirs('design',exist_ok=True)
view=' '.join(str(int(v)) for v in [low[0]-2,low[1]-2,high[0]-low[0]+4,high[1]-low[1]+4])
open('public/assets/spain-sun-fallback.svg','w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+view+'">'+''.join(svg)+'</svg>')
# Export only the actual solid symbol, not the preview lights or camera.
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for obj in root.children:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/assets/spain-sun.glb'),export_format='GLB',use_selection=True,export_animations=False)
# Save an editable, lit Blender scene and a transparent verification render.
bpy.ops.object.camera_add(location=(.55,.28,7));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=3.85;bpy.context.scene.camera=camera
for name,loc,power,size in [('Key',(-3,4,5),450,4),('Fill',(3,1,4),250,3),('Edge',(-1,-3,2),150,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);lamp=bpy.context.object;lamp.name=name;lamp.data.energy=power;lamp.data.size=size;lamp.rotation_euler=(-lamp.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.film_transparent=True;scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.abspath('public/assets/spain-sun-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('design/spain-sun.blend'));bpy.ops.render.render(write_still=True)
print('Extruded sun only; source bounds:',low.tolist(),high.tolist(),'mesh objects:',len(root.children))

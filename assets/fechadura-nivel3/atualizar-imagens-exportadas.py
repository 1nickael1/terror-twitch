import bpy
from pathlib import Path
root=Path('C:/projetos/lives-twitch/scp-terror/assets')
loaded={};report=[]
for level,name in [(1,'Mesh0'),(2,'Fechadura_Nivel_2'),(3,'Fechadura_Nivel_3')]:
 obj=bpy.data.objects[name]
 for mat in obj.data.materials:
  for node in mat.node_tree.nodes:
   if node.type!='TEX_IMAGE' or not node.image:continue
   old=node.image;path=Path(bpy.path.abspath(old.filepath_raw))
   if not path.is_file():continue
   key=(str(path),old.colorspace_settings.name)
   if key not in loaded:
    new=bpy.data.images.load(str(path),check_existing=False);new.name=old.name+'_ExportacaoAtualizada';new.colorspace_settings.name=old.colorspace_settings.name;new.pack();loaded[key]=new
   node.image=loaded[key]
 out=root/('fechadura-nivel'+str(level))
 loc=obj.location.copy();obj.location.x=0
 for o in bpy.context.selected_objects:o.select_set(False)
 obj.select_set(True);bpy.context.view_layer.objects.active=obj
 for index,state in [(0,'bloqueada'),(1,'liberada')]:
  for poly in obj.data.polygons:poly.material_index=index
  bpy.ops.export_scene.gltf(filepath=str(out/('fechadura-nivel'+str(level)+'-'+state+'.glb')),export_format='GLB',use_selection=True,export_extras=True)
 for poly in obj.data.polygons:poly.material_index=0
 obj.active_material_index=0;obj.location=loc
 report.append({'nivel':level,'materiais':[m.name for m in obj.data.materials]})
bpy.ops.wm.save_as_mainfile(filepath=str(root/'fechadura-nivel3'/'fechaduras-niveis1-2-3.blend'))
result={'imagens_reempacotadas':len(loaded),'exportados':report}

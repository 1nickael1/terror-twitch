import bpy,numpy as np
from pathlib import Path
out=Path('C:/projetos/lives-twitch/scp-terror/assets/fechadura-nivel2')
obj=bpy.data.objects['Fechadura_Nivel_2'];original=bpy.data.objects['Mesh0']
for i in [0,1]:
 mat=obj.data.materials[i];parent=original.data.materials[i]
 for node in mat.node_tree.nodes:
  if node.type!='TEX_IMAGE' or not node.image or 'Emission' in node.image.name:continue
  im=node.image
  source_node=next((n for n in parent.node_tree.nodes if n.name==node.name),None)
  if source_node is None or not source_node.image:continue
  src=np.array(source_node.image.pixels[:],dtype=np.float32).reshape(2048,2048,4)[::-1]
  p=np.array(im.pixels[:],dtype=np.float32).reshape(2048,2048,4)[::-1].copy()
  # Uma área sem letras nem traços: o novo título não herda riscos da inscrição anterior.
  patch=np.tile(src[1350:1400,1550:1630],(1,3,1))[:,:220].copy()
  if im.colorspace_settings.name=='sRGB':
   v=np.max(patch[:,:,:3],axis=2);patch[:,:,0]=np.minimum(v*1.95,1);patch[:,:,1]=patch[:,:,0]*.46;patch[:,:,2]=patch[:,:,0]*.055
  p[1406:1456,1630:1850]=patch
  if im.colorspace_settings.name=='sRGB':
   label=bpy.data.images.load(str(out/'rotulo-nivel-2.png'),check_existing=True)
   l=np.array(label.pixels[:],dtype=np.float32).reshape(50,220,4)[::-1];alpha=l[:,:,3:4]
   p[1406:1456,1630:1850,:3]=p[1406:1456,1630:1850,:3]*(1-alpha)+l[:,:,:3]*alpha
  im.pixels.foreach_set(p[::-1].copy().ravel());im.update();im.save();im.pack()
# O modelo exporta na origem; o posicionamento lado a lado é apenas da cena Blender.
x=obj.location.x;obj.location.x=0
for o in bpy.context.selected_objects:o.select_set(False)
obj.select_set(True);bpy.context.view_layer.objects.active=obj
for index,state in [(0,'bloqueada'),(1,'liberada')]:
 for poly in obj.data.polygons:poly.material_index=index
 bpy.ops.export_scene.gltf(filepath=str(out/('fechadura-nivel2-'+state+'.glb')),export_format='GLB',use_selection=True,export_extras=True)
for poly in obj.data.polygons:poly.material_index=0
obj.active_material_index=0;obj.location.x=x
bpy.ops.wm.save_as_mainfile(filepath=str(out/'fechaduras-niveis1-2.blend'))
im=next(n.image for n in obj.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
p=np.array(im.pixels[:],dtype=np.float32).reshape(2048,2048,4)[::-1]
c=bpy.data.images.new('Conferencia_titulo_limpo',width=540,height=360,alpha=True)
c.pixels.foreach_set(p[1130:1490,1460:2000][::-1].copy().ravel());c.filepath_raw=str(out/'placa-nivel2-corrigida.png');c.file_format='PNG';c.save()
result={'corrigido':True}

import bpy,numpy as np
from pathlib import Path
out=Path('C:/projetos/lives-twitch/scp-terror/assets/fechadura-nivel2')
original=bpy.data.objects['Mesh0']
obj=original.copy();obj.data=original.data.copy();obj.name='Fechadura_Nivel_2';bpy.context.collection.objects.link(obj)
obj.data.materials.clear();obj['nivel_acesso']=2
obj['estados_acesso']='Bloqueada: material 0 / Liberada: material 1'
ref=next(n.image for n in original.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
a=np.array(ref.pixels[:],dtype=np.float32).reshape(2048,2048,4)[::-1]
white=(a[:,:,:3].min(axis=2)>.52)&(a[:,:,:3].max(axis=2)-a[:,:,:3].min(axis=2)<.25)
mask=np.zeros((2048,2048),dtype=bool)
mask[1180:1410,1600:1840]=white[1180:1410,1600:1840]
mask[1406:1456,1630:1850]=white[1406:1456,1630:1850]
# Inclui a borda do glifo antigo, sem mexer nos traços laterais da placa.
mask=mask|np.roll(mask,1,0)|np.roll(mask,-1,0)|np.roll(mask,1,1)|np.roll(mask,-1,1)
y,x=np.where(mask)
labels=[]
for file,rect in [('numero-2.png',(1600,1180,1840,1410)),('rotulo-nivel-2.png',(1630,1406,1850,1456))]:
 im=bpy.data.images.load(str(out/file),check_existing=True)
 labels.append((np.array(im.pixels[:],dtype=np.float32).reshape(im.size[1],im.size[0],4)[::-1],rect))
for state,parent in [('Bloqueada',original.data.materials[0]),('Liberada',original.data.materials[1])]:
 mat=parent.copy();mat.name='Fechadura_N2_'+state
 for node in mat.node_tree.nodes:
  if node.type!='TEX_IMAGE' or not node.image:continue
  source=node.image
  # A emissão do LED é compartilhada: só o identificador de nível muda.
  if 'Emission' in source.name:continue
  p=np.array(source.pixels[:],dtype=np.float32).reshape(2048,2048,4)[::-1].copy()
  p[y,x]=p[y,x-135]
  if source.colorspace_settings.name=='sRGB':
   r,g,b=p[:,:,0],p[:,:,1],p[:,:,2];v=np.max(p[:,:,:3],axis=2)
   panel=np.zeros((2048,2048),dtype=bool);panel[1165:1470,1488:1975]=True
   olive=panel&(r>g*.85)&(g>r*.75)&(g>b*1.12)&(v>.12)&((v-p[:,:,:3].min(axis=2))>.045)
   val=np.minimum(v[olive]*1.95,1)
   p[olive,0]=val;p[olive,1]=val*.46;p[olive,2]=val*.055
   for label,(x0,y0,x1,y1) in labels:
    alpha=label[:,:,3:4];p[y0:y1,x0:x1,:3]=p[y0:y1,x0:x1,:3]*(1-alpha)+label[:,:,:3]*alpha
  cp=source.copy();cp.name='N2_'+state+'_'+source.name
  cp.pixels.foreach_set(p[::-1].copy().ravel());cp.update();cp.filepath_raw=str(out/(cp.name.replace('.png','')+'.png'));cp.file_format='PNG';cp.save();cp.pack();node.image=cp
 obj.data.materials.append(mat)
for o in bpy.context.selected_objects:o.select_set(False)
obj.select_set(True);bpy.context.view_layer.objects.active=obj
for index,state in [(0,'bloqueada'),(1,'liberada')]:
 for poly in obj.data.polygons:poly.material_index=index
 bpy.ops.export_scene.gltf(filepath=str(out/('fechadura-nivel2-'+state+'.glb')),export_format='GLB',use_selection=True,export_extras=True)
for poly in obj.data.polygons:poly.material_index=0
obj.active_material_index=0
# Compara os dois níveis no arquivo editável, sem alterar o original salvo de nível 1.
obj.location.x=original.location.x+1.55
bpy.ops.wm.save_as_mainfile(filepath=str(out/'fechaduras-niveis1-2.blend'))
result={'objeto':obj.name,'materiais':[m.name for m in obj.data.materials],'blend':bpy.data.filepath,'triangulos':sum(len(p.vertices)-2 for p in obj.data.polygons)}

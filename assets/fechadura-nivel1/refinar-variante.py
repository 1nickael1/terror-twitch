import bpy,numpy as np
from pathlib import Path
out=Path('C:/projetos/lives-twitch/scp-terror/assets/fechadura-nivel1')
obj=bpy.data.objects['Mesh0'];old=obj.data.materials[0];new=obj.data.materials[1]
source=next(n.image for n in old.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
a=np.array(source.pixels[:],dtype=np.float32).reshape(2048,2048,4)[::-1].copy()
r,g,b=a[:,:,0],a[:,:,1],a[:,:,2];br=np.max(a[:,:,:3],axis=2)
led=(r>.25)&(g>.12)&(r>g*1.2)&(g>b*1.5)&((r-b)>.18)
patch=led[1892:1935,1616:1702]
patch|=(br[1892:1935,1616:1702]>.25)&(r[1892:1935,1616:1702]>g[1892:1935,1616:1702]*.9)
base=bpy.data.images['Fechadura_N1_Liberada_BaseColor']
p=np.array(base.pixels[:],dtype=np.float32).reshape(2048,2048,4)[::-1].copy()
p[led,0]=br[led]*.12;p[led,1]=br[led];p[led,2]=br[led]*.32
base.pixels.foreach_set(p[::-1].copy().ravel());base.update();base.save();base.pack()
e=np.zeros_like(p);e[:,:,3]=1;e[led,:3]=p[led,:3]
em=bpy.data.images['Fechadura_N1_LED_Verde_Emission'];em.pixels.foreach_set(e[::-1].copy().ravel());em.update();em.save();em.pack()
# Limpa também a marca antiga nos mapas de relevo e superfície, só no retângulo da inscrição.
for node in new.node_tree.nodes:
 if node.type!='TEX_IMAGE' or not node.image or node.image.colorspace_settings.name!='Non-Color':continue
 im=node.image;arr=np.array(im.pixels[:],dtype=np.float32).reshape(2048,2048,4)[::-1].copy()
 arr[1894:1928,1710:1900]=arr[1932:1966,1710:1900].copy()
 cp=im.copy();cp.name='Liberada_'+im.name;cp.pixels.foreach_set(arr[::-1].copy().ravel());cp.update()
 cp.filepath_raw=str(out/cp.name);cp.file_format='PNG';cp.save();cp.pack();node.image=cp
for poly in obj.data.polygons:poly.material_index=1
bpy.ops.export_scene.gltf(filepath=str(out/'fechadura-nivel1-liberada.glb'),export_format='GLB',use_selection=True,export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'fechadura-nivel1-variantes.blend'))
bpy.ops.screen.screenshot(filepath=str(out/'previa-blender.png'))
result={'ajustado':True,'pixels_led':int(led.sum())}

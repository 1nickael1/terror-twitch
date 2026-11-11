import bpy,numpy as np
from pathlib import Path
out=Path('C:/projetos/lives-twitch/scp-terror/assets/fechadura-nivel2')
obj=bpy.data.objects['Fechadura_Nivel_2'];mat=obj.data.materials[0]
im=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
a=np.array(im.pixels[:],dtype=np.float32).reshape(2048,2048,4)[::-1];c=a[1130:1490,1460:2000]
p=bpy.data.images.new('Conferencia_nivel2',width=540,height=360,alpha=True);p.pixels.foreach_set(c[::-1].copy().ravel());p.filepath_raw=str(out/'placa-nivel2.png');p.file_format='PNG';p.save()
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  region=next(r for r in area.regions if r.type=='WINDOW')
  with bpy.context.temp_override(area=area,region=region):bpy.ops.view3d.view_all(center=False)
result={'previa':p.filepath_raw}

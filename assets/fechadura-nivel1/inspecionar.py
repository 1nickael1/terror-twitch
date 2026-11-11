import bpy
from pathlib import Path
out=Path('C:/projetos/lives-twitch/scp-terror/assets/fechadura-nivel1')
info={'arquivo':bpy.data.filepath,'objetos':[], 'imagens':[]}
for obj in bpy.context.scene.objects:
 info['objetos'].append({'nome':obj.name,'tipo':obj.type,'materiais':[m.name if m else None for m in getattr(obj.data,'materials',[])],'dimensoes':list(obj.dimensions)})
for mat in bpy.data.materials:
 if not mat.use_nodes: continue
 for node in mat.node_tree.nodes:
  if node.type=='TEX_IMAGE' and node.image:
   im=node.image
   info['imagens'].append({'material':mat.name,'node':node.name,'imagem':im.name,'size':list(im.size),'colorspace':im.colorspace_settings.name,'links':[(l.to_node.name,l.to_socket.name) for l in node.outputs['Color'].links]})
   if im.colorspace_settings.name=='sRGB':
    cp=im.copy(); cp.filepath_raw=str(out/'textura-bloqueada-original.png'); cp.file_format='PNG'; cp.save()
result=info

import bpy, numpy as np
from pathlib import Path
out=Path('C:/projetos/lives-twitch/scp-terror/assets/fechadura-nivel1')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'fechadura-nivel1-original.blend'),copy=True)
obj=bpy.data.objects['Mesh0']
mat=obj.data.materials[0]
mat.name='Fechadura_N1_Bloqueada'
source=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
w,h=source.size
assert (w,h)==(2048,2048)
a=np.empty(w*h*4,dtype=np.float32);source.pixels.foreach_get(a);a=a.reshape(h,w,4)[::-1].copy()
r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
led=(r>.25)&(g>.12)&(r>g*1.2)&(g>b*1.5)&((r-b)>.18)
brightness=np.max(a[:,:,:3],axis=2)
a[led,0]=brightness[led]*.12;a[led,1]=brightness[led];a[led,2]=brightness[led]*.32
# Troca só a inscrição do estado. O fundo vem da mesma placa, logo abaixo do texto.
a[1894:1928,1710:1900]=a[1932:1966,1710:1900].copy()
label=bpy.data.images.load(str(out/'rotulo-liberado.png'),check_existing=True)
l=np.array(label.pixels[:],dtype=np.float32).reshape(34,190,4)[::-1]
alpha=l[:,:,3:4]
a[1894:1928,1710:1900,:3]=a[1894:1928,1710:1900,:3]*(1-alpha)+l[:,:,:3]*alpha
aberta=bpy.data.images.new('Fechadura_N1_Liberada_BaseColor',width=w,height=h,alpha=True)
aberta.colorspace_settings.name='sRGB';aberta.pixels.foreach_set(a[::-1].copy().ravel());aberta.update()
aberta.filepath_raw=str(out/'textura-liberada.png');aberta.file_format='PNG';aberta.save();aberta.pack()
e=np.zeros_like(a);e[:,:,3]=1;e[led,:3]=a[led,:3]
emissiva=bpy.data.images.new('Fechadura_N1_LED_Verde_Emission',width=w,height=h,alpha=True)
emissiva.colorspace_settings.name='sRGB';emissiva.pixels.foreach_set(e[::-1].copy().ravel());emissiva.update()
emissiva.filepath_raw=str(out/'led-verde-emissao.png');emissiva.file_format='PNG';emissiva.save();emissiva.pack()
novo=mat.copy();novo.name='Fechadura_N1_Liberada'
for node in novo.node_tree.nodes:
 if node.type=='TEX_IMAGE' and node.image==source:node.image=aberta
bsdf=next(n for n in novo.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
em=novo.node_tree.nodes.new('ShaderNodeTexImage');em.name='LED verde / estado liberado';em.image=emissiva
novo.node_tree.links.new(em.outputs['Color'],bsdf.inputs['Emission Color']);bsdf.inputs['Emission Strength'].default_value=2.0
obj.data.materials.append(novo)
obj['estados_acesso']='Bloqueada: material 0 / Liberada: material 1';obj['nivel_acesso']=1
for o in bpy.context.selected_objects:o.select_set(False)
obj.select_set(True);bpy.context.view_layer.objects.active=obj
for poly in obj.data.polygons:poly.material_index=0
bpy.ops.export_scene.gltf(filepath=str(out/'fechadura-nivel1-bloqueada.glb'),export_format='GLB',use_selection=True,export_extras=True)
for poly in obj.data.polygons:poly.material_index=1
bpy.ops.export_scene.gltf(filepath=str(out/'fechadura-nivel1-liberada.glb'),export_format='GLB',use_selection=True,export_extras=True)
obj.active_material_index=1
bpy.ops.wm.save_as_mainfile(filepath=str(out/'fechadura-nivel1-variantes.blend'))
result={'pixels_led':int(led.sum()),'materiais':[m.name for m in obj.data.materials],'blend':bpy.data.filepath,'glb_bloqueada':str(out/'fechadura-nivel1-bloqueada.glb'),'glb_liberada':str(out/'fechadura-nivel1-liberada.glb')}

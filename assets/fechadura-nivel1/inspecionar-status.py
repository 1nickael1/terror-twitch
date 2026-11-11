import bpy
from pathlib import Path
out=Path('C:/projetos/lives-twitch/scp-terror/assets/fechadura-nivel1')
source=bpy.data.images.get('texture_0.png')
p=bpy.data.images.new('inspecao-status',width=470,height=170,alpha=True)
import numpy as np
a=np.empty(2048*2048*4,dtype=np.float32);source.pixels.foreach_get(a);a=a.reshape(2048,2048,4)[::-1]
p.pixels.foreach_set(a[1860:2030,1510:1980][::-1].copy().ravel());p.filepath_raw=str(out/'status-original.png');p.file_format='PNG';p.save()
result={'export_props':[p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties if 'material' in p.identifier or 'image' in p.identifier or 'extra' in p.identifier]}

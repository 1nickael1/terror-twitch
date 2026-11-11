import bpy,numpy as np
from pathlib import Path
out=Path('C:/projetos/lives-twitch/scp-terror/assets/fechadura-nivel2')
im=bpy.data.images.load(str(out/'previa-blender.png'),check_existing=False)
w,h=im.size;a=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4)[::-1]
x0,x1=int(w*.24),int(w*.605);y0,y1=int(h*.225),int(h*.70)
c=a[y0:y1,x0:x1]
p=bpy.data.images.new('Previa_niveis_1_e_2',width=x1-x0,height=y1-y0,alpha=True)
p.pixels.foreach_set(c[::-1].copy().ravel());p.filepath_raw=str(out/'previa-niveis1-2.png');p.file_format='PNG';p.save()
result={'previa':p.filepath_raw}

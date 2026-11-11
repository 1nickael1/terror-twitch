import bpy,numpy as np
from pathlib import Path
out=Path('C:/projetos/lives-twitch/scp-terror/assets/fechadura-nivel1')
bpy.ops.screen.screenshot(filepath=str(out/'previa-blender.png'))
im=bpy.data.images.load(str(out/'previa-blender.png'),check_existing=False)
w,h=im.size;a=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4)[::-1]
x0,x1=int(w*.318),int(w*.526);y0,y1=int(h*.185),int(h*.73)
c=a[y0:y1,x0:x1]
p=bpy.data.images.new('Previa_fechadura_liberada',width=x1-x0,height=y1-y0,alpha=True)
p.pixels.foreach_set(c[::-1].copy().ravel());p.file_format='PNG';p.filepath_raw=str(out/'previa-fechadura-liberada.png');p.save()
result={'previa':p.filepath_raw}

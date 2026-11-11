import bpy
from pathlib import Path
out=Path('C:/projetos/lives-twitch/scp-terror/assets/fechadura-nivel2')
obj=bpy.data.objects['Fechadura_Nivel_2']
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  region=next(r for r in area.regions if r.type=='WINDOW')
  with bpy.context.temp_override(area=area,region=region):bpy.ops.view3d.view_selected(use_all_regions=False)
  area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=str(out/'fechaduras-niveis1-2.blend'))
result={'arquivo':bpy.data.filepath,'estado':'nivel2-bloqueada'}

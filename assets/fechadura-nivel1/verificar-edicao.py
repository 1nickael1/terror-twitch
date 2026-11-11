import bpy, importlib.util
result={'pillow':importlib.util.find_spec('PIL') is not None,'numpy':importlib.util.find_spec('numpy') is not None,'areas':[a.type for a in bpy.context.screen.areas]}

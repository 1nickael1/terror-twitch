import copy,hashlib,json,struct
from pathlib import Path
out=Path(__file__).resolve().parent

def ler(path):
 b=path.read_bytes();assert b[:4]==b'glTF';n=struct.unpack_from('<I',b,12)[0]
 return json.loads(b[20:20+n]),b[28+n:]

def imagem_bytes(j,b,im):
 v=j['bufferViews'][im['bufferView']];o=v.get('byteOffset',0);return b[o:o+v['byteLength']]

j,b=ler(out.parent/'fechadura-nivel2'/'fechaduras-niveis1-2.glb');alt,ab=ler(out/'fechadura-nivel3-variantes.glb')
buf=bytearray(b[:j['buffers'][0]['byteLength']]); hashes={hashlib.sha256(imagem_bytes(j,b,im)).digest():i for i,im in enumerate(j['images'])}
imap={}
for i,im in enumerate(alt['images']):
 data=imagem_bytes(alt,ab,im);h=hashlib.sha256(data).digest()
 if h in hashes:imap[i]=hashes[h];continue
 while len(buf)%4:buf.append(0)
 v=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(buf),'byteLength':len(data)});buf.extend(data)
 new=copy.deepcopy(im);new['bufferView']=v;imap[i]=len(j['images']);j['images'].append(new);hashes[h]=imap[i]
smap={}
for i,s in enumerate(alt.get('samplers',[])):
 samplers=j.setdefault('samplers',[])
 if s not in samplers:samplers.append(copy.deepcopy(s))
 smap[i]=samplers.index(s)
tmap={}
for i,t in enumerate(alt['textures']):
 t=copy.deepcopy(t);t['source']=imap[t['source']]
 if 'sampler' in t:t['sampler']=smap[t['sampler']]
 if t not in j['textures']:j['textures'].append(t)
 tmap[i]=j['textures'].index(t)
materiais=copy.deepcopy(alt['materials'])
def remap(d):
 if isinstance(d,dict):
  for key,val in d.items():
   if key.endswith('Texture') and isinstance(val,dict) and 'index' in val:val['index']=tmap[val['index']]
   else:remap(val)
 elif isinstance(d,list):
  for val in d:remap(val)
for material in materiais:
 remap(material);j['materials'].append(material)
for ext in alt.get('extensionsUsed',[]):
 if ext not in j.setdefault('extensionsUsed',[]):j['extensionsUsed'].append(ext)
j['extensionsUsed']=list(dict.fromkeys(j['extensionsUsed']+['KHR_materials_variants']))
j.setdefault('extensions',{})['KHR_materials_variants']={'variants':[{'name':name} for name in ['nivel1-bloqueada','nivel1-liberada','nivel2-bloqueada','nivel2-liberada','nivel3-bloqueada','nivel3-liberada']]}
for mesh in j['meshes']:
 for p in mesh['primitives']:
  p.setdefault('extensions',{})['KHR_materials_variants']={'mappings':[{'material':i,'variants':[i]} for i in range(6)]}
j['buffers'][0]['byteLength']=len(buf)
while len(buf)%4:buf.append(0)
data=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
result=struct.pack('<III',0x46546c67,2,28+len(data)+len(buf))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(buf),0x004e4942)+buf
path=out/'fechaduras-niveis1-2-3.glb';path.write_bytes(result)
# Confere que os índices do GLB único são válidos e que a malha não foi duplicada.
final,fb=ler(path)
assert len(final['meshes'])==1 and len(final['materials'])==6
assert len(final['accessors'])==len(ler(out.parent/'fechadura-nivel2'/'fechaduras-niveis1-2.glb')[0]['accessors'])
for v in final['bufferViews']:assert v.get('byteOffset',0)+v['byteLength']<=len(fb)
print(json.dumps({'arquivo':str(path),'bytes':len(result),'malhas':len(final['meshes']),'materiais':[m['name'] for m in final['materials']],'variantes':final['extensions']['KHR_materials_variants']['variants']},ensure_ascii=False))

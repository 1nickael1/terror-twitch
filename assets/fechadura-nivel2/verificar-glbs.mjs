import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
globalThis.self=globalThis;
globalThis.ProgressEvent=class ProgressEvent { constructor(type,data) { this.type=type;Object.assign(this,data); } };
globalThis.createImageBitmap=async blob=> { const m=await sharp(Buffer.from(await blob.arrayBuffer())).metadata();return { width:m.width,height:m.height,close() {} }; };
for(const nome of ['bloqueada','liberada','variantes']) {
 const data=await readFile(new URL(`./fechadura-nivel2-${nome}.glb`,import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 const mats=await gltf.parser.getDependencies('material');let meshes=0;gltf.scene.traverse(o=>{if(o.isMesh)meshes++;});
 if(meshes!==1||mats.some(m=>!m.map||!m.normalMap||!m.roughnessMap))throw new Error(`GLB inválido: ${nome}`);
 console.log(nome,mats.map(m=>m.name));
}
const data=await readFile(new URL('./fechaduras-niveis1-2.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const mats=await gltf.parser.getDependencies('material');const malha=gltf.scene.getObjectByProperty('isMesh',true), geo=malha.geometry;
if(mats.length!==4||gltf.parser.json.meshes.length!==1)throw new Error('Modelo combinado sem quatro estados');
for(const mat of mats){malha.material=mat;if(malha.geometry!==geo)throw new Error('A geometria mudou');}
if(!mats[1].emissiveMap||!mats[3].emissiveMap)throw new Error('LED verde ausente');
console.log('Combinado: 1 malha, 4 materiais, LEDs e texturas carregados.');

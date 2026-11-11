import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { prepararEstadosFechadura } from './alternar-fechadura.mjs';
globalThis.self = globalThis;
globalThis.ProgressEvent = class ProgressEvent { constructor(type, data) { this.type = type; Object.assign(this, data); } };
globalThis.createImageBitmap = async blob => {
 const meta = await sharp(Buffer.from(await blob.arrayBuffer())).metadata();
 return { width: meta.width, height: meta.height, close() {} };
};
for (const nome of ['bloqueada', 'liberada', 'variantes']) {
 const dados = await readFile(new URL(`./fechadura-nivel1-${nome}.glb`, import.meta.url));
 const gltf = await new GLTFLoader().parseAsync(dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.byteLength), '');
 let meshes = 0; gltf.scene.traverse(o => { if (o.isMesh) meshes++; });
 const materiais = await gltf.parser.getDependencies('material');
 if (meshes !== 1 || materiais.some(m => !m.map || !m.normalMap || !m.roughnessMap)) throw new Error(`GLB inválido: ${nome}`);
 if (nome === 'variantes' && (materiais.length !== 2 || !materiais[1].emissiveMap)) throw new Error('Variante sem LED emissivo');
 if (nome === 'variantes') {
  const definir = await prepararEstadosFechadura(gltf);
  const malha = gltf.scene.getObjectByProperty('isMesh', true), geometria = malha.geometry;
  definir(true);
  if (malha.material.name !== 'Fechadura_N1_Liberada' || malha.geometry !== geometria) throw new Error('Falha ao liberar');
  definir(false);
  if (malha.material.name !== 'Fechadura_N1_Bloqueada' || malha.geometry !== geometria) throw new Error('Falha ao bloquear');
 }
 console.log(JSON.stringify({ arquivo: nome, malhas: meshes, materiais: materiais.map(m => ({ nome: m.name, textura: [m.map.image.width, m.map.image.height], led: !!m.emissiveMap })) }));
}

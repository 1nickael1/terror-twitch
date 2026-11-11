import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AnimationClip } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const pasta = process.argv[2];
if (!pasta) throw new Error('Informe a pasta do FBX de recuo.');
const arquivo = (await readdir(pasta)).find(n => n.toLowerCase().endsWith('.fbx'));
if (!arquivo) throw new Error('FBX não encontrado.');
globalThis.window = { URL: globalThis.URL };
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_) {} }) };
const b = await readFile(path.join(pasta, arquivo));
const origem = new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
const clipe = origem.animations.find(c => /Walk_Backward_with_Bow/i.test(c.name));
if (!clipe) throw new Error(`Recuo não encontrado: ${origem.animations.map(c => c.name).join(', ')}`);
// Só transfere trilhas compatíveis com o esqueleto existente, nunca a malha ou os mapas novos.
const atual = await readFile('public/models/policial/policial.glb');
const gltf = await new GLTFLoader().parseAsync(atual.buffer.slice(atual.byteOffset, atual.byteOffset + atual.byteLength), '');
let pontasIgnoradas = 0;
clipe.tracks = clipe.tracks.filter(t => {
  const nome = t.name.slice(0, t.name.lastIndexOf('.'));
  const de = origem.getObjectByName(nome), para = gltf.scene.getObjectByName(nome);
  if (!para?.isBone && /(?:Hand(?:Thumb|Index|Middle|Ring|Pinky)4|_End)$/.test(nome)) { pontasIgnoradas++; return false; }
  if (!de?.isBone || !para?.isBone) throw new Error(`Osso incompatível: ${nome}`);
  if (de.position.distanceTo(para.position) > .001 || de.quaternion.angleTo(para.quaternion) > .001) throw new Error(`Pose-base incompatível: ${nome}`);
  return true;
});
const nomeOriginal = clipe.name; clipe.name = 'Walk_Backward_with_Bow';
const dados = AnimationClip.toJSON(clipe);
const json = JSON.stringify(dados, (_, v) => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);
await writeFile('public/models/policial/recuo.json', json + '\n');
await writeFile('public/models/policial/recuo-origem.json', JSON.stringify({ arquivoOriginal: arquivo, nomeOriginal, nomeNoJogo: clipe.name, duracao: clipe.duration, trilhas: clipe.tracks.length, pontasIgnoradas, bytes: Buffer.byteLength(json), importacao: 'Somente animação; malha, esqueleto e texturas existentes preservados.' }, null, 2) + '\n');
console.log(JSON.stringify({ nomeOriginal, duracao: clipe.duration, trilhas: clipe.tracks.length, bytes: Buffer.byteLength(json) }));


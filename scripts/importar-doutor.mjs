// Importa o FBX Meshy/Mixamo e seus mapas PBR para um GLB leve, com animações preservadas.
// Uso: node scripts/importar-doutor.mjs caminho/para/pasta-exportada [doutor|policial|chefe1]
import { readFile, readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { Box3, MeshStandardMaterial, Vector3 } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import sharp from 'sharp';

const pasta = process.argv[2];
const perfil = process.argv[3] ?? 'doutor';
if (!['doutor', 'policial', 'chefe1'].includes(perfil)) throw new Error('Perfil inválido: use doutor, policial ou chefe1.');
if (!pasta) throw new Error('Informe a pasta que contém o FBX e seus quatro mapas PBR.');
const arquivos = await readdir(pasta);
const nome = arquivos.find((n) => n.toLowerCase().endsWith('.fbx'));
if (!nome) throw new Error('FBX não encontrado.');
// O FBXLoader identifica as texturas, mas a conversão preserva o UV e carrega os mapas externos no jogo.
globalThis.window = { URL: globalThis.URL };
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_) {} }) };
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};

const buffer = await readFile(path.join(pasta, nome));
const modelo = new FBXLoader().parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
const caixa = new Box3().setFromObject(modelo, true);
const medidas = caixa.getSize(new Vector3());
let vertices = 0, triangulos = 0, malhas = 0;
const ossos = [];
const material = new MeshStandardMaterial({ color: 0xffffff, roughness: .85 });
modelo.traverse((o) => {
  if (o.isBone) ossos.push(o.name);
  if (!o.isMesh) return;
  malhas++;
  vertices += o.geometry.attributes.position.count;
  triangulos += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  o.material = material;
});
const destino = path.resolve('public/models', perfil);
await mkdir(destino, { recursive: true });
const glb = await new GLTFExporter().parseAsync(modelo, { binary: true, animations: modelo.animations, onlyVisible: false });
await writeFile(path.join(destino, `${perfil}.glb`), Buffer.from(glb));
const base = nome.slice(0, -4);
const mapas = [
  ['albedo', `${base}.png`], ['normal', `${base}_normal.png`],
  ['rugosidade', `${base}_roughness.png`], ['metalicidade', `${base}_metallic.png`],
];
for (const [id, png] of mapas) {
  const tamanho = id === 'albedo' || id === 'normal' ? 2048 : 1024;
  await sharp(path.join(pasta, png)).resize(tamanho, tamanho, { fit: 'inside', withoutEnlargement: true }).webp({ quality: id === 'albedo' ? 93 : 100, lossless: id !== 'albedo' }).toFile(path.join(destino, `${id}.webp`));
}
const dados = {
  origem: 'Modelo criado pelo usuário no Meshy; FBX animado Mixamo 60 fps.',
  usoNoJogo: perfil === 'doutor'
    ? { tipo: 'funcionario', altura: 1.8, caminhada: 'Unsteady_Walk', corrida: 'Run_02', ataque: 'Avanço do tronco e fechamento dos dois braços, sincronizado ao preparo da IA.' }
    : perfil === 'policial' ? { tipo: 'seguranca', altura: 1.8, arma: 'Olive Drab Battle Rifle (Meshy), preso à mão direita e alinhado ao apoio esquerdo; asset em models/arma-policial.' }
    : { tipo: 'entidade096', altura: 2.4, perseguicao: 'run_fast_2', despertar: 'Skill_01', busca: 'Walking_Scan_with_Sudden_Look_Back', ataque: 'Right_Hand_Sword_Slash', morte: 'Strangled_and_Fall_Forward' },
  arquivoOriginal: nome, malhas, vertices, triangulos, ossos,
  ...(perfil === 'policial' ? { animacoesExtras: ['/models/policial/recuo.json'] } : {}),
  caixa: { min: caixa.min.toArray(), max: caixa.max.toArray(), tamanho: medidas.toArray() },
  animacoes: modelo.animations.map((a) => ({ nome: a.name, duracao: a.duration, trilhas: a.tracks.length,
    primeiraTrilha: a.tracks[0]?.name })),
  mapas: Object.fromEntries(mapas.map(([id]) => [id, `/models/${perfil}/${id}.webp`])),
  bytesModelo: (await stat(path.join(destino, `${perfil}.glb`))).size,
};
await writeFile(path.join(destino, 'modelo.json'), JSON.stringify(dados, null, 2) + '\n');
console.log(JSON.stringify(dados, null, 2));

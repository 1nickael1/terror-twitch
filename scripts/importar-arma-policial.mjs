import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const origem = process.argv[2];
if (!origem) throw new Error('Uso: node scripts/importar-arma-policial.mjs arquivo.glb');
const b = await readFile(origem);
const tamanhoJson = b.readUInt32LE(12);
const gltf = JSON.parse(b.subarray(20, 20 + tamanhoJson).toString());
const bin = b.subarray(28 + tamanhoJson);
const imagens = new Map(gltf.images.map((i) => [i.bufferView, i]));
const partes = []; let offset = 0;
for (let n = 0; n < gltf.bufferViews.length; n++) {
  const v = gltf.bufferViews[n];
  let dados = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  const imagem = imagens.get(n);
  if (imagem) {
    dados = await sharp(dados).resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 94, lossless: imagem.name !== 'texture_0' }).toBuffer();
    imagem.mimeType = 'image/webp';
  }
  v.byteOffset = offset; v.byteLength = dados.length;
  const alinhado = Buffer.alloc(Math.ceil(dados.length / 4) * 4); dados.copy(alinhado);
  partes.push(alinhado); offset += alinhado.length;
}
for (const t of gltf.textures) { t.extensions = { EXT_texture_webp: { source: t.source } }; delete t.source; }
gltf.extensionsUsed = [...new Set([...(gltf.extensionsUsed ?? []), 'EXT_texture_webp'])];
gltf.extensionsRequired = [...new Set([...(gltf.extensionsRequired ?? []), 'EXT_texture_webp'])];
gltf.buffers[0].byteLength = offset;
const json = Buffer.from(JSON.stringify(gltf));
const texto = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(texto);
const cabecalho = Buffer.alloc(20); cabecalho.writeUInt32LE(0x46546c67); cabecalho.writeUInt32LE(2, 4);
cabecalho.writeUInt32LE(28 + texto.length + offset, 8); cabecalho.writeUInt32LE(texto.length, 12); cabecalho.writeUInt32LE(0x4e4f534a, 16);
const chunk = Buffer.alloc(8); chunk.writeUInt32LE(offset); chunk.writeUInt32LE(0x004e4942, 4);
const pasta = 'public/models/arma-policial'; await mkdir(pasta, { recursive: true });
const resultado = Buffer.concat([cabecalho, texto, chunk, ...partes]);
await writeFile(path.join(pasta, 'fuzil.glb'), resultado);
await writeFile(path.join(pasta, 'modelo.json'), JSON.stringify({ origem: path.basename(origem), autor: 'Fornecido pelo usuário; Meshy AI', bytesOriginais: b.length, bytesNoJogo: resultado.length, texturas: 'Albedo, normal e metalicidade/rugosidade originais convertidos para WebP; UV glTF preservado.', comprimentoNoJogo: .88 }, null, 2) + '\n');
console.log(`${b.length} → ${resultado.length} bytes; original preservado.`);

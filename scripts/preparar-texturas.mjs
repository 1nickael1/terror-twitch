// Uso: node scripts/preparar-texturas.mjs caminho/para/fontes.json
// O manifesto de entrada contém [{ id, arquivo, prompt }], com os PNGs originais do Image Gen.
// Apenas preparação técnica: resolução, bordas periódicas, mapas de dados e compressão.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const entrada = process.argv[2];
if (!entrada) throw new Error('Informe o manifesto JSON dos PNGs originais.');
const fontes = JSON.parse(await readFile(entrada, 'utf8'));
const raiz = path.resolve('public/textures');
const arquitetura = new Set(['concreto', 'azulejo', 'piso', 'teto', 'porta', 'comporta']);
const faces = new Set(['porta', 'comporta', 'papel', 'tela', 'vida', 'colete', 'municao', 'cartao']);

/** Aproxima as bordas opostas numa faixa estreita sem desfocar o centro da textura. */
function fecharBordas(dados, tamanho, canais) {
  const faixa = Math.max(4, Math.round(tamanho / 64));
  const misturar = (a, b, k) => {
    const mistura = .5 * (1 - k / (faixa - 1)) ** 2;
    for (let c = 0; c < canais; c++) {
      const x = dados[a + c], y = dados[b + c];
      dados[a + c] = Math.round(x * (1 - mistura) + y * mistura);
      dados[b + c] = Math.round(y * (1 - mistura) + x * mistura);
    }
  };
  for (let linha = 0; linha < tamanho; linha++) {
    for (let k = 0; k < faixa; k++) {
      misturar((linha * tamanho + k) * canais, (linha * tamanho + tamanho - k - 1) * canais, k);
    }
  }
  for (let col = 0; col < tamanho; col++) {
    for (let k = 0; k < faixa; k++) {
      misturar((k * tamanho + col) * canais, ((tamanho - k - 1) * tamanho + col) * canais, k);
    }
  }
}

const catalogo = [];
const amostras = [];
for (const { id, arquivo, prompt } of fontes) {
  if (!/^[a-z-]+$/.test(id)) throw new Error(`ID inválido: ${id}`);
  const tamanho = arquitetura.has(id) ? 1024 : 512;
  const pasta = path.join(raiz, id);
  await mkdir(pasta, { recursive: true });
  const dados = await sharp(arquivo).resize(tamanho, tamanho, { fit: 'fill' }).removeAlpha().toColourspace('srgb').raw().toBuffer();
  if (!faces.has(id)) fecharBordas(dados, tamanho, 3);
  const imagem = sharp(dados, { raw: { width: tamanho, height: tamanho, channels: 3 } });
  await imagem.clone().webp({ quality: 90, effort: 5 }).toFile(path.join(pasta, 'albedo.webp'));
  const relevo = await imagem.clone().greyscale().resize(256, 256).raw().toBuffer();
  if (!faces.has(id)) fecharBordas(relevo, 256, 1);
  // Relevo estimado a partir da luminância; não é uma medição física da superfície.
  await sharp(relevo, { raw: { width: 256, height: 256, channels: 1 } }).webp({ lossless: true }).toFile(path.join(pasta, 'relevo.webp'));
  const rugosidade = Buffer.from(relevo.map((v) => Math.max(180, Math.min(255, Math.round(230 + (128 - v) * .12)))));
  await sharp(rugosidade, { raw: { width: 256, height: 256, channels: 1 } }).webp({ lossless: true }).toFile(path.join(pasta, 'rugosidade.webp'));
  const mapas = Object.fromEntries(['albedo', 'relevo', 'rugosidade'].map((canal) => [canal, `/textures/${id}/${canal}.webp`]));
  const bytes = (await Promise.all(Object.keys(mapas).map(async (c) => (await stat(path.join(pasta, `${c}.webp`))).size))).reduce((a, b) => a + b, 0);
  catalogo.push({ id, ferramenta: 'OpenAI Image Gen (integrado)', prompt, repetivel: !faces.has(id), resolucao: tamanho, resolucaoDados: 256, mapas, bytes });
  const i = catalogo.length - 1;
  const thumb = await imagem.clone().resize(240, 240).png().toBuffer();
  const label = Buffer.from(`<svg width="240" height="32"><rect width="240" height="32" fill="#10191b"/><text x="12" y="21" fill="#dbc49e" font-family="monospace" font-size="14">${id}</text></svg>`);
  amostras.push({ input: thumb, left: (i % 5) * 256 + 8, top: Math.floor(i / 5) * 288 + 8 });
  amostras.push({ input: label, left: (i % 5) * 256 + 8, top: Math.floor(i / 5) * 288 + 248 });
}
await sharp({ create: { width: 1280, height: Math.ceil(fontes.length / 5) * 288, channels: 3, background: '#070e10' } }).composite(amostras).webp({ quality: 90 }).toFile(path.join(raiz, 'previa.webp'));
await writeFile(path.join(raiz, 'catalogo.json'), JSON.stringify({ descricao: 'Texturas originais. Cor gerada com IA; relevo e rugosidade derivados da luminância.', texturas: catalogo }, null, 2) + '\n');
console.log(JSON.stringify({ superficies: catalogo.length, arquivos: catalogo.length * 3, bytes: catalogo.reduce((n, t) => n + t.bytes, 0) }));

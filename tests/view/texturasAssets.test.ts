import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { TEXTURAS, urlTextura } from '../../src/engine/catalogoTexturas';

describe('pacote de texturas das duas fases', () => {
  it('contém os três mapas de cada superfície, em tamanhos válidos e dentro do orçamento', async () => {
    const catalogo = JSON.parse(await readFile('public/textures/catalogo.json', 'utf8'));
    expect(catalogo.texturas.map((t: { id: string }) => t.id)).toEqual([...TEXTURAS]);
    let bytes = 0;
    for (const id of TEXTURAS) {
      for (const canal of ['albedo', 'relevo', 'rugosidade'] as const) {
        const arquivo = path.join('public', urlTextura(id, canal));
        const meta = await sharp(arquivo).metadata();
        expect(meta.format).toBe('webp');
        expect(meta.width).toBe(meta.height);
        expect([256, 512, 1024]).toContain(meta.width);
        if (canal !== 'albedo') expect(meta.width).toBe(256);
        bytes += (await stat(arquivo)).size;
      }
    }
    expect(bytes).toBeLessThan(6 * 1024 * 1024);
  });

  it('superfícies repetidas têm bordas compatíveis após a compressão', async () => {
    const catalogo = JSON.parse(await readFile('public/textures/catalogo.json', 'utf8'));
    for (const t of catalogo.texturas.filter((t: { repetivel: boolean }) => t.repetivel)) {
      const { data, info } = await sharp(path.join('public', t.mapas.albedo)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let diferenca = 0;
      for (let y = 0; y < info.height; y++) {
        for (let c = 0; c < info.channels; c++) {
          diferenca += Math.abs(data[(y * info.width) * info.channels + c] - data[(y * info.width + info.width - 1) * info.channels + c]);
        }
      }
      for (let x = 0; x < info.width; x++) {
        for (let c = 0; c < info.channels; c++) {
          diferenca += Math.abs(data[x * info.channels + c] - data[((info.height - 1) * info.width + x) * info.channels + c]);
        }
      }
      expect(diferenca / ((info.width + info.height) * info.channels), t.id).toBeLessThan(8);
    }
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Texture } from 'three';
import { carregarTextura } from '../../src/engine/carregarTextura';

class Imagem {
  static criadas: Imagem[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  constructor() { Imagem.criadas.push(this); }
}

afterEach(() => { vi.unstubAllGlobals(); Imagem.criadas = []; });

describe('carregamento das texturas geradas', () => {
  it('mantém o fallback até o download terminar e atualiza o mesmo objeto de textura', () => {
    vi.stubGlobal('Image', Imagem);
    const fallback = { width: 4, height: 4 };
    const t = new Texture(fallback);
    carregarTextura(t, '/textures/concreto/albedo.webp');
    const imagem = Imagem.criadas[0];
    expect(imagem.src).toBe('/textures/concreto/albedo.webp');
    expect(t.image).toBe(fallback);
    imagem.onload!();
    expect(t.image).toBe(imagem);
    expect(t.userData.estado).toBe('pronta');
    expect(t.version).toBeGreaterThan(0);
    expect(imagem.onload).toBeNull();
  });

  it('um arquivo indisponível não deixa o material sem textura', () => {
    vi.stubGlobal('Image', Imagem);
    const fallback = { width: 4, height: 4 };
    const t = new Texture(fallback);
    carregarTextura(t, '/indisponivel.webp');
    Imagem.criadas[0].onerror!();
    expect(t.image).toBe(fallback);
    expect(t.userData.estado).toBe('fallback');
  });

  it('downloads concluídos depois do dispose não recriam recursos na GPU', () => {
    vi.stubGlobal('Image', Imagem);
    const t = new Texture({ width: 4, height: 4 });
    carregarTextura(t, '/textures/piso/albedo.webp');
    const imagem = Imagem.criadas[0];
    const concluir = imagem.onload!;
    const falhar = imagem.onerror!;
    t.dispose();
    concluir(); falhar();
    expect(t.userData.estado).toBe('descartada');
    expect(t.image).not.toBe(imagem);
    expect(t.version).toBe(0);
    expect(imagem.onload).toBeNull();
    expect(imagem.onerror).toBeNull();
  });
});

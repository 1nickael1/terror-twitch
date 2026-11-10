import { describe, expect, it } from 'vitest';
import { getStyle, STYLES } from '../src/looks/registry';

describe('registro de estilos', () => {
  it('tem exatamente 4 estilos em ordem', () => {
    expect(STYLES.map((s) => s.id)).toEqual(['disquete', 'fita', 'lanterna', 'camera']);
  });

  it('ids únicos, nome e frase preenchidos, shader com main', () => {
    expect(new Set(STYLES.map((s) => s.id)).size).toBe(4);
    for (const s of STYLES) {
      expect(s.nome.trim()).not.toBe('');
      expect(s.frase.trim()).not.toBe('');
      expect(s.fragmentShader).toContain('void main');
    }
  });

  it('busca por id', () => {
    expect(getStyle('fita')?.nome).toBe('Fita Encontrada');
    expect(getStyle('nada')).toBeUndefined();
  });

  it('cada estilo declara névoa, lanterna e multiplicadores válidos', () => {
    for (const s of STYLES) {
      const c = s.cena;
      expect(c.nevoa.densidade).toBeGreaterThan(0);
      expect(c.lanterna).toBeGreaterThan(0); // a lanterna existe em todos os filtros
      for (const m of [c.ambiente, c.luzes, c.emissivo, c.infravermelho]) expect(m).toBeGreaterThanOrEqual(0);
    }
    expect(getStyle('disquete')!.cena.material).toBe('lambert');
    expect(getStyle('disquete')!.cena.texturasNearest).toBe(true);
    expect(getStyle('lanterna')!.cena.lanterna).toBe(1);
    expect(getStyle('camera')!.cena.infravermelho).toBeGreaterThan(0);
  });
});

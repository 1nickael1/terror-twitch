import { PerspectiveCamera, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { LightRig } from '../src/engine/lights';
import { MaterialBank } from '../src/engine/materials';
import { getStyle, getStyleByKey, STYLES } from '../src/looks/registry';
import type { SceneContext } from '../src/looks/types';

function fakeCtx(): SceneContext {
  const scene = new Scene();
  return { scene, bank: new MaterialBank(), lights: new LightRig(scene, new PerspectiveCamera(), [], null) };
}

describe('registro de estilos', () => {
  it('tem exatamente 4 estilos com teclas 1–4 em ordem', () => {
    expect(STYLES.map((s) => s.key)).toEqual(['1', '2', '3', '4']);
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

  it('busca por id e por tecla', () => {
    expect(getStyleByKey('3')?.id).toBe('lanterna');
    expect(getStyle('fita')?.nome).toBe('Fita Encontrada');
    expect(getStyle('nada')).toBeUndefined();
  });

  it('aplicar de cada estilo roda e deixa a marca esperada', () => {
    for (const s of STYLES) {
      const ctx = fakeCtx();
      s.aplicar(ctx);
      expect(ctx.scene.fog).not.toBeNull();
    }
    const d = fakeCtx();
    getStyle('disquete')!.aplicar(d);
    expect(d.bank.kind).toBe('lambert');
    const l = fakeCtx();
    getStyle('lanterna')!.aplicar(l);
    expect(l.lights.current.flashlight).toBeGreaterThan(0);
    expect(l.lights.current.flashlightShadows).toBe(true);
    const c = fakeCtx();
    getStyle('camera')!.aplicar(c);
    expect(c.lights.current.infrared).toBeGreaterThan(0);
  });
});

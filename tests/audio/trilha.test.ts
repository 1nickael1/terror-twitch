import { describe, expect, it, vi } from 'vitest';
import { trilha } from '../../src/audio/trilha';
import type { Bancada } from '../../src/audio/sintese';

function bancada() {
  const fontes: ReturnType<typeof fonte>[] = [];
  const ganhos: ReturnType<typeof ganho>[] = [];
  const buffers: Float32Array[][] = [];
  function ganho() {
    return { connect: vi.fn(), disconnect: vi.fn(), gain: {
      value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn(),
    } };
  }
  function fonte() {
    const eventos = new Map<string, () => void>();
    return {
      frequency: { value: 0 }, type: 'sine', buffer: null, loop: false,
      connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      addEventListener: (tipo: string, fn: () => void) => eventos.set(tipo, fn),
      terminar: () => eventos.get('ended')?.(),
    };
  }
  const criarFonte = () => { const f = fonte(); fontes.push(f); return f; };
  const ctx = {
    currentTime: 3,
    createGain: () => { const g = ganho(); ganhos.push(g); return g; },
    createOscillator: criarFonte, createBufferSource: criarFonte,
    createBuffer: (canais: number, tamanho: number, taxa: number) => {
      const dados = Array.from({ length: canais }, () => new Float32Array(tamanho));
      buffers.push(dados);
      return { getChannelData: (n: number) => dados[n], duration: tamanho / taxa };
    },
  };
  return { b: { ctx } as unknown as Bancada, fontes, ganhos, buffers };
}

describe('trilha de suspense', () => {
  it('gera duas partituras estéreo distintas, finitas, com margem de volume e emenda suave', () => {
    const setores = [false, true].map((hospital) => {
      const a = bancada();
      trilha(a.b, {} as AudioNode, hospital);
      for (const canal of a.buffers[0]) {
        let pico = 0;
        let finito = true;
        for (const amostra of canal) {
          finito = finito && Number.isFinite(amostra);
          pico = Math.max(pico, Math.abs(amostra));
        }
        expect(finito).toBe(true);
        expect(pico).toBeGreaterThan(.05);
        expect(pico).toBeLessThan(.5);
        expect(Math.abs(canal[0] - canal[canal.length - 1])).toBeLessThan(.02);
      }
      expect(a.buffers[0][0]).not.toEqual(a.buffers[0][1]);
      return a.buffers[0][0];
    });
    expect(setores[0]).not.toEqual(setores[1]);
  });

  it('inicia uma vez, faz fade e libera fontes e modulação ao sair da fase', () => {
    const a = bancada();
    const l = trilha(a.b, {} as AudioNode, false);
    expect(a.fontes.every((f) => f.start.mock.calls.length === 1)).toBe(true);
    l.parar(4, .4); l.parar(5, .4);
    for (const f of a.fontes) {
      expect(f.stop).toHaveBeenCalledExactlyOnceWith(4.42);
    }
    a.fontes[0].terminar();
    expect(a.fontes.every((f) => f.disconnect.mock.calls.length === 1)).toBe(true);
    expect(a.ganhos.slice(1).every((g) => g.disconnect.mock.calls.length === 1)).toBe(true);
  });
});

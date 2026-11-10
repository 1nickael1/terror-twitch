// Desbloqueio da fase 2 e Seleção de fase (C3.5).
import { describe, expect, it } from 'vitest';
import { fasesDaSelecao } from '../../src/components/selecao';
import { FASES } from '../../src/levels/indice';
import { carregarProgresso, registrarConclusao, salvarProgresso } from '../../src/save/progresso';
import { transicao } from '../../src/sim/tela';

const memoria = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('seleção de fase com as duas fases', () => {
  it('no começo só a fase 1 aparece e a fase 2 não pode ser escolhida', () => {
    const p = carregarProgresso(memoria(), FASES.length);
    expect(fasesDaSelecao(FASES, p).map((f) => f.id)).toEqual(['fase1']);
    expect(transicao({ tela: 'titulo', fase: 0 }, { c: 'fase', indice: 1 }, FASES.length, p.desbloqueadas))
      .toEqual({ tela: 'titulo', fase: 0 });
  });

  it('concluir a fase 1 desbloqueia a fase 2, que aparece na seleção (com o tempo da 1) e pode ser escolhida', () => {
    const a = memoria();
    const p0 = carregarProgresso(a, FASES.length);
    salvarProgresso(a, registrarConclusao(p0, 0, FASES[0].id, 312, FASES.length));
    const p = carregarProgresso(a, FASES.length);
    expect(p.desbloqueadas).toBe(2);
    expect(fasesDaSelecao(FASES, p)).toEqual([
      { indice: 0, id: 'fase1', nome: FASES[0].nome, melhor: 312 },
      { indice: 1, id: 'fase2', nome: 'Ala Médica e Pesquisa', melhor: null },
    ]);
    expect(transicao({ tela: 'titulo', fase: 0 }, { c: 'fase', indice: 1 }, FASES.length, p.desbloqueadas))
      .toEqual({ tela: 'jogando', fase: 1 });
    // "Continuar" leva à última fase liberada
    expect(transicao({ tela: 'titulo', fase: 0 }, { c: 'continuar' }, FASES.length, p.desbloqueadas))
      .toEqual({ tela: 'jogando', fase: 1 });
  });

  it('do fim da fase 1, "Próxima fase" vai à fase 2; do fim da fase 2, à tela final', () => {
    expect(transicao({ tela: 'fim_de_fase', fase: 0 }, { c: 'proxima' }, FASES.length, 2)).toEqual({ tela: 'jogando', fase: 1 });
    expect(transicao({ tela: 'fim_de_fase', fase: 1 }, { c: 'proxima' }, FASES.length, 2)).toEqual({ tela: 'final', fase: 1 });
  });

  it('concluir a fase 2 não desbloqueia além do total; progresso salvo de mais fases é limitado', () => {
    const p = registrarConclusao({ desbloqueadas: 2, melhorTempo: {} }, 1, 'fase2', 400, FASES.length);
    expect(p.desbloqueadas).toBe(2);
    expect(fasesDaSelecao(FASES, { desbloqueadas: 9, melhorTempo: {} })).toHaveLength(FASES.length);
    expect(fasesDaSelecao(FASES, { desbloqueadas: 0, melhorTempo: {} })).toHaveLength(1);
  });
});

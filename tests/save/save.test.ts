import { describe, expect, it } from 'vitest';
import { CHAVE_OPCOES, OPCOES_PADRAO, carregarOpcoes, salvarOpcoes, sanear } from '../../src/save/opcoes';
import { carregarProgresso, registrarConclusao, salvarProgresso } from '../../src/save/progresso';

const memoria = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};
const FILTROS = ['disquete', 'fita', 'lanterna', 'camera'];

describe('opções', () => {
  it('sem nada salvo devolve o padrão, com Lanterna', () => {
    expect(carregarOpcoes(memoria(), FILTROS)).toEqual(OPCOES_PADRAO);
    expect(OPCOES_PADRAO.filtro).toBe('lanterna');
  });
  it('salva e carrega', () => {
    const a = memoria();
    salvarOpcoes(a, { ...OPCOES_PADRAO, fov: 100, filtro: 'fita', inverterY: true });
    expect(carregarOpcoes(a, FILTROS)).toMatchObject({ fov: 100, filtro: 'fita', inverterY: true });
  });
  it('JSON quebrado cai no padrão', () => {
    const a = memoria();
    a.m.set(CHAVE_OPCOES, '{nao é json');
    expect(carregarOpcoes(a, FILTROS)).toEqual(OPCOES_PADRAO);
  });
  it('saneia campo a campo', () => {
    const o = sanear({ fov: 500, sensibilidade: 'x', filtro: 'inexistente', volumeGeral: -3, qualidade: 'ultra', inverterY: true }, FILTROS);
    expect(o.fov).toBe(110);
    expect(o.sensibilidade).toBe(OPCOES_PADRAO.sensibilidade);
    expect(o.filtro).toBe('lanterna');
    expect(o.volumeGeral).toBe(0);
    expect(o.qualidade).toBe('media');
    expect(o.inverterY).toBe(true);
  });
  it('armazenamento que lança não quebra', () => {
    const ruim = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    expect(carregarOpcoes(ruim, FILTROS)).toEqual(OPCOES_PADRAO);
    expect(() => salvarOpcoes(ruim, OPCOES_PADRAO)).not.toThrow();
  });
});

describe('progresso', () => {
  it('começa com a primeira fase desbloqueada', () => {
    expect(carregarProgresso(memoria(), 5)).toEqual({ desbloqueadas: 1, melhorTempo: {} });
  });
  it('concluir desbloqueia a próxima e guarda o melhor tempo', () => {
    let p = carregarProgresso(memoria(), 5);
    p = registrarConclusao(p, 0, 'f1', 300, 5);
    expect(p).toEqual({ desbloqueadas: 2, melhorTempo: { f1: 300 } });
    p = registrarConclusao(p, 0, 'f1', 400, 5);
    expect(p.melhorTempo.f1).toBe(300);
    p = registrarConclusao(p, 0, 'f1', 250, 5);
    expect(p.melhorTempo.f1).toBe(250);
    expect(p.desbloqueadas).toBe(2);
  });
  it('não passa do total de fases', () => {
    const p = registrarConclusao({ desbloqueadas: 5, melhorTempo: {} }, 4, 'f5', 100, 5);
    expect(p.desbloqueadas).toBe(5);
  });
  it('salva, carrega e saneia', () => {
    const a = memoria();
    salvarProgresso(a, { desbloqueadas: 3, melhorTempo: { f1: 120 } });
    expect(carregarProgresso(a, 5)).toEqual({ desbloqueadas: 3, melhorTempo: { f1: 120 } });
    salvarProgresso(a, { desbloqueadas: 99, melhorTempo: {} });
    expect(carregarProgresso(a, 5).desbloqueadas).toBe(5);
  });
});

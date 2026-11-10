import { describe, expect, it } from 'vitest';
import { transicao, type EstadoTela } from '../../src/sim/tela';

const T = (tela: EstadoTela['tela'], fase = 0): EstadoTela => ({ tela, fase });

describe('transicao', () => {
  it('novo jogo começa na fase 0', () => {
    expect(transicao(T('titulo'), { c: 'novo_jogo' }, 5, 3)).toEqual(T('jogando', 0));
  });
  it('continuar vai para a última desbloqueada', () => {
    expect(transicao(T('titulo'), { c: 'continuar' }, 5, 3)).toEqual(T('jogando', 2));
  });
  it('seleção só aceita fase desbloqueada', () => {
    expect(transicao(T('titulo'), { c: 'fase', indice: 1 }, 5, 3)).toEqual(T('jogando', 1));
    expect(transicao(T('titulo'), { c: 'fase', indice: 3 }, 5, 3)).toEqual(T('titulo'));
  });
  it('pausa e retoma; sair volta ao título', () => {
    const p = transicao(T('jogando', 2), { c: 'pausar' }, 5, 3);
    expect(p).toEqual(T('pausa', 2));
    expect(transicao(p, { c: 'retomar' }, 5, 3)).toEqual(T('jogando', 2));
    expect(transicao(p, { c: 'sair' }, 5, 3).tela).toBe('titulo');
  });
  it('morte volta ao jogo na mesma fase', () => {
    const m = transicao(T('jogando', 1), { c: 'morreu' }, 5, 3);
    expect(m).toEqual(T('morte', 1));
    expect(transicao(m, { c: 'renasceu' }, 5, 3)).toEqual(T('jogando', 1));
  });
  it('fim de fase avança, e a última leva ao final', () => {
    expect(transicao(T('fim_de_fase', 0), { c: 'proxima' }, 5, 2)).toEqual(T('jogando', 1));
    expect(transicao(T('fim_de_fase', 4), { c: 'proxima' }, 5, 5).tela).toBe('final');
  });
  it('comando fora de contexto não muda nada', () => {
    const e = T('titulo');
    expect(transicao(e, { c: 'retomar' }, 5, 1)).toBe(e);
    expect(transicao(T('jogando'), { c: 'novo_jogo' }, 5, 1).tela).toBe('jogando');
  });
});

describe('transicao (casos acrescentados)', () => {
  it('sair do fim de fase e do final volta ao título', () => {
    expect(transicao(T('fim_de_fase', 1), { c: 'sair' }, 5, 3).tela).toBe('titulo');
    expect(transicao(T('final', 4), { c: 'sair' }, 5, 5).tela).toBe('titulo');
  });
  it('documento abre e fecha na mesma fase', () => {
    const d = transicao(T('jogando', 2), { c: 'abrir_documento' }, 5, 3);
    expect(d).toEqual(T('documento', 2));
    expect(transicao(d, { c: 'fechar_documento' }, 5, 3)).toEqual(T('jogando', 2));
  });
  it('concluir leva ao fim de fase; seleção rejeita índice inválido', () => {
    expect(transicao(T('jogando', 1), { c: 'concluiu' }, 5, 3)).toEqual(T('fim_de_fase', 1));
    expect(transicao(T('titulo'), { c: 'fase', indice: -1 }, 5, 3)).toEqual(T('titulo'));
  });
  it('morte ignora pausa (a espera de 2 s não é interrompida)', () => {
    const m = T('morte', 0);
    expect(transicao(m, { c: 'pausar' }, 5, 3)).toBe(m);
  });
});

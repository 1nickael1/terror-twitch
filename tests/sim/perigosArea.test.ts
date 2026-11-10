// tests/sim/perigosArea.test.ts — perigos de área (ultravioleta e vapor): aviso, dano por segundo, recarga (C3.1)
import { describe, expect, it } from 'vitest';
import { solidoDe } from '../../src/sim/doors';
import type { SimEvent } from '../../src/sim/eventos';
import type { PerigoArea } from '../../src/sim/fase';
import { avancarPerigos, celulaFechada } from '../../src/sim/perigos';
import { PASSO } from '../../src/sim/step';
import { executar } from '../../src/sim/triggers';
import { criarWorld, type Inimigo, type World } from '../../src/sim/world';
import { faseComChefe, porInimigo } from './ajuda';

const SALA = `
  ############
  #P.........#
  #..........#
  #..........#
  ############
`;

// área [1, 1, 4, 3]: colunas 1..4, linhas 1..3 (o P está em [1, 1])
const UV: PerigoArea = {
  id: 'uv1', tipo: 'ultravioleta', area: [1, 1, 4, 3],
  aviso: 1, duracao: 4, recarga: 10, danoChefePorSeg: 0.075, danoPorSeg: 10,
};
const VAPOR: PerigoArea = { ...UV, id: 'v1', tipo: 'vapor' };

const chefeDe = (w: World): Inimigo => w.inimigos.find((i) => i.id === w.chefe!.inimigoId)!;
const tipos = (ev: readonly SimEvent[]) => ev.map((e) => e.tipo);
const estados = (ev: readonly SimEvent[]) => ev.flatMap((e) => (e.tipo === 'perigo' ? [e.estado] : []));

/** Só os perigos, sem IA nem jogador: `segundos` em passos de PASSO. */
function passar(w: World, segundos: number): SimEvent[] {
  const ev: SimEvent[] = [];
  const n = Math.round(segundos / PASSO);
  for (let k = 0; k < n; k++) ev.push(...avancarPerigos(w, PASSO));
  return ev;
}

/** Chefe longe (fora da área) e sem colete no jogador. */
function mundo(perigos: PerigoArea[] = [UV], em: [number, number] = [9, 2]): World {
  const w = criarWorld(faseComChefe(SALA, { em, perigos }, { saida: [10, 3] }));
  w.jogador.colete = 0;
  return w;
}

describe('perigo de área: acionamento', () => {
  it('começa com aviso 0 e o acionamento arma aviso e recarga (evento aviso)', () => {
    const w = mundo();
    expect(w.perigos).toEqual([{ id: 'uv1', ativo: 0, recarga: 0, aviso: 0, danoPulso: 0, jogadorNaArea: false }]);
    const ev = executar(w, { acao: 'perigo', id: 'uv1' });
    expect(ev).toEqual([{ tipo: 'perigo', id: 'uv1', estado: 'aviso' }]);
    expect(w.perigos[0]).toEqual({ id: 'uv1', ativo: 0, recarga: 10, aviso: 1, danoPulso: 0, jogadorNaArea: false });
  });

  it('o aviso não fere ninguém', () => {
    const w = mundo([UV], [2, 2]);
    const comum = porInimigo(w, 'reforcado_teste', [3, 3]);
    executar(w, { acao: 'perigo', id: 'uv1' });
    const ev = passar(w, 0.95);
    expect(w.jogador.vida).toBe(100);
    expect(comum.vida).toBe(400);
    expect(chefeDe(w).vida).toBe(900);
    expect(tipos(ev)).not.toContain('dano_jogador');
    expect(estados(ev)).toEqual([]);
  });

  it('aviso → liga → desliga, uma vez cada, nos tempos certos', () => {
    const w = mundo();
    executar(w, { acao: 'perigo', id: 'uv1' });
    const ateLigar = passar(w, 1);
    expect(estados(ateLigar)).toEqual(['liga']);
    expect(w.perigos[0].ativo).toBeCloseTo(4, 6);
    const meio = passar(w, 3.9);
    expect(estados(meio)).toEqual([]);
    const fim = passar(w, 0.2);
    expect(estados(fim)).toEqual(['desliga']);
    expect(w.perigos[0].ativo).toBe(0);
  });

  it('em recarga, recusa com a mensagem do tipo; depois da recarga, arma de novo', () => {
    const w = mundo([UV, { ...VAPOR, area: [6, 1, 1, 1] }]);
    executar(w, { acao: 'perigo', id: 'uv1' });
    executar(w, { acao: 'perigo', id: 'v1' });
    expect(executar(w, { acao: 'perigo', id: 'uv1' })).toEqual([
      { tipo: 'perigo', id: 'uv1', estado: 'recarregando' },
      { tipo: 'mensagem', texto: 'Esterilização recarregando.' },
    ]);
    expect(executar(w, { acao: 'perigo', id: 'v1' })).toEqual([
      { tipo: 'perigo', id: 'v1', estado: 'recarregando' },
      { tipo: 'mensagem', texto: 'Válvula de vapor recarregando.' },
    ]);
    passar(w, 10.05);
    expect(executar(w, { acao: 'perigo', id: 'uv1' })).toEqual([{ tipo: 'perigo', id: 'uv1', estado: 'aviso' }]);
  });
});

describe('perigo de área: dano', () => {
  it('fere o jogador danoPorSeg por segundo (pelo colete) e para ao desligar', () => {
    const w = mundo();
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 1);   // fim do aviso
    passar(w, 1);
    expect(w.jogador.vida).toBeCloseTo(90, 1);
    passar(w, 3.5);
    expect(w.jogador.vida).toBeCloseTo(60, 1);   // 4 s × 10
    passar(w, 2);
    expect(w.jogador.vida).toBeCloseTo(60, 1);
  });

  it('o colete absorve como num golpe', () => {
    const w = mundo();
    w.jogador.colete = 100;
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 6);
    // 40 de dano: o colete segura 2/3
    expect(w.jogador.vida).toBeCloseTo(100 - 40 / 3, 1);
    expect(w.jogador.colete).toBeCloseTo(100 - 80 / 3, 1);
  });

  it('dano_jogador em pulsos: no 1º passo e a cada 0,5 s, com o dano acumulado desde o pulso anterior', () => {
    const w = mundo();
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 1);
    const d = 10 * PASSO;   // dano de um passo
    const danos = passar(w, 1).flatMap((e) => (e.tipo === 'dano_jogador' ? [e.quantia] : []));
    // passo 1 (início), passo 30 (fecha 0,5 s) e passo 60 (fecha 1 s)
    expect(danos).toHaveLength(3);
    expect(danos[0]).toBeCloseTo(d, 9);
    expect(danos[1]).toBeCloseTo(29 * d, 9);
    expect(danos[2]).toBeCloseTo(30 * d, 9);
    expect(danos[0] + danos[1] + danos[2]).toBeCloseTo(10, 9);
    expect(w.perigos[0].danoPulso).toBe(0);
  });

  it('na morte, dano_jogador com o acumulado do pulso e jogador_morto uma vez', () => {
    const w = mundo();
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 2);   // 1 s de aviso + 1 s ferindo: o último passo fechou um pulso
    w.jogador.vida = 3;
    const morte = passar(w, 1);
    expect(w.jogador.vida).toBe(0);
    expect(w.estado).toBe('morto');
    expect(tipos(morte).filter((t) => t === 'jogador_morto')).toHaveLength(1);
    const danos = morte.flatMap((e) => (e.tipo === 'dano_jogador' ? [e.quantia] : []));
    expect(danos).toHaveLength(1);
    expect(danos[0]).toBeCloseTo(3, 6);   // 18 passos de 10/60
  });

  it('um novo acionamento zera o acumulado do pulso', () => {
    const w = mundo([{ ...UV, recarga: 5 }]);
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 1.2);   // acumulado de 11 passos ainda sem pulso
    expect(w.perigos[0].danoPulso).toBeGreaterThan(0);
    w.jogador.pos = { x: 15, z: 5 };   // sai da área (célula [7, 2])
    passar(w, 4);
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 1);
    expect(w.perigos[0].danoPulso).toBe(0);
  });

  it('entrar na área ligada emite o pulso na hora (sem esperar o ciclo de 0,5 s)', () => {
    const w = mundo();
    w.jogador.pos = { x: 15, z: 5 };   // fora da área (célula [7, 2])
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 1.2);   // ligado há 0,2 s
    expect(w.jogador.vida).toBe(100);
    w.jogador.pos = { x: 5, z: 5 };    // entra (célula [2, 2])
    const d = 10 * PASSO;
    const entrada = passar(w, PASSO).flatMap((e) => (e.tipo === 'dano_jogador' ? [e.quantia] : []));
    expect(entrada).toHaveLength(1);
    expect(entrada[0]).toBeCloseTo(d, 9);
    // dentro, o próximo pulso só no fechamento do ciclo (0,5 s desde o liga)
    const seguintes = passar(w, 0.25).filter((e) => e.tipo === 'dano_jogador');
    expect(seguintes).toHaveLength(0);
    expect(passar(w, 0.1).filter((e) => e.tipo === 'dano_jogador')).toHaveLength(1);
    // sai e volta: pulso de novo na volta
    w.jogador.pos = { x: 15, z: 5 };
    passar(w, 0.1);
    w.jogador.pos = { x: 5, z: 5 };
    expect(passar(w, PASSO).filter((e) => e.tipo === 'dano_jogador')).toHaveLength(1);
  });

  it('jogador fora da área não é ferido', () => {
    const w = mundo([{ ...UV, area: [6, 1, 2, 3] }]);
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 6);
    expect(w.jogador.vida).toBe(100);
  });

  it('fere inimigos comuns vivos por segundo e não toca nos de fora nem nos mortos', () => {
    const w = mundo();
    const dentro = porInimigo(w, 'reforcado_teste', [3, 2]);
    const fora = porInimigo(w, 'reforcado_teste', [7, 2]);
    const morto = porInimigo(w, 'reforcado_teste', [2, 3]);
    morto.modo = 'morto';
    morto.vida = 0;
    executar(w, { acao: 'perigo', id: 'uv1' });
    const ev = passar(w, 6);
    expect(dentro.vida).toBeCloseTo(400 - 40, 1);
    expect(fora.vida).toBe(400);
    expect(morto.vida).toBe(0);
    expect(ev.filter((e) => e.tipo === 'inimigo_morto')).toEqual([]);
  });

  it('mata inimigo comum (inimigo_morto uma vez, conta nos mortos)', () => {
    const w = mundo();
    const i = porInimigo(w, 'reforcado_teste', [3, 2]);
    i.vida = 5;
    executar(w, { acao: 'perigo', id: 'uv1' });
    const ev = passar(w, 6);
    expect(i.modo).toBe('morto');
    expect(ev.filter((e) => e.tipo === 'inimigo_morto')).toEqual([{ tipo: 'inimigo_morto', id: i.id }]);
    expect(w.stats.mortos).toBe(1);
  });

  it('tira do chefe danoChefePorSeg × vidaMax × duracao', () => {
    const w = mundo([UV], [2, 2]);
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 6);
    expect(chefeDe(w).vida).toBeCloseTo(900 - 0.075 * 900 * 4, 1);   // 630
  });

  it('chefe morto pelo perigo de área: fase morto no mesmo passo', () => {
    const w = mundo([UV], [2, 2]);
    chefeDe(w).vida = 20;
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 1);
    let ev: SimEvent[] = [];
    for (let k = 0; k < 600 && chefeDe(w).modo !== 'morto'; k++) ev = avancarPerigos(w, PASSO);
    expect(chefeDe(w).modo).toBe('morto');
    expect(w.chefe!.fase).toBe('morto');
    expect(tipos(ev)).toEqual(expect.arrayContaining(['inimigo_morto', 'chefe_morto']));
  });

  it('não bloqueia células (nem para o jogador nem para a rota)', () => {
    const w = mundo();
    executar(w, { acao: 'perigo', id: 'uv1' });
    passar(w, 2);
    expect(w.perigos[0].ativo).toBeGreaterThan(0);
    expect(celulaFechada(w, 2, 2)).toBe(false);
    expect(solidoDe(w)(2, 2)).toBe(false);
  });
});

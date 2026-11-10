// tests/sim/chefes.test.ts — registro de IA de chefe por tipo e o que é comum a todos (C3.1)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { confirmarMorteChefe, estadoChefe, inimigoDoChefe } from '../../src/sim/ai/chefeComum';
import { iaDeChefe } from '../../src/sim/ai/chefes';
import { criarInimigo } from '../../src/sim/ai/comum';
import { TIPOS } from '../../src/sim/ai/tipos';
import { centro } from '../../src/sim/grid';
import { executar } from '../../src/sim/triggers';
import { ferirInimigo } from '../../src/sim/weapons';
import { criarWorld, gravarCheckpoint, restaurarCheckpoint } from '../../src/sim/world';
import { faseComChefe, faseMinima, porInimigo } from './ajuda';

const CORREDOR = `
  ######################
  #P...................#
  #....................#
  #....................#
  ######################
`;

describe('registro iaDeChefe', () => {
  it('tem o 096 e devolve null para tipo sem IA de chefe', () => {
    const ia = iaDeChefe('entidade096');
    expect(ia).not.toBeNull();
    expect(typeof ia!.avancar).toBe('function');
    expect(typeof ia!.criarEstado).toBe('function');
    expect(typeof ia!.retomar).toBe('function');
    expect(typeof ia!.despertar).toBe('function');
    expect(iaDeChefe('x')).toBeNull();
    expect(iaDeChefe('funcionario')).toBeNull();
  });

  it('criarEstado do 096: inerte, com tipo, apontando para o inimigo', () => {
    expect(iaDeChefe('entidade096')!.criarEstado(7)).toEqual({
      tipo: 'entidade096', inimigoId: 7, fase: 'inerte', timer: 0, olhar: 0, naArena: false,
      portaAlvo: null, investida: null, passo: 0,
    });
  });

  it('criarWorld usa o registro: estado do chefe com tipo; tipo sem IA de chefe = erro', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { saida: [20, 3] }));
    expect(w.chefe).toMatchObject({ tipo: 'entidade096', fase: 'inerte' });
    expect(() => criarWorld(faseComChefe(CORREDOR, { em: [18, 1], tipo: 'funcionario' }, { saida: [20, 3] }))).toThrow(/tipo de chefe/);
  });

  it('a ação chefe passa pelo registro (despertar)', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { saida: [20, 3] }));
    expect(executar(w, { acao: 'chefe' })).toEqual([{ tipo: 'chefe_desperta' }]);
    expect(w.chefe!.fase).toBe('despertando');
    expect(executar(w, { acao: 'chefe' })).toEqual([]);
  });

  it('restauro com o 096 acordado continua indo à retomada', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1], retomada: [15, 3] }, { saida: [20, 3] }));
    w.chefe!.fase = 'perseguicao';
    gravarCheckpoint(w);
    restaurarCheckpoint(w);
    const i = inimigoDoChefe(w)!;
    expect(i.pos).toEqual(centro([15, 3]));
    expect(w.chefe).toMatchObject({ tipo: 'entidade096', fase: 'despertando', timer: 3 });
  });
});

describe('chefeComum', () => {
  it('estadoChefe e inimigoDoChefe', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { saida: [20, 3] }));
    expect(estadoChefe(w)).toBe(w.chefe);
    expect(inimigoDoChefe(w)?.id).toBe(w.chefe!.inimigoId);
    const sem = criarWorld(faseMinima(CORREDOR, { saida: [20, 3] }));
    expect(estadoChefe(sem)).toBeNull();
    expect(inimigoDoChefe(sem)).toBeUndefined();
    expect(confirmarMorteChefe(sem)).toEqual([]);
  });

  it('confirmarMorteChefe: só com o inimigo morto, uma vez, limpando o estado do 096', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { saida: [20, 3] }));
    const c = w.chefe!;
    if (c.tipo !== 'entidade096') throw new Error('esperava o 096');
    c.fase = 'arrombando';
    c.portaAlvo = 'p';
    c.investida = { x: 1, z: 0 };
    expect(confirmarMorteChefe(w)).toEqual([]);
    ferirInimigo(w, inimigoDoChefe(w)!, 10000);
    expect(confirmarMorteChefe(w)).toEqual([{ tipo: 'chefe_morto' }]);
    expect(c).toMatchObject({ fase: 'morto', portaAlvo: null, investida: null });
    expect(confirmarMorteChefe(w)).toEqual([]);
  });

  it('não importa nenhuma IA de chefe; perigos e armas não importam chefe096', () => {
    const ler = (p: string) => readFileSync(new URL(`../../src/sim/${p}`, import.meta.url), 'utf8');
    expect(ler('ai/chefeComum.ts')).not.toMatch(/from '\.\/chefe(096|049|s)'/);
    expect(ler('perigos.ts')).not.toMatch(/chefe096|chefe049/);
    expect(ler('weapons.ts')).not.toMatch(/chefe096|chefe049/);
  });
});

describe('contratos novos de inimigo', () => {
  it('os tipos do CP1/CP2 não são reanimáveis', () => {
    for (const nome of ['funcionario', 'seguranca', 'entidade096']) expect([nome, TIPOS[nome].reanimavel]).toEqual([nome, false]);
  });

  it('inimigo novo começa com jaMorreu false e contado true', () => {
    const w = criarWorld(faseMinima(CORREDOR, { saida: [20, 3] }));
    const i = porInimigo(w, 'funcionario', [5, 2]);
    expect(i.jaMorreu).toBe(false);
    expect(i.contado).toBe(true);
  });

  it('corpo: true começa sem contar no total (contado false); corpo: false conta', () => {
    const w = criarWorld(faseMinima(CORREDOR, { saida: [20, 3] }));
    expect(criarInimigo(w, { em: [5, 2], tipo: 'funcionario', corpo: true }).contado).toBe(false);
    expect(criarInimigo(w, { em: [6, 2], tipo: 'funcionario', corpo: false }).contado).toBe(true);
    expect(criarInimigo(w, { em: [7, 2], tipo: 'funcionario', corpo: true }).jaMorreu).toBe(false);
  });
});

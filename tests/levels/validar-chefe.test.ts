// Validador (C2.2, correção 4): chefe, perigos, props, catálogo de sons e patrulha de inimigos de spawn.
import { describe, expect, it } from 'vitest';
import { validarFase } from '../../src/levels/validar';
import type { ChefeDef, GatilhoDef, LevelDef, PerigoDef } from '../../src/sim/fase';
import { faseComChefe, faseMinima } from '../sim/ajuda';

const livre = { minSegredos: 0, minCartoes: 0 };

/*
 * Sala com o chefe (b) e a saída (X); a coluna 5 é o vão da comporta; à direita (colunas 7 a 9), um
 * cômodo isolado.
 */
const PLANTA = [
  '###########',
  '#P....#...#',
  '#.....#...#',
  '#...b.X#..#',
  '###########',
].join('\n');

const comporta: PerigoDef = { id: 'c1', tipo: 'comporta', area: [5, 1, 1, 3], duracao: 3, recarga: 8, danoChefe: 0.3, danoComum: 20 };
const aciona: GatilhoDef = { id: 'alavanca', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'perigo', id: 'c1' }], umaVez: false };

function fase(chefe: Partial<ChefeDef> = {}, extra: Partial<LevelDef> = {}): LevelDef {
  return faseComChefe(PLANTA, { em: 'b', arena: [2, 1, 3, 3], perigos: [comporta], ...chefe }, { saida: [6, 3], gatilhos: [aciona], ...extra });
}

describe('validarFase: chefe', () => {
  it('aceita fase com chefe, arena alcançável e comporta acionada', () => {
    expect(validarFase(fase(), livre)).toEqual([]);
  });

  it('acusa tipo de chefe desconhecido (inclusive tipo comum sem IA de chefe)', () => {
    expect(validarFase(fase({ tipo: 'nao-existe' }), livre)).toContain('Chefe tem tipo desconhecido "nao-existe"');
    expect(validarFase(fase({ tipo: 'funcionario' }), livre)).toContain('Chefe tem tipo desconhecido "funcionario"');
  });

  it('acusa chefe e retomada fora de célula andável', () => {
    expect(validarFase(fase({ em: [0, 0] }), livre)).toContain('Chefe fora de célula andável');
    expect(validarFase(fase({ retomada: [6, 0] }), livre)).toContain('Retomada do chefe fora de célula andável');
  });

  it('acusa arena sem nenhuma célula alcançável', () => {
    expect(validarFase(fase({ arena: [7, 1, 3, 3] }), livre)).toContain('Arena do chefe inalcançável');
    expect(validarFase(fase({ arena: [0, 0, 1, 1] }), livre)).toContain('Arena do chefe inalcançável');
    expect(validarFase(fase({ arena: [5, 3, 4, 1] }), livre)).not.toContain('Arena do chefe inalcançável');
  });

  it('acusa perigo com área fora de célula andável', () => {
    const torto = { ...comporta, area: [5, 0, 1, 4] as const };
    expect(validarFase(fase({ perigos: [torto] }), livre)).toContain('Perigo "c1" tem área fora de célula andável');
  });

  it('acusa perigo que nenhum gatilho aciona e gatilho que aciona perigo inexistente', () => {
    expect(validarFase(fase({}, { gatilhos: [] }), livre)).toContain('Perigo "c1" não é acionado por nenhum gatilho');
    const errado: GatilhoDef = { ...aciona, faz: [{ acao: 'perigo', id: 'c9' }] };
    const erros = validarFase(fase({}, { gatilhos: [errado] }), livre);
    expect(erros).toContain('Gatilho "alavanca" aciona perigo "c9" inexistente');
    expect(erros).toContain('Perigo "c1" não é acionado por nenhum gatilho');
    const semChefe = faseMinima(PLANTA, { saida: [6, 3], gatilhos: [aciona] });
    expect(validarFase(semChefe, livre)).toContain('Gatilho "alavanca" aciona perigo "c1" inexistente');
  });

  it('acusa perigo com recarga menor que a duração (reacionável ainda fechado)', () => {
    const curta = { ...comporta, duracao: 5, recarga: 4 };
    expect(validarFase(fase({ perigos: [curta] }), livre)).toContain('Perigo "c1" tem recarga menor que a duração');
    expect(validarFase(fase({ perigos: [{ ...comporta, duracao: 5, recarga: 5 }] }), livre)).toEqual([]);
  });

  it('acusa arena só acessível depois do chefe morto', () => {
    // arena (colunas 7 a 9) atrás da porta D, que só chefe_morto destranca
    const planta = ['###########', '#P...b.D..#', '###########'].join('\n');
    const com = (quando: GatilhoDef['quando']) => validarFase(faseComChefe(planta, { em: 'b', arena: [8, 1, 2, 1] }, {
      saida: [9, 1], portas: [{ id: 'd', em: 'D', trancada: true }],
      gatilhos: [{ id: 'g', quando, faz: [{ acao: 'porta', id: 'd', estado: 'destrancar' }] }],
    }), livre);
    expect(com({ tipo: 'chefe_morto' })).toEqual(['Arena do chefe inalcançável']);
    expect(com({ tipo: 'chefe_vida', abaixo: 0.5 })).toEqual(['Arena do chefe inalcançável']);
    expect(com({ tipo: 'area', area: [1, 1, 1, 1] })).toEqual([]);
  });

  it('acusa perigo acionado só por gatilho inalcançável', () => {
    const longe: GatilhoDef = { ...aciona, id: 'longe', quando: { tipo: 'area', area: [8, 1, 1, 1] } };
    const erros = validarFase(fase({}, { gatilhos: [longe] }), livre);
    expect(erros).toContain('Perigo "c1" só é acionado por gatilho inalcançável');
    expect(erros).not.toContain('Perigo "c1" não é acionado por nenhum gatilho');
    expect(validarFase(fase({}, { gatilhos: [longe, aciona] }), livre)).toEqual([]);
    const porTerminal = validarFase(fase({}, {
      terminais: [{ id: 't', em: [1, 0], rotulo: 'Comporta' }],
      gatilhos: [{ ...aciona, quando: { tipo: 'terminal', id: 't' } }],
    }), livre);
    expect(porTerminal).toEqual([]);
  });

  it('acusa perigo que cobre uma porta', () => {
    const erros = validarFase(fase({}, { portas: [{ id: 'p1', em: [5, 2] }] }), livre);
    expect(erros).toContain('Perigo "c1" cobre a porta "p1"');
    expect(validarFase(fase({}, { portas: [{ id: 'p1', em: [4, 2] }] }), livre)).toEqual([]);
  });

  it('acusa ids de perigo repetidos', () => {
    expect(validarFase(fase({ perigos: [comporta, comporta] }), livre)).toContain('Id duplicado: "c1"');
  });

  it('acusa gatilho que depende do chefe numa fase sem chefe', () => {
    const f = faseMinima(PLANTA, {
      saida: [6, 3],
      gatilhos: [
        { id: 'fim', quando: { tipo: 'chefe_morto' }, faz: [{ acao: 'mensagem', texto: 'ok' }] },
        { id: 'meio', quando: { tipo: 'chefe_vida', abaixo: 0.5 }, faz: [{ acao: 'mensagem', texto: 'ok' }] },
        { id: 'acorda', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'chefe' }] },
      ],
    });
    const erros = validarFase(f, livre);
    expect(erros).toContain('Gatilho "fim" depende do chefe, mas a fase não tem chefe');
    expect(erros).toContain('Gatilho "meio" depende do chefe, mas a fase não tem chefe');
    expect(erros).toContain('Gatilho "acorda" depende do chefe, mas a fase não tem chefe');
  });

  it('porta aberta por chefe_morto ou chefe_vida conta como aberta no alcance', () => {
    const planta = ['#########', '#P..b.D.#', '#########'].join('\n');
    for (const quando of [{ tipo: 'chefe_morto' }, { tipo: 'chefe_vida', abaixo: 0.5 }] as const) {
      const f = faseComChefe(planta, { em: 'b', arena: [1, 1, 4, 1] }, {
        saida: [7, 1], portas: [{ id: 'd', em: 'D', trancada: true }],
        gatilhos: [{ id: 'g', quando, faz: [{ acao: 'porta', id: 'd', estado: 'destrancar' }] }],
      });
      expect(validarFase(f, livre)).toEqual([]);
    }
  });
});

describe('validarFase: props e catálogo de sons', () => {
  const base = '#####\n#P.X#\n#####';

  it('acusa prop de tipo desconhecido e placa sem texto', () => {
    const f = faseMinima(base, {
      saida: [3, 1],
      props: [
        { em: [2, 1], tipo: 'mesa' },
        { em: [2, 1], tipo: 'piano' as never },
        { em: [2, 1], tipo: 'placa', texto: 'Setor B', parede: 'n' },
        { em: [2, 1], tipo: 'placa', parede: 'n' },
        { em: [2, 1], tipo: 'placa', texto: '   ', parede: 's' },
      ],
    });
    expect(validarFase(f, livre)).toEqual(['Prop #1 tem tipo desconhecido "piano"', 'Placa #3 sem texto', 'Placa #4 sem texto']);
  });

  it('acusa placa fora de célula andável e placa sem parede atrás', () => {
    // [1..4, 1] livres; ao norte e ao sul de cada um, parede; [4, 1] tem parede a leste, [2, 1] não tem a leste nem a oeste
    const planta = '######\n#P..X#\n######';
    const placa = (em: [number, number], extra: object) => ({ em, tipo: 'placa' as const, texto: 'Saída', ...extra });
    const f = faseMinima(planta, {
      saida: [4, 1],
      props: [
        placa([2, 1], { parede: 'n' }),          // ok: linha 0 é parede
        placa([2, 1], { parede: 's' }),          // ok
        placa([4, 1], { parede: 'l' }),          // ok: coluna 5 é parede
        placa([1, 1], { parede: 'o' }),          // ok: coluna 0 é parede
        placa([2, 1], { parede: 'l' }),          // #4: [3, 1] é piso
        placa([3, 1], { parede: 'o' }),          // #5: [2, 1] é piso
        placa([0, 1], { parede: 'l' }),          // #6: em parede
        placa([2, 1], {}),                       // ok: sem parede, yaw 0 olha para -z e encosta em +z ('s')
        placa([2, 1], { yaw: Math.PI / 2 }),     // #8: olha para -x, encosta em +x: [3, 1] é piso
        placa([4, 1], { yaw: Math.PI / 2 }),     // ok: encosta em +x, coluna 5 é parede
      ],
    });
    expect(validarFase(f, livre)).toEqual([
      'Placa #4 sem parede atrás',
      'Placa #5 sem parede atrás',
      'Placa #6 fora de célula andável',
      'Placa #8 sem parede atrás',
    ]);
  });

  it('placa encostada na borda da grade vale', () => {
    const f = faseMinima('#P.X#', { saida: [3, 0], props: [{ em: [2, 0], tipo: 'placa', texto: 'Borda', parede: 'n' }] });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('acusa som de fundo, música e som de gatilho fora do catálogo', () => {
    const f = faseMinima(base, {
      saida: [3, 1],
      ambiente: { nevoa: 0, corNevoa: 0, ambiente: 1, somDeFundo: 'chuva', musica: 'valsa' },
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'som', id: 'bip' }, { acao: 'som', id: 'trovao' }] }],
    });
    expect(validarFase(f, livre)).toEqual([
      'Som de fundo "chuva" desconhecido',
      'Música "valsa" desconhecida',
      'Gatilho "g" toca som "trovao" desconhecido',
    ]);
  });

  it('aceita nomes do catálogo e vazio (sem som)', () => {
    const f = faseMinima(base, { saida: [3, 1], ambiente: { nevoa: 0, corNevoa: 0, ambiente: 1, somDeFundo: 'ventilacao', musica: 'tensao' } });
    expect(validarFase(f, livre)).toEqual([]);
    expect(validarFase(faseMinima(base, { saida: [3, 1] }), livre)).toEqual([]);
  });
});

describe('validarFase: inimigos de spawn', () => {
  it('acusa ponto de patrulha inalcançável de inimigo criado por gatilho', () => {
    const planta = '########\n#Pa.X#.#\n########';
    const com = (patrulha: [number, number][]) => validarFase(faseMinima(planta, {
      saida: [4, 1],
      gatilhos: [{ id: 'emboscada', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'spawn', inimigos: [{ em: 'a', tipo: 'funcionario', patrulha }] }] }],
    }), livre);
    expect(com([[3, 1]])).toEqual([]);
    expect(com([[0, 0]])).toContain('Inimigo criado pelo gatilho "emboscada" tem ponto de patrulha inalcançável');
    expect(com([[6, 1]])).toContain('Inimigo criado pelo gatilho "emboscada" tem ponto de patrulha inalcançável');
  });
});

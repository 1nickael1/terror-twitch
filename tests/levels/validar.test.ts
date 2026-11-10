import { describe, expect, it } from 'vitest';
import { validarFase } from '../../src/levels/validar';
import { faseMinima } from '../sim/ajuda';

const livre = { minSegredos: 0, minCartoes: 0 };

describe('validarFase', () => {
  it('aceita uma fase simples', () => {
    expect(validarFase(faseMinima('#####\n#P.X#\n#####', { saida: [3, 1] }), livre)).toEqual([]);
  });

  it('acusa saída inalcançável', () => {
    expect(validarFase(faseMinima('######\n#P#.X#\n######', { saida: [4, 1] }), livre)).toContain('Saída inalcançável');
  });

  it('aceita cartão antes da porta', () => {
    const f = faseMinima('#######\n#Pc.D.#\n#######', {
      saida: [5, 1], portas: [{ id: 'd', em: 'D', exige: 1, trancada: true }],
      pickups: [{ em: 'c', tipo: 'cartao', nivel: 1 }],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('acusa cartão atrás da própria porta', () => {
    const f = faseMinima('#######\n#P.Dc.#\n#######', {
      saida: [5, 1], portas: [{ id: 'd', em: 'D', exige: 1, trancada: true }],
      pickups: [{ em: 'c', tipo: 'cartao', nivel: 1 }],
    });
    const erros = validarFase(f, livre);
    expect(erros).toContain('Cartão nível 1 só é alcançável passando pela porta "d" que ele abre');
    expect(erros).toContain('Saída inalcançável');
  });

  it('acusa porta que exige cartão mas não está trancada (abriria livre)', () => {
    const f = faseMinima('#######\n#Pc.D.#\n#######', {
      saida: [5, 1], portas: [{ id: 'd', em: 'D', exige: 2 }],
      pickups: [{ em: 'c', tipo: 'cartao', nivel: 2 }],
    });
    expect(validarFase(f, livre)).toContain('Porta "d" exige cartão mas não está trancada');
  });

  it('porta trancada sem cartão precisa de gatilho alcançável', () => {
    const base = { saida: [5, 1] as const, portas: [{ id: 'd', em: 'D', trancada: true }] };
    const sem = faseMinima('#######\n#P.D..#\n#######', base);
    expect(validarFase(sem, livre)).toContain('Porta "d" nunca abre');
    const com = faseMinima('#######\n#Pt.D.#\n#######', {
      ...base, terminais: [{ id: 't1', em: 't', rotulo: 'Abrir' }],
      gatilhos: [{ id: 'g', quando: { tipo: 'terminal', id: 't1' }, faz: [{ acao: 'porta', id: 'd', estado: 'abrir' }] }],
    });
    expect(validarFase(com, livre)).toEqual([]);
  });

  it('plataforma alta demais deixa a saída fora de alcance', () => {
    const f = faseMinima('#####\n#PaX#\n#####', { saida: [3, 1], legenda: { a: { piso: 2 } } });
    expect(validarFase(f, livre)).toContain('Saída inalcançável');
  });

  it('cobra mínimos de segredos e cartões', () => {
    const erros = validarFase(faseMinima('#####\n#P.X#\n#####', { saida: [3, 1] }));
    expect(erros).toContain('Fase precisa de pelo menos 2 segredos (tem 0)');
    expect(erros).toContain('Fase precisa de pelo menos 1 cartões (tem 0)');
  });

  it('acusa referências quebradas e ids repetidos', () => {
    const f = faseMinima('#####\n#P.X#\n#####', {
      saida: [3, 1],
      portas: [{ id: 'd', em: 'Z' }],
      gatilhos: [
        { id: 'g', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'porta', id: 'nao-existe', estado: 'abrir' }] },
        { id: 'g', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [] },
      ],
    });
    const erros = validarFase(f, livre);
    expect(erros).toContain('Símbolo "Z" não aparece exatamente uma vez na planta');
    expect(erros).toContain('Gatilho "g" referencia porta "nao-existe" inexistente');
    expect(erros).toContain('Id duplicado: "g"');
  });

  it('planta inválida vira um único erro', () => {
    expect(validarFase(faseMinima('###\n#.#\n###'), livre)).toHaveLength(1);
  });
});

describe('validarFase: regras adicionais', () => {
  it('acusa referências quebradas a terminal e grupo', () => {
    const f = faseMinima('#####\n#P.X#\n#####', {
      saida: [3, 1],
      gatilhos: [
        { id: 'g1', quando: { tipo: 'terminal', id: 'sumido' }, faz: [] },
        { id: 'g2', quando: { tipo: 'grupo_morto', grupo: 'ninguem' }, faz: [] },
      ],
    });
    const erros = validarFase(f, livre);
    expect(erros).toContain('Gatilho "g1" referencia terminal "sumido" inexistente');
    expect(erros).toContain('Gatilho "g2" referencia grupo "ninguem" inexistente');
  });

  it('grupo criado por spawn conta como existente', () => {
    const f = faseMinima('######\n#P.D.#\n######', {
      saida: [4, 1], portas: [{ id: 'd', em: 'D', trancada: true }],
      gatilhos: [
        { id: 'g1', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'spawn', inimigos: [{ em: [2, 1], tipo: 'funcionario', grupo: 'onda' }] }] },
        { id: 'g2', quando: { tipo: 'grupo_morto', grupo: 'onda' }, faz: [{ acao: 'porta', id: 'd', estado: 'destrancar' }] },
      ],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('acusa ids repetidos de portas, segredos, documentos e terminais', () => {
    const f = faseMinima('########\n#PabcdX#\n########', {
      saida: [6, 1],
      portas: [{ id: 'p', em: 'a' }, { id: 'p', em: 'b' }],
      segredos: [{ id: 's', area: [2, 1, 1, 1] }, { id: 's', area: [3, 1, 1, 1] }],
      documentos: [{ id: 'doc', em: 'c', titulo: 'A', texto: 'a' }, { id: 'doc', em: 'd', titulo: 'B', texto: 'b' }],
      terminais: [{ id: 't', em: [2, 1], rotulo: 'A' }, { id: 't', em: [3, 1], rotulo: 'B' }],
    });
    const erros = validarFase(f, livre);
    for (const id of ['p', 's', 'doc', 't']) expect(erros).toContain(`Id duplicado: "${id}"`);
  });

  it('acusa tudo o que fica numa área isolada', () => {
    const f = faseMinima('#########\n#P.X#abcd#\n#########', {
      saida: [3, 1],
      pickups: [{ em: 'a', tipo: 'vida_p' }],
      inimigos: [{ em: 'b', tipo: 'funcionario' }],
      documentos: [{ id: 'doc', em: 'c', titulo: 'T', texto: 'x' }],
      terminais: [{ id: 'term', em: 'd', rotulo: 'R' }],
      segredos: [{ id: 'seg', area: [5, 1, 2, 1] }],
      checkpoints: [[7, 1]],
    });
    const erros = validarFase(f, livre);
    expect(erros).toEqual(expect.arrayContaining([
      'Pickup #0 inalcançável', 'Inimigo #0 inalcançável', 'Documento "doc" inalcançável',
      'Terminal "term" inalcançável', 'Segredo "seg" inalcançável', 'Checkpoint #0 inalcançável',
    ]));
    expect(erros).not.toContain('Saída inalcançável');
  });

  it('terminal e documento numa parede vizinha de célula alcançável valem', () => {
    const f = faseMinima('#####\n#P.X#\n##t##', {
      saida: [3, 1], legenda: { t: { tipo: 'parede' } },
      terminais: [{ id: 't1', em: 't', rotulo: 'Painel' }],
      documentos: [{ id: 'doc', em: [2, 0], titulo: 'Aviso', texto: 'Na parede.' }],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('cartão nível 2 abre porta de nível 1', () => {
    const f = faseMinima('#######\n#Pc.D.#\n#######', {
      saida: [5, 1], portas: [{ id: 'd', em: 'D', exige: 1, trancada: true }],
      pickups: [{ em: 'c', tipo: 'cartao', nivel: 2 }],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('rampa precisa ficar entre duas células de piso comuns', () => {
    const boa = faseMinima('#####\n#PrX#\n#####', { saida: [3, 1], legenda: { r: { rampa: 'x' }, X: { piso: 1.5 } } });
    expect(validarFase(boa, livre)).toEqual([]);
    const dupla = faseMinima('######\n#PrsX#\n######', {
      saida: [4, 1], legenda: { r: { rampa: 'x' }, s: { rampa: 'x' }, X: { piso: 1 } },
    });
    const erros = validarFase(dupla, livre);
    expect(erros).toContain('Rampa em [2, 1] precisa ficar entre duas células de piso comuns');
    expect(erros).toContain('Rampa em [3, 1] precisa ficar entre duas células de piso comuns');
    const contraParede = faseMinima('#####\n#PrX#\n#####', { saida: [3, 1], legenda: { r: { rampa: 'z' } } });
    expect(validarFase(contraParede, livre)).toContain('Rampa em [2, 1] precisa ficar entre duas células de piso comuns');
  });

  it('acusa pickup mal definido', () => {
    const f = faseMinima('#######\n#PabcX#\n#######', {
      saida: [5, 1],
      pickups: [{ em: 'a', tipo: 'municao' }, { em: 'b', tipo: 'arma' }, { em: 'c', tipo: 'cartao' }],
    });
    const erros = validarFase(f, livre);
    expect(erros).toContain('Pickup #0 mal definido (tipo "municao")');
    expect(erros).toContain('Pickup #1 mal definido (tipo "arma")');
    expect(erros).toContain('Pickup #2 mal definido (tipo "cartao")');
  });

  it('acusa tipo de inimigo desconhecido, na fase e em spawn', () => {
    const f = faseMinima('######\n#Pa.X#\n######', {
      saida: [4, 1],
      inimigos: [{ em: 'a', tipo: 'zumbi' }],
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [3, 1, 1, 1] }, faz: [{ acao: 'spawn', inimigos: [{ em: [3, 1], tipo: 'vulto' }] }] }],
    });
    const erros = validarFase(f, livre);
    expect(erros).toContain('Inimigo #0 tem tipo desconhecido "zumbi"');
    expect(erros).toContain('Gatilho "g" cria inimigo de tipo desconhecido "vulto"');
  });

  it('acusa símbolo inexistente em spawn', () => {
    const f = faseMinima('#####\n#P.X#\n#####', {
      saida: [3, 1],
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'spawn', inimigos: [{ em: 'Q', tipo: 'funcionario' }] }] }],
    });
    expect(validarFase(f, livre)).toContain('Símbolo "Q" não aparece exatamente uma vez na planta');
  });

  it('célula de vão baixo é inalcançável', () => {
    const f = faseMinima('######\n#P.vX#\n######', {
      saida: [4, 1], legenda: { v: { teto: 1.5 } },
      pickups: [{ em: 'v', tipo: 'vida_p' }],
    });
    const erros = validarFase(f, livre);
    expect(erros).toContain('Pickup #0 inalcançável');
    expect(erros).toContain('Saída inalcançável');
  });

  it('teleporte de gatilho alcançável leva a nova região', () => {
    const f = faseMinima('#######\n#P.#.X#\n#######', {
      saida: [5, 1],
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'teleporte', para: [4, 1] }] }],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('teleporte para célula não andável é erro', () => {
    const f = faseMinima('#####\n#P.X#\n#####', {
      saida: [3, 1],
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'teleporte', para: [0, 0] }] }],
    });
    expect(validarFase(f, livre)).toContain('Gatilho "g" teleporta para célula não andável');
  });

  it('porta trancada aberta por pickup alcançável', () => {
    const f = faseMinima('######\n#PkD.#\n######', {
      saida: [4, 1], portas: [{ id: 'd', em: 'D', trancada: true }],
      pickups: [{ em: 'k', tipo: 'vida_p' }],
      gatilhos: [{ id: 'g', quando: { tipo: 'pickup', indice: 0 }, faz: [{ acao: 'porta', id: 'd', estado: 'abrir' }] }],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('acusa gatilho de pickup com índice inexistente', () => {
    const f = faseMinima('#####\n#P.X#\n#####', {
      saida: [3, 1],
      gatilhos: [{ id: 'g', quando: { tipo: 'pickup', indice: 3 }, faz: [] }],
    });
    expect(validarFase(f, livre)).toContain('Gatilho "g" referencia pickup #3 inexistente');
  });
});

describe('validarFase: correção 1', () => {
  it('aceita progressão de dois cartões (cartão 2 atrás da porta do cartão 1)', () => {
    const f = faseMinima('##########\n#Pa.Db.EX#\n##########', {
      saida: [8, 1],
      portas: [{ id: 'd1', em: 'D', exige: 1, trancada: true }, { id: 'd2', em: 'E', exige: 2, trancada: true }],
      pickups: [{ em: 'a', tipo: 'cartao', nivel: 1 }, { em: 'b', tipo: 'cartao', nivel: 2 }],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('aceita progressão de três níveis de cartão', () => {
    const f = faseMinima('#############\n#Pa.Db.Ec.FX#\n#############', {
      saida: [11, 1],
      portas: [
        { id: 'd1', em: 'D', exige: 1, trancada: true },
        { id: 'd2', em: 'E', exige: 2, trancada: true },
        { id: 'd3', em: 'F', exige: 3, trancada: true },
      ],
      pickups: [{ em: 'a', tipo: 'cartao', nivel: 1 }, { em: 'b', tipo: 'cartao', nivel: 2 }, { em: 'c', tipo: 'cartao', nivel: 3 }],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('cartão atrás de porta com exige que um gatilho alcançável também abre é válido', () => {
    const f = faseMinima('########\n#P.Dc.X#\n########', {
      saida: [6, 1], portas: [{ id: 'd', em: 'D', exige: 1, trancada: true }],
      pickups: [{ em: 'c', tipo: 'cartao', nivel: 1 }],
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'porta', id: 'd', estado: 'abrir' }] }],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('acusa grupo de luz inexistente; `alarme` e grupos das luzes valem', () => {
    const f = faseMinima('#####\n#P.X#\n#####', {
      saida: [3, 1],
      luzes: [{ em: [2, 1], cor: 0xffffff, intensidade: 1, grupo: 'sala' }],
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [
        { acao: 'luz', grupo: 'sala', ligada: false },
        { acao: 'luz', grupo: 'alarme', ligada: true },
        { acao: 'luz', grupo: 'fantasma', ligada: false },
      ] }],
    });
    expect(validarFase(f, livre)).toEqual(['Gatilho "g" referencia grupo de luz "fantasma" inexistente']);
  });

  it('acusa ponto de patrulha não andável ou inalcançável', () => {
    const planta = '#######\n#Pa.X#.#\n#######';
    const com = (patrulha: [number, number][]) =>
      validarFase(faseMinima(planta, { saida: [4, 1], inimigos: [{ em: 'a', tipo: 'funcionario', patrulha }] }), livre);
    expect(com([[3, 1], [2, 1]])).toEqual([]);
    expect(com([[0, 0]])).toContain('Inimigo #0 tem ponto de patrulha inalcançável');
    expect(com([[6, 1]])).toContain('Inimigo #0 tem ponto de patrulha inalcançável');
  });
});

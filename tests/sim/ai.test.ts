import { describe, expect, it } from 'vitest';
import { avancarInimigos, ve } from '../../src/sim/ai/comum';
import { TIPOS } from '../../src/sim/ai/tipos';
import { avancarPortas } from '../../src/sim/doors';
import { centro } from '../../src/sim/grid';
import { avancarProjeteis, ferirInimigo } from '../../src/sim/weapons';
import { criarWorld } from '../../src/sim/world';
import { irPara } from '../../src/sim/ai/movimento';
import { faseMinima, porInimigo } from './ajuda';

const dt = 1 / 60;
const SALA = `
  ############
  #P.........#
  #.....#....#
  #..........#
  ############
`;
const mundo = () => criarWorld(faseMinima(SALA));
const rodar = (w: ReturnType<typeof mundo>, s: number, ruidos: { pos: { x: number; z: number }; raio: number }[] = []) => {
  const tipos: string[] = [];
  for (let i = 0; i < Math.ceil(s / dt); i++) {
    tipos.push(...avancarInimigos(w, i === 0 ? ruidos : [], dt).map((e) => e.tipo));
    tipos.push(...avancarProjeteis(w, dt).map((e) => e.tipo));
  }
  return tipos;
};
const OESTE = Math.PI / 2;   // olhando para -x, na direção do jogador

describe('percepção', () => {
  it('vê o jogador à frente e não vê de costas', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [8, 1]);
    i.yaw = OESTE;
    expect(ve(w, i)).toBe(true);
    i.yaw = -OESTE;
    expect(ve(w, i)).toBe(false);
  });

  it('parede esconde o jogador', () => {
    const w = mundo();
    w.jogador.pos = centro([4, 2]);
    const i = porInimigo(w, 'funcionario', [8, 2]);
    i.yaw = OESTE;
    expect(ve(w, i)).toBe(false);
  });

  it('com a lanterna apagada o alcance de visão cai', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [9, 1]);
    i.yaw = OESTE;
    expect(ve(w, i)).toBe(true);
    w.jogador.lanterna = false;
    expect(ve(w, i)).toBe(false);
  });
});

describe('estados', () => {
  it('avancador vê, persegue, ataca e fere', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [7, 1]);
    i.yaw = OESTE;
    const tipos = rodar(w, 4);
    expect(tipos).toEqual(expect.arrayContaining(['inimigo_alerta', 'inimigo_ataque', 'dano_jogador']));
    expect(w.jogador.vida).toBeLessThan(100);
  });

  it('ruído leva à suspeita no ponto do som, sem saber onde o jogador está', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [9, 3]);
    i.yaw = 0;                                   // de lado para o jogador
    rodar(w, 0.1, [{ pos: centro([3, 3]), raio: 24 }]);
    expect(i.modo).toBe('suspeita');
    expect(i.alvo).toEqual(centro([3, 3]));
  });

  it('ruído fraco e distante não é ouvido', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [9, 3]);
    i.yaw = 0;
    rodar(w, 0.1, [{ pos: centro([1, 3]), raio: 4 }]);
    expect(i.modo).toBe('patrulha');
  });

  it('persegue contornando a parede', () => {
    const w = mundo();
    w.jogador.pos = centro([4, 2]);
    const i = porInimigo(w, 'funcionario', [8, 2]);
    i.modo = 'perseguicao';
    rodar(w, 3);
    expect(Math.hypot(i.pos.x - w.jogador.pos.x, i.pos.z - w.jogador.pos.z)).toBeLessThan(2.5);
  });

  it('atirador dispara projétil que dá para desviar', () => {
    const w = mundo();
    const i = porInimigo(w, 'seguranca', [9, 1]);
    i.yaw = OESTE;
    const tipos = rodar(w, 1.2);
    expect(tipos).toContain('projetil');
    w.jogador.pos = centro([2, 3]);              // sai da linha
    const vida = w.jogador.vida;
    for (let k = 0; k < 120; k++) avancarProjeteis(w, dt);
    expect(w.jogador.vida).toBe(vida);
  });

  it('dormindo ignora o jogador até levar dano', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [5, 1]);
    i.modo = 'dormindo';
    i.yaw = OESTE;
    rodar(w, 1);
    expect(i.modo).toBe('dormindo');
  });

  it('a morte do jogador encerra o jogo', () => {
    const w = mundo();
    w.jogador.vida = 1;
    const i = porInimigo(w, 'funcionario', [2, 1]);
    i.yaw = OESTE;
    const tipos = rodar(w, 2);
    expect(tipos).toContain('jogador_morto');
    expect(w.estado).toBe('morto');
  });

  it('morto não se move nem ataca', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [3, 1]);
    i.modo = 'morto';
    const antes = { ...i.pos };
    rodar(w, 1);
    expect(i.pos).toEqual(antes);
    expect(w.jogador.vida).toBe(100);
    expect(TIPOS.funcionario.vida).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Testes acrescentados além do resumo.

/** Jogador lacrado num cubículo: ninguém o vê nem chega até ele. */
const LACRADO = `
  ##############
  #P#..........#
  ###..........#
  #............#
  ##############
`;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

// arquétipo emboscador só para teste (os tipos do CP1 não têm emboscador); cada arquivo de teste tem seu módulo
TIPOS.emboscador_teste = { ...TIPOS.funcionario, arquetipo: 'emboscador' };

describe('emboscador', () => {
  it('percebe o jogador a até 5 m', () => {
    const w = mundo();
    const i = porInimigo(w, 'emboscador_teste', [3, 1]);   // 4 m
    i.yaw = OESTE;
    expect(ve(w, i)).toBe(true);
  });

  it('a 8 m só percebe se o jogador está de costas', () => {
    const w = mundo();
    const i = porInimigo(w, 'emboscador_teste', [5, 1]);   // 8 m
    i.yaw = OESTE;
    expect(ve(w, i)).toBe(false);                            // o jogador olha para +x, de frente para ele
    w.jogador.yaw = Math.PI / 2;                             // agora olha para -x: de costas
    expect(ve(w, i)).toBe(true);
  });

  it('não percebe a 12 m de frente nem de costas', () => {
    const w = mundo();
    const i = porInimigo(w, 'emboscador_teste', [7, 1]);   // 12 m
    i.yaw = OESTE;
    expect(ve(w, i)).toBe(false);
    w.jogador.yaw = Math.PI / 2;
    expect(ve(w, i)).toBe(false);
  });

  it('fica parado em patrulha mesmo com pontos de patrulha', () => {
    const w = criarWorld(faseMinima(LACRADO));
    const i = porInimigo(w, 'emboscador_teste', [4, 3]);
    i.patrulha = [centro([4, 3]), centro([10, 3])];
    const antes = { ...i.pos };
    rodar(w, 2);
    expect(i.modo).toBe('patrulha');
    expect(i.pos).toEqual(antes);
  });
});

describe('perda de vista', () => {
  it('6 s sem ver o jogador levam à suspeita no último ponto visto', () => {
    // o último ponto visto fica longe (22 m) e o inimigo está lento: não chega antes dos 6 s
    const w = criarWorld(faseMinima(LACRADO));
    const i = porInimigo(w, 'funcionario', [12, 3]);
    i.modo = 'perseguicao';
    i.lento = 100;
    i.ultimoVisto = centro([1, 3]);
    rodar(w, 5.9);
    expect(i.modo).toBe('perseguicao');
    rodar(w, 0.2);
    expect(i.modo).toBe('suspeita');
    expect(i.alvo).toEqual(centro([1, 3]));
  });

  it('ao chegar ao ponto suspeito olha em volta por 2 s e volta à patrulha', () => {
    const w = criarWorld(faseMinima(LACRADO));
    const i = porInimigo(w, 'funcionario', [8, 3]);
    rodar(w, 0.1, [{ pos: centro([6, 3]), raio: 24 }]);
    expect(i.modo).toBe('suspeita');
    rodar(w, 2);                                 // chega (4 m a 60% da velocidade ≈ 1,5 s) e começa a olhar
    expect(i.modo).toBe('suspeita');
    expect(dist(i.pos, centro([6, 3]))).toBeLessThan(0.01);
    rodar(w, 2);
    expect(i.modo).toBe('patrulha');
  });
});

describe('portas', () => {
  const COM_PORTA = `
    #########
    #P......#
    #####D###
    #.......#
    #########
  `;

  const rodarComPortas = (w: ReturnType<typeof mundo>, s: number) => {
    for (let k = 0; k < Math.ceil(s / dt); k++) {
      avancarInimigos(w, [], dt);
      avancarPortas(w, dt);
    }
  };

  it('abre porta destrancada que está na rota e passa', () => {
    const w = criarWorld(faseMinima(COM_PORTA, { portas: [{ id: 'p', em: 'D' }] }));
    const i = porInimigo(w, 'funcionario', [2, 3]);
    i.modo = 'perseguicao';
    rodarComPortas(w, 6);
    expect(w.portas[0].estado).toBe('aberta');
    expect(dist(i.pos, w.jogador.pos)).toBeLessThan(2.5);
  });

  it('não atravessa porta trancada nem a abre', () => {
    const w = criarWorld(faseMinima(COM_PORTA, { portas: [{ id: 'p', em: 'D', trancada: true }] }));
    const i = porInimigo(w, 'funcionario', [2, 3]);
    i.modo = 'perseguicao';
    rodarComPortas(w, 6);
    expect(w.portas[0].estado).toBe('trancada');
    expect(i.pos.z).toBeGreaterThan(6);          // continua na sala de baixo (linha 3)
  });
});

describe('patrulha', () => {
  it('anda em laço entre os pontos a 40% da velocidade', () => {
    const w = criarWorld(faseMinima(LACRADO));
    const i = porInimigo(w, 'funcionario', [4, 3]);
    i.patrulha = [centro([4, 3]), centro([8, 3])];
    const a = centro([4, 3]);
    const b = centro([8, 3]);
    let chegouEmB = -1;
    let voltouParaA = -1;
    let maiorPasso = 0;
    for (let k = 0; k < 12 / dt; k++) {
      const antes = { ...i.pos };
      avancarInimigos(w, [], dt);
      maiorPasso = Math.max(maiorPasso, dist(antes, i.pos));
      if (chegouEmB < 0 && dist(i.pos, b) < 0.01) chegouEmB = k;
      if (chegouEmB >= 0 && voltouParaA < 0 && dist(i.pos, a) < 0.01) voltouParaA = k;
    }
    expect(i.modo).toBe('patrulha');
    expect(chegouEmB).toBeGreaterThan(0);
    expect(voltouParaA).toBeGreaterThan(chegouEmB);
    expect(maiorPasso).toBeCloseTo(TIPOS.funcionario.velocidade * 0.4 * dt, 5);
  });

  it('sem pontos de patrulha fica parado', () => {
    const w = criarWorld(faseMinima(LACRADO));
    const i = porInimigo(w, 'funcionario', [4, 3]);
    const antes = { ...i.pos };
    rodar(w, 1);
    expect(i.pos).toEqual(antes);
  });
});

describe('lentidão', () => {
  const percorrido = (lento: number) => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [9, 1]);   // linha reta até o jogador
    i.modo = 'perseguicao';
    i.lento = lento;
    let total = 0;
    for (let k = 0; k < 30; k++) {
      const antes = { ...i.pos };
      avancarInimigos(w, [], dt);
      total += dist(antes, i.pos);
    }
    return { total, lento: i.lento };
  };

  it('lento reduz a velocidade e decresce com o tempo', () => {
    const normal = percorrido(0);
    const lento = percorrido(10);
    expect(lento.total / normal.total).toBeCloseTo(0.5, 2);
    expect(lento.lento).toBeCloseTo(10 - 30 * dt, 5);
  });
});

describe('atirador', () => {
  it('recua quando o jogador está perto demais', () => {
    const w = mundo();
    const i = porInimigo(w, 'seguranca', [2, 1]);   // 2 m
    i.yaw = OESTE;
    rodar(w, 2);
    expect(dist(i.pos, w.jogador.pos)).toBeGreaterThan(TIPOS.seguranca.distanciaIdeal / 2 - 0.1);
  });

  it('o projétil acerta o jogador parado e passa pelo colete', () => {
    const w = mundo();
    w.jogador.colete = 50;
    const i = porInimigo(w, 'seguranca', [7, 1]);
    i.yaw = OESTE;
    const tipos = rodar(w, 2.5);
    expect(tipos).toContain('dano_jogador');
    expect(w.jogador.colete).toBeLessThan(50);
    expect(w.projeteis.filter((p) => p.de === 'inimigo').length).toBeLessThanOrEqual(1);
  });

  it('o projétil some na parede', () => {
    const w = mundo();
    const i = porInimigo(w, 'seguranca', [9, 1]);
    i.yaw = OESTE;
    rodar(w, 1.2);
    w.jogador.pos = centro([2, 3]);
    for (let k = 0; k < 120; k++) avancarProjeteis(w, dt);
    expect(w.projeteis).toEqual([]);
  });
});

describe('altura na visão', () => {
  const PLATAFORMA = `
    ###########
    #P...A....#
    ###########
  `;

  it('plataforma alta entre os dois esconde o jogador', () => {
    const w = criarWorld(faseMinima(PLATAFORMA, { legenda: { A: { piso: 3 } } }));
    const i = porInimigo(w, 'funcionario', [9, 1]);
    i.yaw = OESTE;
    expect(ve(w, i)).toBe(false);
  });

  it('plataforma baixa não esconde', () => {
    const w = criarWorld(faseMinima(PLATAFORMA, { legenda: { A: { piso: 1 } } }));
    const i = porInimigo(w, 'funcionario', [9, 1]);
    i.yaw = OESTE;
    expect(ve(w, i)).toBe(true);
  });
});

describe('sono', () => {
  it('ruído a até metade do raio acorda quem dorme; mais longe, não', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [9, 3]);
    i.modo = 'dormindo';
    rodar(w, 0.1, [{ pos: centro([4, 3]), raio: 12 }]);   // 10 m > 6 m
    expect(i.modo).toBe('dormindo');
    rodar(w, 0.1, [{ pos: centro([6, 3]), raio: 12 }]);   // 6 m
    expect(i.modo).toBe('suspeita');
  });
});

describe('fim de jogo', () => {
  it('com o jogo parado, avancarInimigos não faz nada', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [3, 1]);
    i.yaw = OESTE;
    w.estado = 'morto';
    const antes = structuredClone(i);
    expect(avancarInimigos(w, [], dt)).toEqual([]);
    expect(i).toEqual(antes);
  });

  it('jogador_morto sai uma vez só', () => {
    const w = mundo();
    w.jogador.vida = 1;
    porInimigo(w, 'funcionario', [2, 1]).yaw = OESTE;
    porInimigo(w, 'funcionario', [2, 3]).yaw = OESTE;
    const tipos = rodar(w, 3);
    expect(tipos.filter((t) => t === 'jogador_morto')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Correção 1.

describe('limite de cálculo de rota', () => {
  it('patrulha com ponto atrás de porta trancada calcula rota no máximo 9 vezes em 2 s', () => {
    const PLANTA = `
      #########
      #P......#
      #####D###
      #.......#
      #########
    `;
    const w = criarWorld(faseMinima(PLANTA, { portas: [{ id: 'p', em: 'D', trancada: true }] }));
    const i = porInimigo(w, 'funcionario', [2, 3]);
    i.patrulha = [centro([2, 3]), centro([5, 1])];
    rodar(w, 2);
    expect(i.rotasCalculadas).toBeGreaterThan(0);
    expect(i.rotasCalculadas).toBeLessThanOrEqual(9);
    expect(i.pos.z).toBeGreaterThan(6);
  });

  it('perseguição com visão direta calcula rota no máximo 9 vezes em 2 s', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [5, 1]);   // 8 m em linha reta: chega em ~1,5 s
    i.modo = 'perseguicao';
    rodar(w, 2);
    expect(i.rotasCalculadas).toBeLessThanOrEqual(9);
    expect(dist(i.pos, w.jogador.pos)).toBeLessThanOrEqual(TIPOS.funcionario.alcanceAtaque + 0.1);
  });

  it('jogador colado na parede na mesma célula: anda reto até o alcance de ataque', () => {
    const w = mundo();
    w.jogador.pos = { x: 2.31, z: 2.31 };
    const i = porInimigo(w, 'funcionario', [1, 1]);
    i.pos = { x: 3.65, z: 2.36 };
    i.modo = 'perseguicao';
    rodar(w, 1);
    expect(dist(i.pos, w.jogador.pos)).toBeLessThanOrEqual(TIPOS.funcionario.alcanceAtaque + 0.1);
  });
});

describe('alerta por dano', () => {
  it('dormindo que leva dano acorda com um único inimigo_alerta e persegue', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [9, 3]);
    i.modo = 'dormindo';
    ferirInimigo(w, i, 1);
    const tipos = rodar(w, 0.5);
    expect(tipos.filter((t) => t === 'inimigo_alerta')).toHaveLength(1);
    expect(i.modo).toBe('perseguicao');
  });

  it('já alertado, levar dano não alerta de novo', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [7, 1]);
    i.yaw = OESTE;
    expect(rodar(w, 0.1)).toContain('inimigo_alerta');
    ferirInimigo(w, i, 1);
    expect(rodar(w, 0.5)).not.toContain('inimigo_alerta');
    expect(i.modo).toBe('perseguicao');
  });
});

describe('perseguição sem ver', () => {
  it('vai ao último ponto visto, não ao jogador, e lá fica em suspeita', () => {
    const w = criarWorld(faseMinima(LACRADO));
    w.jogador.pos = centro([5, 3]);
    const i = porInimigo(w, 'funcionario', [10, 3]);
    i.yaw = OESTE;
    rodar(w, 0.1);
    expect(i.modo).toBe('perseguicao');
    const visto = { ...w.jogador.pos };
    w.jogador.pos = centro([1, 1]);              // some no cubículo lacrado, longe dali
    rodar(w, 3);
    expect(i.modo).toBe('suspeita');
    expect(i.alvo).toEqual(visto);
    expect(dist(i.pos, visto)).toBeLessThan(0.75);
  });
});

describe('correções menores', () => {
  it('atirador não dispara através de janela', () => {
    const PLANTA = `
      ###########
      #P...J....#
      ###########
    `;
    const w = criarWorld(faseMinima(PLANTA, { legenda: { J: { tipo: 'janela' } } }));
    const i = porInimigo(w, 'seguranca', [9, 1]);
    i.yaw = OESTE;
    expect(ve(w, i)).toBe(true);                 // janela não esconde
    expect(rodar(w, 3)).not.toContain('projetil');
  });

  it('atirador só recua quando vê o jogador', () => {
    const w = criarWorld(faseMinima(LACRADO));
    const i = porInimigo(w, 'seguranca', [3, 1]);   // 4 m do jogador lacrado, sem vê-lo
    i.modo = 'perseguicao';
    i.ultimoVisto = centro([3, 1]);
    const antes = { ...i.pos };
    avancarInimigos(w, [], dt);
    expect(i.pos).toEqual(antes);
  });

  it('emboscador ignora ruído além de 9 m e ouve o mais perto', () => {
    const w = criarWorld(faseMinima(LACRADO));
    const i = porInimigo(w, 'emboscador_teste', [12, 3]);
    rodar(w, 0.1, [{ pos: centro([4, 3]), raio: 24 }]);   // 16 m
    expect(i.modo).toBe('patrulha');
    rodar(w, 0.1, [{ pos: centro([8, 3]), raio: 24 }]);   // 8 m
    expect(i.modo).toBe('suspeita');
  });

  it('olhar em volta mantém o yaw em (-π, π]', () => {
    const w = criarWorld(faseMinima(LACRADO));
    const i = porInimigo(w, 'funcionario', [8, 3]);
    i.yaw = 3;
    rodar(w, 0.1, [{ pos: centro([8, 3]), raio: 24 }]);    // ruído no próprio lugar: já chegou
    for (let k = 0; k < 100; k++) {
      avancarInimigos(w, [], dt);
      expect(i.yaw).toBeGreaterThan(-Math.PI);
      expect(i.yaw).toBeLessThanOrEqual(Math.PI);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Correção 2.

describe('ruído repetido', () => {
  it('ruído a cada 0,1 s não congela quem contorna uma parede até ele', () => {
    const PLANTA = `
      ##############
      #P#..........#
      ###.....#....#
      #.......#....#
      ##############
    `;
    const w = criarWorld(faseMinima(PLANTA));
    const i = porInimigo(w, 'funcionario', [10, 3]);
    const ruido = { pos: centro([6, 3]), raio: 24 };
    let andado = 0;
    for (let k = 0; k < 3 / dt; k++) {
      const antes = { ...i.pos };
      avancarInimigos(w, k % 6 === 0 ? [ruido] : [], dt);
      andado += dist(antes, i.pos);
    }
    expect(i.modo).toBe('suspeita');
    expect(andado).toBeGreaterThanOrEqual(6);
  });
});

describe('semRota por destino', () => {
  const DOIS_LACRADOS = `
    ##############
    #P#........#.#
    ###........###
    #............#
    ##############
  `;

  it('falha para A seguida de falha para B não é inalcançável; duas para B, sim', () => {
    const w = criarWorld(faseMinima(DOIS_LACRADOS));
    const i = porInimigo(w, 'funcionario', [5, 3]);
    const a = centro([1, 1]);
    const b = centro([12, 1]);
    const v = TIPOS.funcionario.velocidade;
    expect(irPara(w, i, a, v, dt).inalcancavel).toBe(false);
    i.rotaEm = 0;
    expect(irPara(w, i, b, v, dt).inalcancavel).toBe(false);
    i.rotaEm = 0;
    expect(irPara(w, i, b, v, dt).inalcancavel).toBe(true);
  });
});

describe('alerta uma vez por ciclo', () => {
  it('jogador aparece e some três vezes sem o inimigo voltar à patrulha: um alerta só', () => {
    const w = criarWorld(faseMinima(LACRADO));
    const i = porInimigo(w, 'funcionario', [10, 3]);
    i.yaw = OESTE;
    const escondido = centro([1, 1]);
    const tipos: string[] = [];
    for (let ciclo = 0; ciclo < 3; ciclo++) {
      // aparece a 6 m, na frente do inimigo
      w.jogador.pos = { x: i.pos.x - 6, z: i.pos.z };
      i.yaw = OESTE;
      for (let k = 0; k < 6; k++) tipos.push(...avancarInimigos(w, [], dt).map((e) => e.tipo));
      expect(i.modo).toBe('perseguicao');
      // some até o inimigo entrar em suspeita
      w.jogador.pos = escondido;
      for (let k = 0; k < 600 && i.modo !== 'suspeita'; k++) {
        tipos.push(...avancarInimigos(w, [], dt).map((e) => e.tipo));
        expect(i.modo).not.toBe('patrulha');
      }
      expect(i.modo).toBe('suspeita');
    }
    expect(tipos.filter((t) => t === 'inimigo_alerta')).toHaveLength(1);
  });
});

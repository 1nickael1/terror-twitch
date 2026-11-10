// tests/sim/weapons.test.ts
import { describe, expect, it } from 'vitest';
import { ARMAS, CABECA, NUVEM, PISTOLA_RESERVA, TIRO_PENDENTE } from '../../src/sim/balance';
import { atirar, avancarNuvens, avancarProjeteis, trocarArma } from '../../src/sim/weapons';
import { INPUT_VAZIO, criarWorld } from '../../src/sim/world';
import { faseMinima, porInimigo } from './ajuda';

const CORREDOR = `
  ############
  #P.........#
  ############
`;
const dt = 1 / 60;
const mundo = () => criarWorld(faseMinima(CORREDOR));
const gatilho = { ...INPUT_VAZIO, atirar: true };

describe('troca de arma', () => {
  it('tecla seleciona só arma que o jogador tem', () => {
    const w = mundo();
    w.jogador.armas = ['pistola', 'smg'];
    expect(trocarArma(w, { ...INPUT_VAZIO, arma: 'escopeta' })).toEqual([]);
    expect(trocarArma(w, { ...INPUT_VAZIO, arma: 'smg' })).toEqual([{ tipo: 'arma_trocada', arma: 'smg' }]);
    expect(w.jogador.arma).toBe('smg');
  });
  it('a roda pula armas que faltam e dá a volta', () => {
    const w = mundo();
    w.jogador.armas = ['pistola', 'smg'];
    trocarArma(w, { ...INPUT_VAZIO, roda: 1 });
    expect(w.jogador.arma).toBe('smg');
    trocarArma(w, { ...INPUT_VAZIO, roda: 1 });
    expect(w.jogador.arma).toBe('pistola');
  });
});

describe('disparo', () => {
  it('pistola acerta o inimigo à frente, gasta 1 bala e faz ruído', () => {
    const w = mundo();
    const alvo = porInimigo(w, 'funcionario', [6, 1]);
    const vida = alvo.vida;
    const ev = atirar(w, gatilho, dt);
    expect(ev.map((e) => e.tipo)).toEqual(expect.arrayContaining(['tiro', 'ruido', 'impacto']));
    expect(alvo.vida).toBeLessThan(vida);
    expect(w.jogador.municao.balas).toBe(49);
  });

  it('respeita a cadência e exige soltar o gatilho na pistola', () => {
    const w = mundo();
    atirar(w, gatilho, dt);
    for (let i = 0; i < 120; i++) atirar(w, gatilho, dt);
    expect(w.jogador.municao.balas).toBe(49);
    atirar(w, INPUT_VAZIO, dt);
    atirar(w, gatilho, dt);
    expect(w.jogador.municao.balas).toBe(48);
  });

  it('a smg é automática', () => {
    const w = mundo();
    w.jogador.arma = 'smg';
    for (let i = 0; i < 60; i++) atirar(w, gatilho, dt);
    const esperado = Math.floor(1 / ARMAS.smg.cadencia);
    expect(100 - w.jogador.municao.leves).toBeGreaterThanOrEqual(esperado - 1);
    expect(100 - w.jogador.municao.leves).toBeLessThanOrEqual(esperado + 1);
  });

  it('sem munição avisa e não dispara', () => {
    const w = mundo();
    w.jogador.arma = 'escopeta';
    w.jogador.municao.cartuchos = 0;
    expect(atirar(w, gatilho, dt)).toEqual([{ tipo: 'sem_municao' }]);
  });

  it('a escopeta causa mais dano de perto que de longe', () => {
    const perto = mundo();
    perto.jogador.arma = 'escopeta';
    const a = porInimigo(perto, 'reforcado_teste', [3, 1]);
    const va = a.vida;
    atirar(perto, gatilho, dt);
    const longe = mundo();
    longe.jogador.arma = 'escopeta';
    const b = porInimigo(longe, 'reforcado_teste', [9, 1]);
    const vb = b.vida;
    atirar(longe, gatilho, dt);
    expect(va - a.vida).toBeGreaterThan(vb - b.vida);
  });

  it('parede protege o inimigo', () => {
    const w = criarWorld(faseMinima('########\n#P.#...#\n########'));
    const alvo = porInimigo(w, 'funcionario', [5, 1]);
    const vida = alvo.vida;
    const ev = atirar(w, gatilho, dt);
    expect(alvo.vida).toBe(vida);
    expect(ev).toContainEqual(expect.objectContaining({ tipo: 'impacto', em: 'parede' }));
  });

  it('matar conta na estatística', () => {
    const w = mundo();
    const alvo = porInimigo(w, 'funcionario', [3, 1]);
    alvo.vida = 1;
    const ev = atirar(w, gatilho, dt);
    expect(ev).toContainEqual({ tipo: 'inimigo_morto', id: alvo.id });
    expect(alvo.modo).toBe('morto');
    expect(w.stats.mortos).toBe(1);
  });

  it('a reserva da pistola se recompõe até o mínimo', () => {
    const w = mundo();
    w.jogador.municao.balas = 0;
    for (let i = 0; i < Math.ceil((PISTOLA_RESERVA.intervalo * PISTOLA_RESERVA.minimo + 1) / dt); i++) atirar(w, INPUT_VAZIO, dt);
    expect(w.jogador.municao.balas).toBe(PISTOLA_RESERVA.minimo);
  });
});

describe('lançador', () => {
  it('o projétil explode, cria nuvem e a nuvem fere e deixa lento', () => {
    const w = mundo();
    w.jogador.arma = 'lancador';
    const alvo = porInimigo(w, 'reforcado_teste', [8, 1]);
    const vida = alvo.vida;
    expect(atirar(w, gatilho, dt).map((e) => e.tipo)).toContain('projetil');
    const tipos: string[] = [];
    for (let i = 0; i < 180 && w.nuvens.length === 0; i++) tipos.push(...avancarProjeteis(w, dt).map((e) => e.tipo));
    expect(tipos).toContain('explosao');
    expect(w.nuvens).toHaveLength(1);
    const depoisDaExplosao = alvo.vida;
    expect(depoisDaExplosao).toBeLessThan(vida);
    for (let i = 0; i < 60; i++) avancarNuvens(w, dt);
    expect(alvo.vida).toBeLessThan(depoisDaExplosao);
    expect(alvo.lento).toBeGreaterThan(0);
    for (let i = 0; i < Math.ceil(NUVEM.duracao / dt); i++) avancarNuvens(w, dt);
    expect(w.nuvens).toHaveLength(0);
  });
});

describe('correção 1', () => {
  it('trocar de arma não burla a cadência', () => {
    const w = mundo();
    w.jogador.arma = 'escopeta';
    atirar(w, gatilho, dt);
    expect(w.jogador.municao.cartuchos).toBe(19);
    trocarArma(w, { ...INPUT_VAZIO, arma: 'pistola' });
    trocarArma(w, { ...INPUT_VAZIO, arma: 'escopeta' });
    let i = 1;
    for (; i * dt < ARMAS.escopeta.cadencia - 1e-9; i++) {
      atirar(w, i % 2 ? gatilho : INPUT_VAZIO, dt);
      expect(w.jogador.municao.cartuchos).toBe(19);
    }
    for (; i * dt < ARMAS.escopeta.cadencia + 0.2; i++) atirar(w, i % 2 ? gatilho : INPUT_VAZIO, dt);
    expect(w.jogador.municao.cartuchos).toBe(18);
  });

  it('mira nivelada em piso plano dá o dano base (não é cabeça)', () => {
    const w = mundo();
    const alvo = porInimigo(w, 'reforcado_teste', [2, 1]);
    atirar(w, gatilho, dt);
    expect(alvo.vida).toBe(400 - ARMAS.pistola.dano);
  });

  it('tiro levemente ascendente na faixa da cabeça multiplica o dano', () => {
    const w = mundo();
    const alvo = porInimigo(w, 'reforcado_teste', [4, 1]);
    // olhos a 1,6 m; a 6 m o raio passa a ~1,71 m, dentro do décimo superior (1,62 a 1,8)
    w.jogador.pitch = Math.atan(0.11 / 6);
    atirar(w, gatilho, dt);
    expect(alvo.vida).toBe(400 - ARMAS.pistola.dano * CABECA.multiplicador);
  });

  it('mirando para baixo, o tiro para no chão antes do alvo', () => {
    const w = mundo();
    const alvo = porInimigo(w, 'reforcado_teste', [6, 1]);
    w.jogador.pitch = -0.25;
    const ev = atirar(w, gatilho, dt);
    expect(alvo.vida).toBe(400);
    expect(ev).toContainEqual(expect.objectContaining({ tipo: 'impacto', em: 'parede' }));
  });

  const clicarAntes = (antes: number) => {
    const w = mundo();
    atirar(w, gatilho, dt);
    atirar(w, INPUT_VAZIO, dt);
    while (w.jogador.espera > antes) atirar(w, INPUT_VAZIO, dt);
    atirar(w, gatilho, dt);
    atirar(w, INPUT_VAZIO, dt);
    let passos = 0;
    while (w.jogador.municao.balas === 49 && passos < 60) {
      atirar(w, INPUT_VAZIO, dt);
      passos++;
    }
    return { balas: w.jogador.municao.balas, passos };
  };

  it('clique pouco antes do fim da espera fica pendente e dispara quando ela acaba', () => {
    const r = clicarAntes(0.1);
    expect(r.balas).toBe(48);
    expect(r.passos).toBeLessThanOrEqual(Math.ceil(0.1 / dt) + 1);
  });

  it('clique muito antes do fim da espera se perde', () => {
    expect(TIRO_PENDENTE).toBeLessThan(0.25);
    expect(clicarAntes(0.25).balas).toBe(49);
  });

  it('a smg dá em média 1 / cadência tiros por segundo', () => {
    const w = mundo();
    w.jogador.arma = 'smg';
    // 1,9 s segurando: tiros em 0, c, 2c, ... < 1,9 s (quantizado pelo dt daria um a menos)
    for (let i = 0; i < 114; i++) atirar(w, gatilho, dt);
    expect(100 - w.jogador.municao.leves).toBe(Math.floor((114 * dt) / ARMAS.smg.cadencia) + 1);
  });

  it('acerta só o mais próximo de dois alvos na linha', () => {
    const w = mundo();
    const perto = porInimigo(w, 'reforcado_teste', [4, 1]);
    const longe = porInimigo(w, 'reforcado_teste', [7, 1]);
    atirar(w, gatilho, dt);
    expect(perto.vida).toBeLessThan(400);
    expect(longe.vida).toBe(400);
  });

  it('inimigo morto não bloqueia o tiro', () => {
    const w = mundo();
    const morto = porInimigo(w, 'reforcado_teste', [3, 1]);
    morto.modo = 'morto';
    const vivo = porInimigo(w, 'reforcado_teste', [6, 1]);
    atirar(w, gatilho, dt);
    expect(morto.vida).toBe(400);
    expect(vivo.vida).toBeLessThan(400);
  });

  it('é determinístico', () => {
    const rodar = () => {
      const w = mundo();
      w.jogador.arma = 'escopeta';
      const alvos = [porInimigo(w, 'reforcado_teste', [4, 1]), porInimigo(w, 'reforcado_teste', [7, 1])];
      for (let i = 0; i < 180; i++) {
        if (i === 90) trocarArma(w, { ...INPUT_VAZIO, arma: 'smg' });
        atirar(w, i % 3 ? gatilho : INPUT_VAZIO, dt);
      }
      return { vidas: alvos.map((a) => a.vida), semente: w.semente };
    };
    const a = rodar();
    expect(a.vidas.some((v) => v < 400)).toBe(true);
    expect(rodar()).toEqual(a);
  });

  it('a troca zera a rajada', () => {
    const w = mundo();
    w.jogador.arma = 'smg';
    for (let i = 0; i < 30; i++) atirar(w, gatilho, dt);
    expect(w.jogador.rajada).toBeGreaterThan(0);
    trocarArma(w, { ...INPUT_VAZIO, arma: 'pistola' });
    expect(w.jogador.rajada).toBe(0);
  });

  it('projétil de inimigo voa reto, sem gravidade nem explosão, e não fere inimigo', () => {
    const w = mundo();
    const alvo = porInimigo(w, 'reforcado_teste', [4, 1]);
    const vida = alvo.vida;
    const p = { id: 99, de: 'inimigo' as const, tipo: 'seguranca', pos: { x: 5, z: 3 }, y: 1.4, vel: { x: 11, z: 0 }, vy: 0, dano: 12, vida: 5 };
    w.projeteis.push(p);
    expect(avancarProjeteis(w, dt)).toEqual([]);
    expect(w.projeteis).toHaveLength(1);
    expect(w.projeteis[0].pos.x).toBeCloseTo(5 + 11 * dt, 6);
    expect(w.projeteis[0].y).toBe(1.4);
    expect(w.projeteis[0].vy).toBe(0);
    for (let k = 0; k < 30; k++) avancarProjeteis(w, dt);   // atravessa a célula do inimigo
    expect(alvo.vida).toBe(vida);
    expect(w.nuvens).toEqual([]);
  });
});

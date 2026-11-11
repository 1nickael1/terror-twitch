import { expect, it } from 'vitest';
import { avancarChefe096 } from '../../src/sim/ai/chefe096';
import { tipoDe } from '../../src/sim/ai/tipos';
import { CHEFE_096, JOGADOR } from '../../src/sim/balance';
import { centro } from '../../src/sim/grid';
import { PASSO, step } from '../../src/sim/step';
import { criarWorld, INPUT_VAZIO } from '../../src/sim/world';
import { faseComChefe } from './ajuda';

it('perde contato, procura a última posição conhecida e retoma a perseguição ao reencontrar', () => {
  const w = criarWorld(faseComChefe('######################\n#C..........D.....P..#\n######################', { em: 'C' }, { portas: [{ id: 'd', em: 'D' }], saida: [20, 1] }));
  const c = w.chefe!;
  if (c.tipo !== 'entidade096') throw new Error('chefe incorreto');
  const i = w.inimigos.find(i => i.id === c.inimigoId)!;
  c.fase = 'perseguicao'; w.portas[0].estado = 'aberta'; w.portas[0].abertura = 1;
  avancarChefe096(w, i, PASSO);
  const visto = { ...i.ultimoVisto! };
  w.portas[0].estado = 'fechada'; w.portas[0].abertura = 0;
  w.jogador.pos = centro([20, 1]);
  for (let k = 0; k < Math.ceil((CHEFE_096.perderDeVista + .1) / PASSO); k++) avancarChefe096(w, i, PASSO);
  expect(c.fase).toBe('procurando'); expect(i.modo).toBe('suspeita');
  expect(i.ultimoVisto).toEqual(visto); expect(i.alvo).toEqual(visto);
  expect(i.ultimoVisto).not.toEqual(w.jogador.pos);
  w.portas[0].estado = 'aberta'; w.portas[0].abertura = 1;
  const eventos = avancarChefe096(w, i, PASSO);
  expect(c.fase).toBe('perseguicao'); expect(i.semVer).toBe(0);
  expect(i.ultimoVisto).toEqual(w.jogador.pos);
  expect(eventos.some(e => e.tipo === 'chefe_desperta')).toBe(false);
});

it('o jogador supera médico e policial, mas o chefão ganha distância na corrida em linha reta', () => {
  expect(JOGADOR.velocidade).toBeGreaterThan(tipoDe('funcionario').velocidade);
  expect(JOGADOR.velocidade).toBeGreaterThan(tipoDe('seguranca').velocidade);
  expect(JOGADOR.velocidade).toBeLessThan(CHEFE_096.velocidadePerseguicao);
  const w = criarWorld(faseComChefe('########################################\n#C.......P.............................#\n########################################', { em: 'C' }, { saida: [38, 1], spawnYaw: -Math.PI / 2 }));
  const i = w.inimigos.find(i => i.id === w.chefe!.inimigoId)!;
  w.chefe!.fase = 'perseguicao';
  const antes = w.jogador.pos.x - i.pos.x;
  for (let k = 0; k < 120; k++) step(w, { ...INPUT_VAZIO, frente: 1 }, PASSO);
  expect(w.jogador.pos.x - i.pos.x).toBeLessThan(antes - 2);
});

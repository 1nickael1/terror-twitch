import { afterEach, expect, it, vi } from 'vitest';
import { Game } from '../../src/engine/Game';
import type { Engine } from '../../src/engine/Engine';
import type { LevelDef } from '../../src/sim/fase';
import { criarWorld } from '../../src/sim/world';
import { ESTANDE } from '../../src/levels/estande';

afterEach(() => vi.unstubAllGlobals());

it('entra pelo menu, reinicia alvos e itens, e sai sem gravar progresso', () => {
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const armazenamento = { getItem: () => null, setItem: vi.fn() };
  const e = {
    world: criarWorld(ESTANDE), on: () => () => {},
    carregarFase: vi.fn((f: LevelDef) => { e.world = criarWorld(f); }),
    descarregarFase: vi.fn(), mostrarArma: vi.fn(), pausar: vi.fn(),
    gesto: vi.fn(), pedirTrava: vi.fn(), soltarTrava: vi.fn(),
  };
  const g = new Game(e as unknown as Engine, armazenamento, () => {});
  g.comando({ c: 'estande' });
  expect(e.world.fase.id).toBe('estande');
  e.world.pickups[0].pego = true;
  e.world.inimigos[0].vida = 0;
  e.world.jogador.municao.balas = 0;
  g.comando({ c: 'pausar' });
  g.comando({ c: 'reiniciar_estande' });
  expect(e.world.pickups[0].pego).toBe(false);
  expect(e.world.inimigos[0].vida).toBe(500);
  expect(e.world.jogador.municao.balas).toBe(24);
  g.comando({ c: 'concluiu' });
  expect(g.estado.tela).toBe('jogando');
  g.comando({ c: 'pausar' });
  g.comando({ c: 'sair' });
  expect(g.estado.tela).toBe('titulo');
  expect(e.world.fase.id).toBe('fase1');
  expect(armazenamento.setItem).not.toHaveBeenCalled();
  g.dispose();
});

import { expect, it, vi } from 'vitest';
import { SomDaFase } from '../../src/audio/SomDaFase';
import type { AcervoSons } from '../../src/audio/AcervoSons';
import type { Mixer } from '../../src/audio/Mixer';
import { ESTANDE } from '../../src/levels/estande';
import { criarWorld } from '../../src/sim/world';

it('toca sirene e grito uma vez no acionamento e não repete nos quadros seguintes', () => {
  const sirene = vi.fn(), grito = vi.fn(), cancelarSirene = vi.fn();
  const sons = { obter: (n: string) => n === 'sireneCurta' ? sirene : grito, cancelarSirene, cancelarRecarga: vi.fn() };
  const ctx = { currentTime: 1, state: 'running', listener: { setPosition: vi.fn(), setOrientation: vi.fn() } };
  const mixer = { bancada: { ctx }, efeitos: {}, musica: {}, reservarLacos: vi.fn(), tocar: vi.fn() };
  const w = criarWorld(ESTANDE), audio = new SomDaFase(mixer as unknown as Mixer, ESTANDE, sons as unknown as AcervoSons);
  const ouvinte = { pos: w.jogador.pos, y: 1.6, yaw: 0 };
  w.alarme = true; w.sirene = 5;
  audio.sincronizar(w, [{ tipo: 'alarme', ligado: true }], ouvinte);
  expect(mixer.tocar.mock.calls.map(c => c[0])).toEqual([sirene, grito]);
  for (let i = 0; i < 300; i++) { ctx.currentTime += 1 / 60; audio.sincronizar(w, [], ouvinte); }
  expect(mixer.tocar).toHaveBeenCalledTimes(2);
  audio.sincronizar(w, [{ tipo: 'alarme', ligado: true }], ouvinte);
  expect(mixer.tocar).toHaveBeenCalledTimes(4);
  audio.sincronizar(w, [{ tipo: 'alarme', ligado: false }], ouvinte);
  expect(cancelarSirene).toHaveBeenCalledOnce();
  audio.dispose(); expect(cancelarSirene).toHaveBeenCalledTimes(2);
});

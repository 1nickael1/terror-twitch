import { describe, expect, it } from 'vitest';
import { PassosDoutor } from '../../src/audio/passosDoutor';
import { criarWorld } from '../../src/sim/world';
import { faseMinima, porInimigo } from '../sim/ajuda';

function mundo() {
  const w = criarWorld(faseMinima('##########\n#P.......#\n##########'));
  const i = porInimigo(w, 'funcionario', [2, 1]); i.modo = 'patrulha';
  return { w, i, passos: new PassosDoutor() };
}
describe('passos posicionais do doutor', () => {
  it('só emite passos após percorrer a distância da passada, sem repetição parado', () => {
    const { w, i, passos } = mundo(); passos.atualizar(w);
    i.pos.x += .4; expect(passos.atualizar(w)).toHaveLength(0);
    i.pos.x += .4; expect(passos.atualizar(w)).toEqual([{ som: 'doutorPasso', pos: i.pos, y: i.y + .08 }]);
    expect(passos.atualizar(w)).toHaveLength(0);
  });
  it('usa passada maior ao correr e não soa em morte, ataque ou teleporte', () => {
    const { w, i, passos } = mundo(); i.modo = 'perseguicao'; passos.atualizar(w);
    i.pos.x += 1; expect(passos.atualizar(w)).toHaveLength(0);
    i.pos.x += .4; expect(passos.atualizar(w)).toHaveLength(1);
    i.pos.x += 10; expect(passos.atualizar(w)).toHaveLength(0);
    i.modo = 'ataque'; i.pos.x += 1; expect(passos.atualizar(w)).toHaveLength(0);
    i.modo = 'morto'; i.pos.x += 1; expect(passos.atualizar(w)).toHaveLength(0);
  });
  it('reinicia ao restaurar o tempo de um checkpoint', () => {
    const { w, i, passos } = mundo(); w.t = 10; passos.atualizar(w);
    i.pos.x += .7; passos.atualizar(w);
    w.t = 3; i.pos.x += .2; expect(passos.atualizar(w)).toHaveLength(0);
  });
});

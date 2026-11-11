import { describe, expect, it } from 'vitest';
import { adicionarInimigo, avancarInimigos } from '../../src/sim/ai/comum';
import { moverEntreInimigos, separarInimigos } from '../../src/sim/ai/colisaoInimigos';
import { andar, recuar } from '../../src/sim/ai/movimento';
import { tipoDe } from '../../src/sim/ai/tipos';
import { criarWorld, type World } from '../../src/sim/world';
import { faseMinima, porInimigo } from './ajuda';

const sala = () => criarWorld(faseMinima('############\n#P.........#\n#..........#\n#..........#\n#..........#\n############'));
function separados(w: World) {
  for (let a = 0; a < w.inimigos.length; a++) for (let b = a + 1; b < w.inimigos.length; b++) {
    const i = w.inimigos[a], j = w.inimigos[b];
    expect(Math.hypot(i.pos.x - j.pos.x, i.pos.z - j.pos.z)).toBeGreaterThanOrEqual(tipoDe(i.tipo).raio + tipoDe(j.tipo).raio - .0001);
  }
}
describe('espaço físico entre inimigos', () => {
  it('impede dois inimigos de atravessarem um ao outro mesmo com passo grande', () => {
    const w = sala(), a = porInimigo(w, 'funcionario', [3, 2]), b = porInimigo(w, 'seguranca', [5, 2]);
    andar(w, a, b.pos, 50, 1); separados(w);
    expect(a.pos.x).toBeLessThan(b.pos.x);
    andar(w, b, { x: 3, z: b.pos.z }, 50, 1); separados(w);
    expect(a.pos.x).toBeLessThan(b.pos.x);
  });
  it('respeita o corpo de quem está atrás quando o policial recua', () => {
    const w = sala(), a = porInimigo(w, 'seguranca', [3, 2]), b = porInimigo(w, 'funcionario', [4, 2]);
    recuar(w, a, { x: a.pos.x - 2, z: a.pos.z }, 10, 1);
    separados(w); expect(a.pos.x).toBeLessThan(b.pos.x);
  });
  it('inclui a investida do chefe no bloqueio, usando o raio maior dele', () => {
    const w = sala(), a = porInimigo(w, 'entidade096', [3, 2]), b = porInimigo(w, 'seguranca', [5, 2]);
    a.pos = moverEntreInimigos(w, a, 10, 0); separados(w);
    expect(a.pos.x).toBeLessThan(b.pos.x);
  });
  it('separa grupos criados no mesmo ponto de forma determinística', () => {
    const montar = () => {
      const w = sala(); for (let n = 0; n < 8; n++) porInimigo(w, n % 2 ? 'seguranca' : 'funcionario', [5, 2]);
      separarInimigos(w); separados(w); return w.inimigos.map(i => i.pos);
    };
    expect(montar()).toEqual(montar());
  });
  it('separa sobreposição junto à parede sem empurrar ninguém para dentro dela', () => {
    const w = sala(), a = porInimigo(w, 'funcionario', [1, 2]), b = porInimigo(w, 'seguranca', [1, 2]);
    a.pos = { x: 2.35, z: 5 }; b.pos = { ...a.pos };
    separarInimigos(w); separados(w);
    for (const i of w.inimigos) expect(i.pos.x).toBeGreaterThanOrEqual(2 + tipoDe(i.tipo).raio - .0001);
  });
  it('aplica a separação imediatamente aos reforços nascidos em posição ocupada', () => {
    const w = sala(); adicionarInimigo(w, { tipo: 'seguranca', em: [3, 2] }); adicionarInimigo(w, { tipo: 'funcionario', em: [3, 2] }); separados(w);
  });
  it('não bloqueia passagem com cadáver ou com inimigo em outro andar', () => {
    const w = sala(), a = porInimigo(w, 'seguranca', [3, 2]), b = porInimigo(w, 'funcionario', [4, 2]);
    b.modo = 'morto'; b.vida = 0;
    const alvo = { ...b.pos }; andar(w, a, alvo, 10, 1); expect(a.pos.x).toBeCloseTo(alvo.x, 8); expect(a.pos.z).toBeCloseTo(alvo.z, 8);
    b.modo = 'patrulha'; b.vida = 40; b.y = 4;
    separarInimigos(w); expect(a.pos.x).toBeCloseTo(alvo.x, 8); expect(a.pos.z).toBeCloseTo(alvo.z, 8); expect(b.pos).toEqual(alvo);
  });
  it('mantém uma multidão sem sobreposição durante a perseguição', () => {
    const w = sala(); w.jogador.vida = 100000;
    for (let n = 0; n < 8; n++) { const i = porInimigo(w, 'funcionario', [3 + n % 4, 2 + Math.floor(n / 4)]); i.modo = 'perseguicao'; }
    for (let n = 0; n < 300; n++) { avancarInimigos(w, [], 1 / 60); separados(w); }
  });
});

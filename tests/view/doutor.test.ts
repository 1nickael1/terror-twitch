import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { Box3, Group, Vector3, type Object3D, type AnimationClip, type SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MaterialBank } from '../../src/engine/materials';
import { Recursos } from '../../src/engine/view/recursos';
import { InstanciaDoutor } from '../../src/engine/view/doutor';
import { animacaoDoDoutor, prepararAnimacoesDoutor } from '../../src/engine/view/doutorAnimacoes';
import type { AcervoDoutor } from '../../src/engine/view/doutor';
import { InimigosView } from '../../src/engine/view/inimigos';
import { criarWorld } from '../../src/sim/world';
import { faseMinima, porInimigo } from '../sim/ajuda';

let modelo: Object3D;
let originais: AnimationClip[];
let clips: AnimationClip[];
beforeAll(async () => {
  const b = await readFile('public/models/doutor/doutor.glb');
  const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  modelo = gltf.scene; originais = gltf.animations;
  clips = prepararAnimacoesDoutor(originais);
});

function instancia() {
  const bank = new MaterialBank();
  bank.define('doutor', { color: 0xffffff }); bank.define('doutor-dor', { color: 0xffffff });
  const rec = new Recursos(bank);
  const doutor = new InstanciaDoutor(modelo, clips, rec);
  return { doutor, rec, bank, dispose: () => { doutor.dispose(); rec.dispose(); bank.dispose(); } };
}
const mao = (d: InstanciaDoutor, lado: string) => {
  d.raiz.updateWorldMatrix(true, true);
  return d.modelo.getObjectByName(`mixamorig${lado}Hand`)!.getWorldPosition(new Vector3());
};

describe('doutor Meshy/Mixamo', () => {
  it('preserva sete animações e mantém o deslocamento no controle da simulação', () => {
    expect(originais).toHaveLength(7);
    expect(originais.map((c) => c.name)).toContain('Unsteady_Walk');
    expect(originais.map((c) => c.name)).toContain('Run_02');
    expect(clips.find((c) => c.name === 'Dano')!.duration).toBeLessThan(.7);
    for (const c of clips) for (const t of c.tracks.filter((t) => t.name === 'mixamorigHips.position')) {
      for (let i = 0; i < t.values.length; i += 3) { expect(t.values[i]).toBe(0); expect(t.values[i + 2]).toBe(0); }
    }
    expect(originais[0].tracks.find((t) => t.name === 'mixamorigHips.position')!.values[0]).not.toBe(0);
  });

  it('usa caminhada cambaleante e Corrida 2, inclusive ao desacelerar na perseguição', () => {
    expect(animacaoDoDoutor('patrulha', 1.5)).toBe('Unsteady_Walk');
    expect(animacaoDoDoutor('suspeita', 2)).toBe('Unsteady_Walk');
    expect(animacaoDoDoutor('perseguicao', 2)).toBe('Unsteady_Walk');
    expect(animacaoDoDoutor('perseguicao', 4.5)).toBe('Run_02');
    expect(animacaoDoDoutor('dormindo', 0)).toBe('Idle_02');
    expect(animacaoDoDoutor('morto', 0)).toBe('Dead');
  });

  it('normaliza para 1,8 m e clona os esqueletos sem duplicar a geometria', () => {
    const a = instancia(), b = instancia();
    expect(new Box3().setFromObject(a.doutor.raiz, true).getSize(new Vector3()).y).toBeCloseTo(1.8, 3);
    let ma!: SkinnedMesh, mb!: SkinnedMesh;
    a.doutor.modelo.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) ma = o as SkinnedMesh; });
    b.doutor.modelo.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) mb = o as SkinnedMesh; });
    expect(ma.geometry).toBe(mb.geometry); expect(ma.skeleton).not.toBe(mb.skeleton);
    let descartada = false; ma.geometry.addEventListener('dispose', () => { descartada = true; });
    a.dispose(); expect(descartada).toBe(false);
    b.doutor.animar({ modo: 'patrulha', timer: 0 }, 1.5, .016);
    expect(Number.isFinite(mao(b.doutor, 'Left').y)).toBe(true);
    b.dispose();
  });

  it('abre os braços na antecipação e fecha as mãos à frente com avanço do corpo', () => {
    const a = instancia();
    a.doutor.animar({ modo: 'ataque', timer: .35 * .65 }, 0, .016);
    const abertoE = mao(a.doutor, 'Left'), abertoD = mao(a.doutor, 'Right');
    a.doutor.animar({ modo: 'ataque', timer: 0 }, 0, .016);
    const fechadoE = mao(a.doutor, 'Left'), fechadoD = mao(a.doutor, 'Right');
    expect(Math.abs(fechadoE.x - fechadoD.x)).toBeLessThan(Math.abs(abertoE.x - abertoD.x) * .6);
    expect((fechadoE.z + fechadoD.z) / 2).toBeLessThan((abertoE.z + abertoD.z) / 2 - .2);
    // A animação visual não desloca o pivô usado pela IA/colisão.
    expect(a.doutor.raiz.position.toArray()).toEqual([0, 0, 0]);
    const antes = mao(a.doutor, 'Left');
    for (let n = 0; n < 30; n++) a.doutor.animar({ modo: 'ataque', timer: 0 }, 0, 0);
    expect(mao(a.doutor, 'Left').distanceTo(antes)).toBeLessThan(.0001);
    a.dispose();
  });

  it('termina a morte deitado e mantém a pose final', () => {
    const a = instancia();
    a.doutor.animar({ modo: 'patrulha', timer: 0 }, 0, .016);
    for (let i = 0; i < 210; i++) a.doutor.animar({ modo: 'morto', timer: 0 }, 0, 1 / 60);
    const caixa = new Box3().setFromObject(a.doutor.raiz, true);
    expect(caixa.getSize(new Vector3()).y).toBeLessThan(.75);
    expect(caixa.min.y).toBeGreaterThan(-.25);
    const fim = mao(a.doutor, 'Left');
    a.doutor.animar({ modo: 'morto', timer: 0 }, 0, .5);
    expect(mao(a.doutor, 'Left').distanceTo(fim)).toBeLessThan(.0001);
    a.dispose();
  });

  it('substitui o funcionário no runtime após carregar e sobrevive à reconstrução do checkpoint', () => {
    const bank = new MaterialBank();
    for (const slot of ['ini-corpo', 'ini-olho', 'ini-visor', 'ini-dor', 'doutor', 'doutor-dor']) bank.define(slot, { color: 0xffffff });
    const rec = new Recursos(bank), grupo = new Group();
    const acervo = { estado: 'carregando', criar: (r: Recursos) => new InstanciaDoutor(modelo, clips, r) };
    const view = new InimigosView(rec, grupo, acervo as unknown as AcervoDoutor);
    const w = criarWorld(faseMinima('########\n#P.....#\n########'));
    const i = porInimigo(w, 'funcionario', [3, 1]);
    view.sincronizar(w, [], 0, 1);
    const raiz = grupo.getObjectByName(`inimigo:${i.id}`)!;
    expect(raiz.children).toHaveLength(1);
    acervo.estado = 'pronto'; view.sincronizar(w, [], 0, 1);
    expect(raiz.children).toHaveLength(2);
    expect(raiz.children[0].visible).toBe(false);
    let skin!: SkinnedMesh;
    raiz.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) skin = o as SkinnedMesh; });
    expect(skin).toBeDefined();
    expect(raiz.position.x).toBe(i.pos.x);
    let geometriasDescartadas = 0;
    skin.geometry.addEventListener('dispose', () => { geometriasDescartadas++; });
    view.limpar(); view.sincronizar(w, [], 0, 1);
    expect(grupo.getObjectByName(`inimigo:${i.id}`)).toBeDefined();
    view.dispose(); rec.dispose(); bank.dispose();
    expect(geometriasDescartadas).toBe(0);
  });
});

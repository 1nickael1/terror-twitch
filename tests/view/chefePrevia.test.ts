import { readFile } from 'node:fs/promises';
import { beforeAll, expect, it, vi } from 'vitest';
import { Box3, Group, Vector3, type AnimationClip, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MaterialBank } from '../../src/engine/materials';
import { Recursos } from '../../src/engine/view/recursos';
import { InstanciaChefePrevia } from '../../src/engine/view/chefePrevia';
import { animacaoDoChefe, InstanciaChefe, type AcervoChefe } from '../../src/engine/view/chefe';
import { InimigosView } from '../../src/engine/view/inimigos';
import { faseComChefe } from '../sim/ajuda';
import { criarWorld, restaurarCheckpoint } from '../../src/sim/world';

let modelo: Object3D, clips: AnimationClip[];
beforeAll(async () => {
  const b = await readFile('public/models/chefe1/chefe1.glb');
  const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  modelo = gltf.scene; clips = gltf.animations;
});

function criar() {
  const bank = new MaterialBank(); bank.define('chefe1', { color: 0xffffff });
  const rec = new Recursos(bank), instancia = new InstanciaChefePrevia(modelo, clips, rec);
  return { instancia, dispose: () => { instancia.dispose(); rec.dispose(); bank.dispose(); } };
}

it('carrega o chefe real a 2,4 m e reproduz as sete animações sem ligações ausentes', () => {
  const a = criar();
  expect(new Box3().setFromObject(a.instancia.raiz, true).getSize(new Vector3()).y).toBeCloseTo(2.4, 3);
  expect(clips).toHaveLength(7);
  const warn = vi.spyOn(console, 'warn'), error = vi.spyOn(console, 'error');
  try {
    for (const clip of clips) {
      a.instancia.selecionar(clip.name, true, true);
      a.instancia.atualizar(.2, 1, false);
      const caixa = new Box3().setFromObject(a.instancia.raiz, true);
      expect(Number.isFinite(caixa.max.y)).toBe(true);
    }
    expect(warn).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  } finally { warn.mockRestore(); error.mockRestore(); a.dispose(); }
});

it('permite inspecionar qualquer quadro pausado e retomar na velocidade escolhida', () => {
  const a = criar(), clip = clips.find(c => c.name === 'Walking')!;
  a.instancia.selecionar(clip.name, true, true);
  expect(a.instancia.atualizar(0, 1, true, .5)).toBeCloseTo(.5);
  expect(a.instancia.atualizar(.3, 1, true)).toBeCloseTo(.5);
  expect(a.instancia.atualizar(.2, .5, false)).toBeCloseTo(.6);
  a.dispose();
});

it('mantém a pose final da queda sem loop e permite voltar a um quadro anterior', () => {
  const a = criar(), clip = clips.find(c => c.name === 'Strangled_and_Fall_Forward')!;
  a.instancia.selecionar(clip.name, false, true);
  expect(a.instancia.atualizar(clip.duration + 1, 1, false)).toBeCloseTo(clip.duration);
  const fim = new Box3().setFromObject(a.instancia.raiz, true);
  a.instancia.atualizar(2, 1, false);
  expect(new Box3().setFromObject(a.instancia.raiz, true).min.distanceTo(fim.min)).toBeLessThan(.0001);
  expect(a.instancia.atualizar(0, 1, true, .3)).toBeCloseTo(.3);
  a.dispose();
});

it('usa a investida na perseguição, Ataque B ao despertar e observação apenas na busca', () => {
  expect(animacaoDoChefe('perseguicao')).toBe('run_fast_2');
  expect(animacaoDoChefe('investida')).toBe('run_fast_2');
  expect(animacaoDoChefe('despertando')).toBe('Skill_01');
  expect(animacaoDoChefe('procurando')).toBe('Walking_Scan_with_Sudden_Look_Back');
  expect(animacaoDoChefe('inerte')).toBe('Walking');
  expect(animacaoDoChefe('perseguicao', true)).toBe('Right_Hand_Sword_Slash');
});

it('substitui o chefe na fase e recria a instância após restaurar o checkpoint', () => {
  const bank = new MaterialBank(), rec = new Recursos(bank), grupo = new Group();
  for (const slot of ['chefe1', 'ini-corpo', 'ini-olho', 'ini-visor', 'ini-dor']) bank.define(slot, {});
  const acervo = { estado: 'pronto', criar: (r: Recursos) => new InstanciaChefe(modelo, clips, r) };
  const w = criarWorld(faseComChefe('#########\n#P....C.#\n#########', { em: 'C' }, { saida: [7, 1] }));
  const view = new InimigosView(rec, grupo, undefined, undefined, acervo as unknown as AcervoChefe);
  view.sincronizar(w, [], 0);
  const primeira = grupo.getObjectByName('chefe-meshy')!;
  expect(primeira).toBeDefined();
  w.chefe!.fase = 'despertando'; w.chefe!.timer = 2.5; w.t += .1;
  view.sincronizar(w, [], .1);
  const mao = primeira.getObjectByName('mixamorigRightHand')!;
  const pose = mao.quaternion.clone();
  // A pausa da simulação deve congelar também a animação importada.
  view.sincronizar(w, [], .1);
  expect(mao.quaternion.angleTo(pose)).toBeLessThan(.0001);
  view.limpar(); restaurarCheckpoint(w); view.sincronizar(w, [], 0);
  expect(grupo.getObjectByName('chefe-meshy')).toBeDefined();
  expect(grupo.getObjectByName('chefe-meshy')).not.toBe(primeira);
  view.dispose(); rec.dispose(); bank.dispose();
});

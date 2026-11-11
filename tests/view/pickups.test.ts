import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { expect, it, vi } from 'vitest';
import { MaterialBank } from '../../src/engine/materials';
import { PickupsView } from '../../src/engine/view/pickups';
import { Recursos } from '../../src/engine/view/recursos';
import { ESTANDE } from '../../src/levels/estande';
import { criarWorld } from '../../src/sim/world';

function definirItens(bank: MaterialBank) {
  for (const slot of ['pk-balas', 'pk-cartuchos', 'pk-leves', 'pk-capsulas', 'pk-vida', 'pk-colete', 'pk-arma', 'nivel-1', 'nivel-2', 'nivel-3']) bank.define(slot, {});
}

it('mostra os quatro modelos com mapas do banco, sem descartar as geometrias compartilhadas ao sair da fase', () => {
  const bank = new MaterialBank(), rec = new Recursos(bank), raiz = new Group();
  definirItens(bank);
  const geo = new BoxGeometry(.1, .2, 2), mapa = new Texture();
  const original = new Group(), malha = new Mesh(geo); original.add(malha);
  malha.position.set(2, 3, 4);
  for (const slot of ['pistola-neon', 'escopeta-tactical', 'smg-sentinel', 'lancador-viper']) bank.define(slot, { map: mapa });
  const disposeGeo = vi.spyOn(geo, 'dispose'), disposeMapa = vi.spyOn(mapa, 'dispose');
  const w = criarWorld(ESTANDE);
  const view = new PickupsView(w, rec, raiz, { pistola: original, escopeta: original, smg: original, lancador: original });
  view.sincronizar(w, 0);
  for (const id of w.jogador.armas) {
    const modelo = raiz.getObjectByName(`pickup:arma:${id}`)!;
    expect(modelo).toBeDefined();
    let meshes = 0;
    modelo.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      meshes++;
      expect(m.geometry).toBe(geo);
      expect((m.material as MeshStandardMaterial).map).toBe(mapa);
      expect(m.castShadow && m.receiveShadow).toBe(true);
    });
    expect(meshes).toBe(1);
    const caixa = new Box3().setFromObject(modelo);
    expect(caixa.min.y).toBeGreaterThan(0);
    expect(caixa.getSize(new Vector3()).length()).toBeLessThan(1.2);
  }
  expect(original.children).toEqual([malha]);
  expect(malha.position.toArray()).toEqual([2, 3, 4]);
  rec.dispose();
  expect(disposeGeo).not.toHaveBeenCalled();
  expect(disposeMapa).not.toHaveBeenCalled();
  bank.dispose(); geo.dispose();
});

it('esconde a arma coletada e restaura sua visibilidade no reinício do estande', () => {
  const bank = new MaterialBank(), rec = new Recursos(bank), raiz = new Group();
  definirItens(bank);
  bank.define('pistola-neon', {});
  const original = new Group(); original.add(new Mesh(new BoxGeometry(.1, .2, .4)));
  const w = criarWorld(ESTANDE);
  const view = new PickupsView(w, rec, raiz, { pistola: original });
  w.pickups[0].pego = true;
  view.sincronizar(w, 2);
  const pistola = raiz.getObjectByName('pickup:arma:pistola')!;
  expect(pistola.visible).toBe(false);
  view.sincronizar(criarWorld(ESTANDE), 3);
  expect(pistola.visible).toBe(true);
  rec.dispose(); bank.dispose(); (original.children[0] as Mesh).geometry.dispose();
});

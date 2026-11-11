import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { beforeAll, expect, it, vi } from 'vitest';
import { Box3, Group, Mesh, Texture, Vector3, type MeshStandardMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MaterialBank } from '../../src/engine/materials';
import { Recursos } from '../../src/engine/view/recursos';
import { Coletor } from '../../src/engine/view/geometria';
import { PortasView } from '../../src/engine/view/portas';
import { criarVistaFechadura, normalizarFechadura, SLOT_FECHADURA, SLOT_FECHADURA_N2, SLOT_FECHADURA_N3 } from '../../src/engine/view/fechadura';
import { criarWorld, restaurarCheckpoint } from '../../src/sim/world';
import { avancarPortas, comandarPorta, usar } from '../../src/sim/doors';
import { centro } from '../../src/sim/grid';
import { ESTANDE } from '../../src/levels/estande';
import { faseMinima } from '../sim/ajuda';

let modelo: Object3D;
beforeAll(async () => {
  const dados = await readFile('public/models/fechadura-nivel1/fechadura.glb');
  const n = dados.readUInt32LE(12), json = JSON.parse(dados.subarray(20, 20 + n).toString());
  expect(json.meshes).toHaveLength(1);
  expect(json.materials.map((m: { name: string }) => m.name)).toEqual(['Fechadura_N1_Bloqueada', 'Fechadura_N1_Liberada', 'Fechadura_N2_Bloqueada', 'Fechadura_N2_Liberada', 'Fechadura_N3_Bloqueada', 'Fechadura_N3_Liberada']);
  expect(json.materials[1].emissiveTexture).toBeDefined();
  expect(json.extensions.KHR_materials_variants.variants).toEqual([{ name: 'nivel1-bloqueada' }, { name: 'nivel1-liberada' }, { name: 'nivel2-bloqueada' }, { name: 'nivel2-liberada' }, { name: 'nivel3-bloqueada' }, { name: 'nivel3-liberada' }]);
  // Carrega a malha real sem depender de decodificação de PNG no Node.
  json.materials = [{}, {}, {}, {}, {}, {}]; json.images = []; json.textures = []; json.extensionsUsed = []; json.extensions = {};
  dados.fill(0x20, 20, 20 + n); Buffer.from(JSON.stringify(json)).copy(dados, 20);
  const gltf = await new GLTFLoader().parseAsync(dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.byteLength), '');
  modelo = normalizarFechadura(gltf.scene);
});

function preparar(w = criarWorld(ESTANDE)) {
  const bank = new MaterialBank(), rec = new Recursos(bank), raiz = new Group();
  for (const slot of ['porta', 'nivel-1', 'nivel-2']) bank.define(slot, {});
  const mapa = new Texture(), emissao = new Texture();
  bank.define(SLOT_FECHADURA.bloqueada, { map: mapa });
  bank.define(SLOT_FECHADURA.liberada, { map: new Texture(), emissive: 0xffffff, emissiveMap: emissao, emissiveIntensity: 2 });
  bank.define(SLOT_FECHADURA_N2.bloqueada, { map: new Texture(), color: 0xff8800 });
  bank.define(SLOT_FECHADURA_N2.liberada, { map: new Texture(), color: 0xff8800, emissive: 0xffffff, emissiveMap: emissao, emissiveIntensity: 2 });
  bank.define(SLOT_FECHADURA_N3.bloqueada, { map: new Texture(), color: 0x8855bb });
  bank.define(SLOT_FECHADURA_N3.liberada, { map: new Texture(), color: 0x8855bb, emissive: 0xffffff, emissiveMap: emissao, emissiveIntensity: 2 });
  const view = new PortasView(w, rec, new Coletor(), raiz, { criarVista: (r, nivel) => criarVistaFechadura(modelo, r, nivel) });
  return { bank, rec, raiz, view, w, emissao };
}
const malha = (o: Object3D) => o.getObjectByProperty('isMesh', true) as Mesh;

it('embute no GLB as placas laranja e roxa e o LED verde, sem reutilizar imagens do nível 1', async () => {
  const b = await readFile('public/models/fechadura-nivel1/fechadura.glb');
  const n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n).toString());
  async function cor(material: number, left: number, top: number, width: number, height: number) {
    const tex = j.materials[material].pbrMetallicRoughness.baseColorTexture.index;
    const t = j.textures[tex];
    const imagem = j.images[t.source ?? t.extensions.EXT_texture_webp.source], v = j.bufferViews[imagem.bufferView];
    const inicio = 28 + n + (v.byteOffset ?? 0);
    const regiao = await sharp(b.subarray(inicio, inicio + v.byteLength)).extract({ left, top, width, height }).toBuffer();
    const stats = await sharp(regiao).stats();
    return stats.channels.slice(0, 3).map((c: { mean: number }) => c.mean);
  }
  const laranja = await cor(2, 1520, 1320, 80, 50), roxo = await cor(4, 1520, 1320, 80, 50);
  expect(laranja[0]).toBeGreaterThan(laranja[1] * 1.5);
  expect(roxo[2]).toBeGreaterThan(roxo[0] * 1.2);
  expect(roxo[0]).toBeGreaterThan(roxo[1] * 1.2);
  for (const material of [1, 3, 5]) {
    const led = await cor(material, 1630, 1900, 45, 18);
    expect(led[1]).toBeGreaterThan(led[0] * 2);
  }
});

it('normaliza a placa real para 42 cm e conserva a frente em +Z', () => {
  const caixa = new Box3().setFromObject(modelo), tam = caixa.getSize(new Vector3());
  expect(tam.y).toBeCloseTo(.42);
  expect(tam.z).toBeLessThan(.08);
  expect(caixa.getCenter(new Vector3()).length()).toBeLessThan(.0001);
});

it('troca só o material ao destrancar, mantém verde ao fechar e restaura a tranca no checkpoint', () => {
  const { w, bank, rec, raiz, view, emissao } = preparar();
  const frente = raiz.getObjectByName('fechadura:porta-teste:-1')!;
  const verso = raiz.getObjectByName('fechadura:porta-teste:1')!;
  expect(frente).toBeDefined(); expect(verso).toBeDefined();
  const mesh = malha(frente), geo = mesh.geometry, pos = frente.position.clone();
  const liberarGeo = vi.spyOn(geo, 'dispose');
  const bloqueado = mesh.material;
  w.jogador.pos = centro([13, 19]); w.jogador.yaw = Math.PI;
  usar(w); view.sincronizar(w); expect(mesh.material).toBe(bloqueado);
  w.jogador.cartoes = [1]; view.sincronizar(w); expect(mesh.material).toBe(bloqueado);
  usar(w); view.sincronizar(w);
  expect((mesh.material as MeshStandardMaterial).emissiveMap).toBe(emissao);
  expect(malha(verso).material).toBe(mesh.material);
  avancarPortas(w, 2); usar(w); avancarPortas(w, 2); view.sincronizar(w);
  expect(w.portas[0].estado).toBe('fechada');
  expect((mesh.material as MeshStandardMaterial).emissiveMap).toBe(emissao);
  expect(frente.position).toEqual(pos); expect(mesh.geometry).toBe(geo);
  bank.setKind('lambert');
  expect((mesh.material as MeshStandardMaterial).emissiveMap).toBe(emissao);
  comandarPorta(w, 'porta-teste', 'trancar'); view.sincronizar(w);
  expect((mesh.material as MeshStandardMaterial).emissiveMap).toBeNull();
  restaurarCheckpoint(w); view.sincronizar(w);
  expect(raiz.getObjectByName('fechadura:porta-teste:-1')).toBe(frente);
  expect(w.portas[0].estado).toBe('trancada');
  rec.dispose(); expect(liberarGeo).not.toHaveBeenCalled(); bank.dispose();
});

it('orienta os leitores dos dois níveis nos dois lados de corredores em X', () => {
  const w = criarWorld(faseMinima('########\n#P.D.E.#\n########', {
    portas: [{ id: 'n1', em: 'D', exige: 1, trancada: true }, { id: 'n2', em: 'E', exige: 2, trancada: true }],
  }));
  const { raiz, bank, rec, view } = preparar(w);
  expect(raiz.children.filter(o => o.name.startsWith('fechadura:'))).toHaveLength(4);
  for (const face of [-1, 1]) {
    const obj = raiz.getObjectByName(`fechadura:n1:${face}`)!;
    expect(new Vector3(0, 0, 1).applyQuaternion(obj.quaternion).x).toBeCloseTo(face);
  }
  const n2 = malha(raiz.getObjectByName('fechadura:n2:-1')!);
  expect((n2.material as MeshStandardMaterial).color.getHex()).toBe(0xff8800);
  w.jogador.pos = centro([4, 1]); w.jogador.yaw = -Math.PI / 2;
  w.jogador.cartoes = [1]; usar(w);
  expect(w.portas[1].estado).toBe('trancada');
  w.jogador.cartoes = [2]; usar(w);
  expect(w.portas[1].estado).toBe('abrindo');
  view.sincronizar(w);
  expect((n2.material as MeshStandardMaterial).emissiveMap).not.toBeNull();
  avancarPortas(w, 2); usar(w); avancarPortas(w, 2); view.sincronizar(w);
  expect((n2.material as MeshStandardMaterial).emissiveMap).not.toBeNull();
  rec.dispose(); bank.dispose();
});

it('mostra a placa roxa na porta de nível 3 e muda o mesmo objeto para liberado com cartão 3', () => {
  const { w, raiz, rec, bank, view, emissao } = preparar();
  const p = w.portas.find(p => p.exige === 3)!;
  const grupo = raiz.getObjectByName(`fechadura:${p.id}:-1`)!;
  const mesh = malha(grupo), geo = mesh.geometry;
  expect((mesh.material as MeshStandardMaterial).color.getHex()).toBe(0x8855bb);
  w.jogador.pos = centro([p.coord[0], p.coord[1] - 1]); w.jogador.yaw = Math.PI;
  w.jogador.cartoes = [2]; usar(w); view.sincronizar(w);
  expect((mesh.material as MeshStandardMaterial).emissiveMap).toBeNull();
  w.jogador.cartoes = [3]; usar(w); view.sincronizar(w);
  expect((mesh.material as MeshStandardMaterial).emissiveMap).toBe(emissao);
  expect(mesh.geometry).toBe(geo);
  avancarPortas(w, 2); usar(w); avancarPortas(w, 2); view.sincronizar(w);
  expect((mesh.material as MeshStandardMaterial).emissiveMap).toBe(emissao);
  rec.dispose(); bank.dispose();
});

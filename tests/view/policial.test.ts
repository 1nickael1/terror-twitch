import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AnimationClip, Box3, Group, Quaternion, Vector3, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MaterialBank } from '../../src/engine/materials';
import { Recursos } from '../../src/engine/view/recursos';
import { InstanciaPolicial, type AcervoPolicial } from '../../src/engine/view/policial';
import { normalizarFuzil } from '../../src/engine/view/acervoArmaPolicial';
import { animacaoDoPolicial, CLIPE_CAMINHADA_ARCO, CLIPE_MIRA_ARCO, CLIPE_RECUO_POLICIAL, movimentoParaTras, prepararAnimacoesPolicial } from '../../src/engine/view/policialAnimacoes';
import { avancarInimigos } from '../../src/sim/ai/comum';
import { InimigosView } from '../../src/engine/view/inimigos';
import { criarWorld } from '../../src/sim/world';
import { faseMinima, porInimigo } from '../sim/ajuda';

let modelo: Object3D, fuzil: Group, originais: AnimationClip[], clips: AnimationClip[];
beforeAll(async () => {
  const b = await readFile('public/models/policial/policial.glb');
  const g = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  modelo = g.scene; originais = g.animations;
  const recuo = AnimationClip.parse(JSON.parse(await readFile('public/models/policial/recuo.json', 'utf8')));
  clips = prepararAnimacoesPolicial([...originais, recuo]);
  // O Node não decodifica imagens de navegador; só remove materiais da cópia em memória.
  const arma = await readFile('public/models/arma-policial/fuzil.glb');
  const comprimento = arma.readUInt32LE(12);
  const json = JSON.parse(arma.subarray(20, 20 + comprimento).toString());
  expect(json.images).toHaveLength(3);
  expect(json.images.every((i: { mimeType: string }) => i.mimeType === 'image/webp')).toBe(true);
  json.materials = [{}]; json.images = []; json.textures = []; json.extensionsUsed = []; json.extensionsRequired = [];
  const dados = Buffer.from(JSON.stringify(json)); arma.fill(0x20, 20, 20 + comprimento); dados.copy(arma, 20);
  const asset = await new GLTFLoader().parseAsync(arma.buffer.slice(arma.byteOffset, arma.byteOffset + arma.byteLength), '');
  fuzil = normalizarFuzil(asset.scene);
});
function recursos() {
  const bank = new MaterialBank();
  for (const slot of ['policial', 'policial-dor', 'policial-fuzil', 'arma', 'arma-detalhe', 'arma-cabo', 'ini-corpo', 'ini-olho', 'ini-visor', 'ini-dor']) bank.define(slot, { color: 0xffffff });
  return { bank, rec: new Recursos(bank) };
}
function instancia() {
  const { bank, rec } = recursos(); const p = new InstanciaPolicial(modelo, clips, rec, fuzil);
  return { p, dispose: () => { p.dispose(); rec.dispose(); bank.dispose(); } };
}

describe('policial animado com fuzil Meshy', () => {
  it('mantém os pés imóveis e apoiados durante todo o tiro parado', () => {
    const a = instancia();
    let base: Vector3[] | undefined;
    for (let n = 0; n <= 60; n++) {
      a.p.animar({ modo: 'ataque', timer: 0 }, 0, 0, 'TiroParado', n / 60);
      a.p.raiz.updateMatrixWorld(true);
      const pes = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map(osso => a.p.modelo.getObjectByName(`mixamorig${osso}`)!.getWorldPosition(new Vector3()));
      base ??= pes;
      for (let i = 0; i < pes.length; i++) expect(pes[i].distanceTo(base[i])).toBeLessThan(.0001);
    }
    const caixa = new Box3().setFromObject(a.p.raiz, true);
    expect(caixa.min.y).toBeGreaterThan(-.05); expect(caixa.min.y).toBeLessThan(.04);
    a.dispose();
  });

  it.each([CLIPE_MIRA_ARCO, CLIPE_CAMINHADA_ARCO, CLIPE_RECUO_POLICIAL])('adapta %s com apoio na mão esquerda e sem atravessar a cabeça', nome => {
    const a = instancia();
    for (let n = 0; n <= 60; n++) {
      a.p.animar({ modo: 'patrulha', timer: 0 }, 1.5, 0, nome, n / 60);
      a.p.raiz.updateMatrixWorld(true);
      const palma = a.p.modelo.getObjectByName('mixamorigLeftHand')!.localToWorld(new Vector3(0, .1, 0));
      expect(palma.distanceTo(a.p.arma.apoio.getWorldPosition(new Vector3()))).toBeLessThan(.07);
      const cabeca = a.p.modelo.getObjectByName('mixamorigHead')!.localToWorld(new Vector3(0, .1, 0));
      const arma = a.p.arma.grupo.getObjectByName('output_unwrapped') as Mesh;
      const posicoes = arma.geometry.attributes.position;
      let distancia = Infinity;
      for (let v = 0; v < posicoes.count; v++) distancia = Math.min(distancia, new Vector3().fromBufferAttribute(posicoes, v).applyMatrix4(arma.matrixWorld).distanceTo(cabeca));
      expect(distancia).toBeGreaterThan(.14);
      const eixo = new Vector3(0, 0, 1).applyQuaternion(a.p.arma.grupo.getWorldQuaternion(new Quaternion()));
      if (nome !== CLIPE_MIRA_ARCO) expect(eixo.z).toBeLessThan(-.75);
    }
    a.dispose();
  });
  it('usa recuo enquanto se afasta, inclusive com tiro disponível, e distingue movimento lateral', () => {
    expect(animacaoDoPolicial('perseguicao', 1.5, false, true, true)).toBe(CLIPE_RECUO_POLICIAL);
    expect(animacaoDoPolicial('perseguicao', 1.5, true, true, true)).toBe(CLIPE_RECUO_POLICIAL);
    expect(animacaoDoPolicial('perseguicao', 0, false, true, true)).toBe('Mira');
    expect(animacaoDoPolicial('morto', 1.5, true, true, true)).toBe('Dead');
    expect(animacaoDoPolicial('dor', 1.5, true, true, true)).toBe('Dano');
    expect(movimentoParaTras(0, .1, 0)).toBe(true);
    expect(movimentoParaTras(0, -.1, 0)).toBe(false);
    expect(movimentoParaTras(.1, 0, 0)).toBe(false);
    expect(movimentoParaTras(0, 0, 0)).toBe(false);
    expect(movimentoParaTras(.1, 0, Math.PI / 2)).toBe(true);
  });
  it('recebe o recuo real da IA e ignora teleporte no controlador visual', () => {
    const { bank, rec } = recursos(), grupo = new Group();
    const acervo = { estado: 'pronto', criar: (r: Recursos) => new InstanciaPolicial(modelo, clips, r, fuzil) };
    const view = new InimigosView(rec, grupo, undefined, acervo as unknown as AcervoPolicial);
    const espia = vi.spyOn(InstanciaPolicial.prototype, 'animar');
    try {
      const w = criarWorld(faseMinima('########\n#P.....#\n########'));
      const i = porInimigo(w, 'seguranca', [3, 1]); i.modo = 'perseguicao'; i.espera = 1;
      view.sincronizar(w, [], 0, 1);
      const antes = { ...i.pos };
      avancarInimigos(w, [], .1); w.t += .1; view.sincronizar(w, [], .1, 1);
      expect(i.pos.x).toBeGreaterThan(antes.x);
      expect(espia.mock.calls.at(-1)?.[6]).toBe(true);
      i.pos.x += 2; w.t += .1; view.sincronizar(w, [], .1, 1);
      expect(espia.mock.calls.at(-1)?.[6]).toBe(false);
    } finally { espia.mockRestore(); view.dispose(); rec.dispose(); bank.dispose(); }
  });
  it('faz tronco e rifle acompanharem o giro do quadril durante a mira lateral', () => {
    const a = instancia(), clipe = clips.find(c => c.name === CLIPE_MIRA_ARCO)!;
    const avaliar = (progresso: number) => {
      a.p.animar({ modo: 'ataque', timer: 0 }, 0, 0, CLIPE_MIRA_ARCO, progresso);
      a.p.raiz.updateMatrixWorld(true);
      return {
        quadril: a.p.modelo.getObjectByName('mixamorigHips')!.getWorldQuaternion(new Quaternion()),
        tronco: a.p.modelo.getObjectByName('mixamorigSpine2')!.getWorldQuaternion(new Quaternion()),
        rifle: a.p.arma.grupo.getWorldQuaternion(new Quaternion()),
      };
    };
    const referencia = avaliar(.65 / clipe.duration);
    let giroQuadril = 0, giroRifle = 0;
    for (let n = 0; n <= 100; n++) {
      const atual = avaliar(n / 100);
      const delta = atual.quadril.clone().multiply(referencia.quadril.clone().invert());
      giroQuadril = Math.max(giroQuadril, atual.quadril.angleTo(referencia.quadril));
      giroRifle = Math.max(giroRifle, atual.rifle.angleTo(referencia.rifle));
      expect(delta.clone().multiply(referencia.tronco).angleTo(atual.tronco)).toBeLessThan(.17);
      expect(delta.clone().multiply(referencia.rifle).angleTo(atual.rifle)).toBeLessThan(.17);
    }
    expect(giroQuadril).toBeGreaterThan(.9); expect(giroRifle).toBeGreaterThan(.75);
    a.dispose();
  });
  it('normaliza o fuzil para 88 cm, compartilha a geometria e a preserva ao remover um NPC', () => {
    expect(new Box3().setFromObject(fuzil).getSize(new Vector3()).z).toBeCloseTo(.88, 3);
    const a = instancia(), b = instancia();
    const ma = a.p.arma.grupo.getObjectByName('output_unwrapped') as Mesh;
    const mb = b.p.arma.grupo.getObjectByName('output_unwrapped') as Mesh;
    expect(ma.geometry).toBe(mb.geometry);
    let descartada = false; ma.geometry.addEventListener('dispose', () => { descartada = true; });
    a.dispose(); expect(descartada).toBe(false);
    expect(b.p.arma.grupo.name).toBe('policial:fuzil-olive-drab'); b.dispose();
  });
  it('preserva os sete clipes e remove apenas o deslocamento horizontal do esqueleto', () => {
    expect(originais).toHaveLength(7);
    expect(clips.map(c => c.name)).toEqual(expect.arrayContaining([...originais.map(c => c.name), 'Mira', 'TiroParado', 'Dano']));
    for (const c of clips) for (const t of c.tracks.filter(t => t.name === 'mixamorigHips.position')) {
      for (let n = 0; n < t.values.length; n += 3) { expect(t.values[n]).toBe(0); expect(t.values[n + 2]).toBe(0); }
    }
    expect(animacaoDoPolicial('ataque', 0, false)).toBe(CLIPE_MIRA_ARCO);
    expect(animacaoDoPolicial('patrulha', 1.5, false)).toBe(CLIPE_CAMINHADA_ARCO);
    expect(animacaoDoPolicial('perseguicao', 0, true)).toBe('TiroParado');
    expect(animacaoDoPolicial('perseguicao', 2, true)).toBe('Walk_Forward_While_Shooting');
    expect(animacaoDoPolicial('perseguicao', 3.2, false)).toBe(CLIPE_CAMINHADA_ARCO);
    expect(animacaoDoPolicial('perseguicao', 3.2, false, true)).toBe('Walk_Forward_While_Shooting');
    expect(animacaoDoPolicial('perseguicao', 0, false, true)).toBe('Mira');
    expect(animacaoDoPolicial('patrulha', 1.5, false, true)).toBe(CLIPE_CAMINHADA_ARCO);
    expect(animacaoDoPolicial('dor', 1.5, true, true)).toBe('Dano');
    expect(animacaoDoPolicial('morto', 0, true)).toBe('Dead');
  });

  it('acompanha a mão direita e mantém o apoio esquerdo próximo ao guarda-mão em todo o tiro', () => {
    const a = instancia();
    expect(a.p.arma.grupo.parent?.name).toBe('mixamorigRightHand');
    const local = a.p.arma.grupo.quaternion.clone();
    for (let n = 0; n <= 40; n++) {
      a.p.animar({ modo: 'patrulha', timer: 0 }, 1.5, 0, 'Walk_Forward_While_Shooting', n / 40);
      a.p.raiz.updateMatrixWorld(true);
      const palma = a.p.modelo.getObjectByName('mixamorigLeftHand')!.localToWorld(new Vector3(0, .1, 0));
      const apoio = a.p.arma.apoio.getWorldPosition(new Vector3());
      expect(palma.distanceTo(apoio)).toBeLessThan(.13);
      expect(a.p.arma.grupo.quaternion.angleTo(local)).toBeLessThan(.00001);
      expect(a.p.raiz.position.toArray()).toEqual([0, 0, 0]);
      const direcao = new Vector3(0, 0, 1).applyQuaternion(a.p.arma.grupo.getWorldQuaternion(new Quaternion()));
      expect(direcao.z).toBeLessThan(-.8);
    }
    a.dispose();
  });

  it('só exibe clarão após disparar, respeita pausa e redução de flashes', () => {
    const a = instancia(); const i = { modo: 'ataque' as const, timer: .5 };
    a.p.animar({ modo: 'perseguicao', timer: 0 }, 1.5, .016, undefined, undefined, true);
    expect(a.p.arma.clarao.visible).toBe(false);
    a.p.animar(i, 0, .016); expect(a.p.arma.clarao.visible).toBe(false);
    a.p.disparar(); expect(a.p.arma.clarao.visible).toBe(true);
    a.p.animar(i, 0, 0); expect(a.p.arma.clarao.visible).toBe(true);
    a.p.animar(i, 0, .1); expect(a.p.arma.clarao.visible).toBe(false);
    a.p.configurar(true); a.p.disparar(); expect(a.p.arma.clarao.visible).toBe(false);
    a.dispose();
  });

  it('substitui o segurança e sincroniza o clarão somente com o autor do projétil', () => {
    const { bank, rec } = recursos(); const grupo = new Group();
    const acervo = { estado: 'pronto', criar: (r: Recursos) => new InstanciaPolicial(modelo, clips, r, fuzil) };
    const view = new InimigosView(rec, grupo, undefined, acervo as unknown as AcervoPolicial);
    const w = criarWorld(faseMinima('########\n#P.....#\n########'));
    const a = porInimigo(w, 'seguranca', [3, 1]), b = porInimigo(w, 'seguranca', [5, 1]);
    view.sincronizar(w, [], 0, 1);
    const ra = grupo.getObjectByName(`inimigo:${a.id}`)!, rb = grupo.getObjectByName(`inimigo:${b.id}`)!;
    expect(ra.children[0].visible).toBe(false);
    const clarao = (r: Object3D) => r.getObjectByName('policial:cano')!.children[0].visible;
    view.sincronizar(w, [{ tipo: 'inimigo_ataque', id: a.id }], 0, 1); expect(clarao(ra)).toBe(false);
    view.sincronizar(w, [{ tipo: 'projetil', id: 999, inimigoId: a.id }], 0, 1);
    expect(clarao(ra)).toBe(true); expect(clarao(rb)).toBe(false);
    view.limpar(); view.sincronizar(w, [], 0, 1);
    expect(grupo.getObjectByName(`inimigo:${a.id}`)).toBeDefined();
    view.dispose(); rec.dispose(); bank.dispose();
  });
});


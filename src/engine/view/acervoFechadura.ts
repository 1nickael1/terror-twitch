import { type BufferGeometry, type Group, type Mesh, type MeshStandardMaterial, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CarregamentoAssets } from '../carregamentoAssets';
import type { MaterialBank } from '../materials';
import { criarVistaFechadura, normalizarFechadura, SLOT_FECHADURA, SLOT_FECHADURA_N2, SLOT_FECHADURA_N3, type ModelosFechadura, type VistaFechadura } from './fechadura';
import type { Recursos } from './recursos';

/** Um GLB, uma malha e seis materiais: três níveis com acesso bloqueado ou liberado. */
export class AcervoFechadura implements ModelosFechadura {
  readonly pronto: Promise<void>;
  private modelo: Group | null = null;
  private descartado = false;
  private readonly geometrias = new Set<BufferGeometry>();

  constructor(private readonly bank: MaterialBank, private readonly anisotropia: number, carregamento: CarregamentoAssets) {
    this.pronto = this.carregar();
    carregamento.acompanhar('Fechaduras níveis 1, 2 e 3 · seis estados', this.pronto.then(() => this.modelo !== null));
  }

  private async carregar(): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync('/models/fechadura-nivel1/fechadura.glb?v=3');
    const materiais = await gltf.parser.getDependencies('material') as MeshStandardMaterial[];
    const mapas = new Set<Texture>();
    gltf.scene.traverse(o => { const m = o as Mesh; if (m.isMesh) this.geometrias.add(m.geometry); });
    for (const mat of materiais) for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.emissiveMap]) if (t) mapas.add(t);
    if (this.descartado) {
      for (const g of this.geometrias) g.dispose(); this.geometrias.clear();
      for (const t of mapas) t.dispose();
      for (const m of materiais) m.dispose();
      return;
    }
    for (const t of mapas) t.anisotropy = this.anisotropia;
    const estados = [
      [SLOT_FECHADURA.bloqueada, 'Fechadura_N1_Bloqueada'], [SLOT_FECHADURA.liberada, 'Fechadura_N1_Liberada'],
      [SLOT_FECHADURA_N2.bloqueada, 'Fechadura_N2_Bloqueada'], [SLOT_FECHADURA_N2.liberada, 'Fechadura_N2_Liberada'],
      [SLOT_FECHADURA_N3.bloqueada, 'Fechadura_N3_Bloqueada'], [SLOT_FECHADURA_N3.liberada, 'Fechadura_N3_Liberada'],
    ] as const;
    for (const [slot, nome] of estados) {
      const mat = materiais.find(m => m.name === nome);
      if (!mat) throw new Error(`Fechadura sem material: ${nome}`);
      this.bank.define(slot, {
        color: mat.color.getHex(), map: mat.map ?? undefined,
        normalMap: mat.normalMap ?? undefined, normalScale: mat.normalScale.clone(),
        roughnessMap: mat.roughnessMap ?? undefined, metalnessMap: mat.metalnessMap ?? undefined,
        roughness: mat.roughness, metalness: mat.metalness,
        emissive: mat.emissive.getHex(), emissiveMap: mat.emissiveMap ?? undefined,
        emissiveIntensity: mat.emissiveIntensity, ladoDuplo: true,
      });
    }
    this.modelo = normalizarFechadura(gltf.scene);
    for (const m of materiais) m.dispose();
  }

  criarVista(rec: Recursos, nivel: 1 | 2 | 3 = 1): VistaFechadura {
    if (!this.modelo) throw new Error('Fechadura ainda não carregada.');
    return criarVistaFechadura(this.modelo, rec, nivel);
  }

  dispose(): void {
    this.descartado = true;
    for (const g of this.geometrias) g.dispose();
    this.geometrias.clear(); this.modelo = null;
  }
}

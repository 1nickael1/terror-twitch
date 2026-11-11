import { type Group, type Mesh, type MeshStandardMaterial, type Object3D, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CarregamentoAssets } from '../carregamentoAssets';
import type { MaterialBank } from '../materials';

/** Recursos das armas importadas vivem com a engine e são compartilhados entre fases. */
export class AcervoArmaJogador {
  readonly pronto: Promise<void>;
  modelo: Group | null = null;
  private descartado = false;
  constructor(private readonly config: { id: string; slot: string; nome: string; normalizar: (o: Object3D) => Group },
    private readonly bank: MaterialBank, private readonly anisotropia: number, carregamento: CarregamentoAssets) {
    this.pronto = this.carregar();
    carregamento.acompanhar(config.nome, this.pronto.then(() => this.modelo !== null));
  }
  private async carregar(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync(`/models/${this.config.id}/${this.config.id}.glb`);
      if (this.descartado) { this.descartar(gltf.scene, true); return; }
      gltf.scene.traverse(o => {
        const m = o as Mesh; if (!m.isMesh) return;
        const materiais = Array.isArray(m.material) ? m.material : [m.material];
        const mat = materiais[0] as MeshStandardMaterial;
        for (const t of [mat.map, mat.normalMap, mat.metalnessMap, mat.roughnessMap]) if (t) t.anisotropy = this.anisotropia;
        this.bank.define(this.config.slot, { color: mat.color.getHex(), map: mat.map ?? undefined,
          emissive: 0xffffff, emissiveMap: mat.map ?? undefined, emissiveIntensity: .12,
          normalMap: mat.normalMap ?? undefined, normalScale: mat.normalScale.clone(),
          roughnessMap: mat.roughnessMap ?? undefined, metalnessMap: mat.metalnessMap ?? undefined,
          roughness: mat.roughness, metalness: mat.metalness, ladoDuplo: true });
        for (const material of materiais) material.dispose();
      });
      this.modelo = this.config.normalizar(gltf.scene);
    } catch (erro) {
      if (!this.descartado) console.warn(`Não foi possível carregar ${this.config.nome}.`, erro);
    }
  }
  private descartar(modelo: Object3D, texturas: boolean): void {
    const mapas = new Set<Texture>();
    modelo.traverse(o => {
      const m = o as Mesh; if (!m.isMesh) return;
      m.geometry.dispose();
      if (texturas) for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as MeshStandardMaterial[]) {
        for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap]) if (t) mapas.add(t);
        mat.dispose();
      }
    });
    for (const t of mapas) t.dispose();
  }
  dispose(): void { this.descartado = true; if (this.modelo) this.descartar(this.modelo, false); this.modelo = null; }
}

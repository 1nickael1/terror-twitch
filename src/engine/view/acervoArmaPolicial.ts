import { Group, type Mesh, type MeshStandardMaterial, type Object3D, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MaterialBank } from '../materials';
import type { CarregamentoAssets } from '../carregamentoAssets';

/** Converte o eixo -X do Meshy para +Z; a origem passa a ser a empunhadura. */
export function normalizarFuzil(modelo: Object3D): Group {
  const raiz = new Group(); raiz.name = 'policial:fuzil-olive-drab';
  const eixo = new Group(); eixo.rotation.y = Math.PI / 2; eixo.scale.setScalar(.88 / 1.903427124);
  const copia = modelo.clone(true); copia.position.set(-.35, .10, 0);
  eixo.add(copia); raiz.add(eixo); return raiz;
}

export class AcervoArmaPolicial {
  readonly pronto: Promise<void>;
  modelo: Group | null = null;
  private descartado = false;
  constructor(private readonly bank: MaterialBank, private readonly anisotropia: number, carregamento?: CarregamentoAssets) {
    this.pronto = this.carregar();
    carregamento?.acompanhar('Fuzil do policial', this.pronto.then(() => this.modelo !== null));
  }
  private async carregar(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync('/models/arma-policial/fuzil.glb');
      if (this.descartado) { this.descartar(gltf.scene, true); return; }
      gltf.scene.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const materiais = Array.isArray(m.material) ? m.material : [m.material];
        // Este asset tem um material PBR; não retinta o verde do albedo.
        const mat = materiais[0] as MeshStandardMaterial;
        for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap]) if (t) t.anisotropy = this.anisotropia;
        this.bank.define('policial-fuzil', { color: mat.color.getHex(), map: mat.map ?? undefined,
          normalMap: mat.normalMap ?? undefined, normalScale: mat.normalScale.clone(),
          roughnessMap: mat.roughnessMap ?? undefined, metalnessMap: mat.metalnessMap ?? undefined,
          roughness: mat.roughness, metalness: mat.metalness, ladoDuplo: true });
        for (const material of materiais) material.dispose();
      });
      this.modelo = normalizarFuzil(gltf.scene);
    } catch (erro) {
      if (!this.descartado) console.warn('Fuzil indisponível; usando arma de contingência.', erro);
    }
  }
  private descartar(modelo: Object3D, texturas: boolean): void {
    const mapas = new Set<Texture>();
    modelo.traverse((o) => {
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

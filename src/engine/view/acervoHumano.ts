import { CanvasTexture, NoColorSpace, SRGBColorSpace, Vector2, type AnimationClip, type Material, type Object3D, type Skeleton, type SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { carregarTextura } from '../carregarTextura';
import type { CarregamentoAssets } from '../carregamentoAssets';
import type { MaterialBank } from '../materials';
import type { Recursos } from './recursos';

export function descartarModeloHumano(raiz: Object3D, materiais = false): void {
  const geometrias = new Set<SkinnedMesh['geometry']>(), esqueletos = new Set<Skeleton>(), mats = new Set<Material>();
  raiz.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isMesh) return;
    geometrias.add(m.geometry);
    if (m.isSkinnedMesh) esqueletos.add(m.skeleton);
    if (materiais) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat);
  });
  for (const g of geometrias) g.dispose();
  for (const s of esqueletos) s.dispose();
  for (const m of mats) m.dispose();
}

/** Carregamento e propriedade dos recursos compartilhados dos personagens importados. */
export class AcervoHumano<T> {
  readonly pronto: Promise<void>;
  estado: 'carregando' | 'pronto' | 'erro' = 'carregando';
  erro = '';
  private modelo: Object3D | null = null;
  private clips: AnimationClip[] = [];
  private descartado = false;

  constructor(private readonly config: {
    id: string; bank: MaterialBank; anisotropia: number;
    aguardar?: Promise<void>;
    carregamento?: CarregamentoAssets;
    preparar: (clips: readonly AnimationClip[]) => AnimationClip[];
    instanciar: (modelo: Object3D, clips: readonly AnimationClip[], rec: Recursos) => T;
  }) {
    const textura = (id: string, cor: string, dados: boolean) => {
      const c = document.createElement('canvas'); c.width = c.height = 2;
      const g = c.getContext('2d');
      if (!g) throw new Error('Canvas 2D indisponível');
      g.fillStyle = cor; g.fillRect(0, 0, 2, 2);
      const t = new CanvasTexture(c);
      t.colorSpace = dados ? NoColorSpace : SRGBColorSpace;
      t.flipY = true; // UV original do FBX; os mapas não foram embutidos/virados pelo exportador glTF.
      t.anisotropy = config.anisotropia;
      carregarTextura(t, `/models/${config.id}/${id}.webp`, config.carregamento);
      return t;
    };
    const map = textura('albedo', '#d4cfc2', false);
    const def = {
      map, normalMap: textura('normal', '#8080ff', true), normalScale: new Vector2(.65, .65),
      roughnessMap: textura('rugosidade', '#ffffff', true), metalnessMap: textura('metalicidade', '#000000', true),
      color: 0xffffff, roughness: .95, metalness: 1,
    };
    config.bank.define(config.id, def);
    config.bank.define(`${config.id}-dor`, { ...def, emissive: 0x9c5144, emissiveMap: map, emissiveIntensity: .35 });
    this.pronto = this.carregar();
    config.carregamento?.acompanhar(`Modelo ${config.id}`, this.pronto.then(() => this.estado === 'pronto'));
  }

  criar(rec: Recursos): T | null {
    return !this.descartado && this.modelo ? this.config.instanciar(this.modelo, this.clips, rec) : null;
  }
  dispose(): void {
    this.descartado = true;
    if (this.modelo) descartarModeloHumano(this.modelo);
    this.modelo = null; this.clips = [];
  }
  private async carregar(): Promise<void> {
    try {
      const [gltf] = await Promise.all([new GLTFLoader().loadAsync(`/models/${this.config.id}/${this.config.id}.glb`), this.config.aguardar]);
      if (this.descartado) { descartarModeloHumano(gltf.scene, true); return; }
      const materiais = new Set<Material>();
      gltf.scene.traverse((o) => {
        const m = o as SkinnedMesh;
        if (m.isMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) materiais.add(mat);
      });
      for (const m of materiais) m.dispose();
      this.modelo = gltf.scene; this.clips = this.config.preparar(gltf.animations); this.estado = 'pronto';
    } catch (e) {
      if (this.descartado) return;
      this.estado = 'erro'; this.erro = e instanceof Error ? e.message : String(e);
      console.warn(`Modelo ${this.config.id} indisponível; usando o modelo de contingência.`, e);
    }
  }
}

import {
  HalfFloatType, LinearFilter, Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial,
  Vector2, WebGLRenderTarget, type Camera, type WebGLRenderer,
} from 'three';
import { COMMON, VERTEX } from './glsl';
import type { VisualStyle } from './types';

/** `escala` (qualidade) multiplica a altura interna do filtro; null = altura da tela. */
export function internalSize(
  viewW: number, viewH: number, alturaInterna: number | null, escala = 1,
): { w: number; h: number } {
  const alvo = Math.max(1, Math.round((alturaInterna ?? viewH) * escala));
  if (alvo >= viewH) return { w: viewW, h: viewH };
  return { w: Math.max(1, Math.round((viewW * alvo) / viewH)), h: alvo };
}

export class PostPipeline {
  private target: WebGLRenderTarget | null = null;
  private material: ShaderMaterial | null = null;
  private style: VisualStyle | null = null;
  private viewW = 1;
  private viewH = 1;
  private escala = 1;
  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad = new Mesh(new PlaneGeometry(2, 2));

  constructor(private readonly renderer: WebGLRenderer) {
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setStyle(style: VisualStyle): void {
    this.style = style;
    this.material?.dispose();
    this.material = new ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uResolution: { value: new Vector2(1, 1) } },
      vertexShader: VERTEX,
      fragmentShader: COMMON + style.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quad.material = this.material;
    this.rebuild();
  }

  resize(w: number, h: number): void {
    this.viewW = Math.max(1, w);
    this.viewH = Math.max(1, h);
    this.rebuild();
  }

  /** escala da resolução interna (qualidade gráfica) */
  setEscala(escala: number): void {
    if (escala === this.escala) return;
    this.escala = escala;
    this.rebuild();
  }

  render(scene: Scene, camera: Camera, time: number): void {
    if (!this.target || !this.material) return;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    const u = this.material.uniforms;
    u.tDiffuse.value = this.target.texture;
    u.uTime.value = time;
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.target?.dispose();
    this.material?.dispose();
    this.quad.geometry.dispose();
  }

  private rebuild(): void {
    if (!this.style || !this.material) return;
    const { w, h } = internalSize(this.viewW, this.viewH, this.style.alturaInterna, this.escala);
    const filter = this.style.ampliacao === 'nearest' ? NearestFilter : LinearFilter;
    this.target?.dispose();
    this.target = new WebGLRenderTarget(w, h, { type: HalfFloatType, minFilter: filter, magFilter: filter, depthBuffer: true });
    (this.material.uniforms.uResolution.value as Vector2).set(w, h);
  }
}

// Palco da engine: renderer, cena, câmera, névoa, materiais, luzes e pós-processamento, com o filtro
// visual e a qualidade aplicados. Não sabe de simulação, fase carregada nem áudio.
import { Color, FogExp2, PCFShadowMap, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { PostPipeline } from '../looks/pipeline';
import { NEVOA_REFERENCIA, type VisualStyle } from '../looks/types';
import { OPCOES_PADRAO, type Qualidade } from '../save/opcoes';
import type { AmbienteDef } from '../sim/fase';
import { WebGL2IndisponivelError } from './eventosEngine';
import { LightRig, SOMBRA_POR_QUALIDADE } from './lights';
import { createMaterialBank, type MaterialBank } from './materials';
import { createTextures, listarTexturas, type Textures } from './textures';
import { AcervoDoutor } from './view/doutor';
import { AcervoPolicial } from './view/policial';
import { AcervoChefe } from './view/chefe';
import { CarregamentoAssets } from './carregamentoAssets';
import { AcervoPistola } from './view/acervoPistola';
import { AcervoEscopeta } from './view/acervoEscopeta';
import { AcervoSMG } from './view/acervoSMG';
import { AcervoLancador } from './view/acervoLancador';
import { AcervoFechadura } from './view/acervoFechadura';

const ESCALA_POR_QUALIDADE: Record<Qualidade, number> = { baixa: 0.6, media: 0.8, alta: 1 };

export class Palco {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(80, 1, 0.05, 120);
  readonly texturas: Textures;
  readonly bank: MaterialBank;
  readonly doutor: AcervoDoutor;
  readonly policial: AcervoPolicial;
  readonly chefe: AcervoChefe;
  readonly pistola: AcervoPistola;
  readonly escopeta: AcervoEscopeta;
  readonly smg: AcervoSMG;
  readonly lancador: AcervoLancador;
  readonly fechadura: AcervoFechadura;
  readonly lights: LightRig;
  private readonly pipeline: PostPipeline;
  private readonly fog = new FogExp2(0x000000, 0);
  private readonly resizeObserver: ResizeObserver;
  private _estilo: VisualStyle;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly styles: readonly VisualStyle[], filtro: string, readonly carregamento = new CarregamentoAssets()) {
    if (styles.length === 0) throw new Error('Nenhum filtro visual registrado');
    const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
    if (!gl) throw new WebGL2IndisponivelError();
    this.renderer = new WebGLRenderer({ canvas, context: gl });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.info.autoReset = false;

    this.scene.add(this.camera);
    this.scene.fog = this.fog;
    this.scene.background = new Color(0x000000);

    this.texturas = createTextures(this.carregamento);
    const anisotropia = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    for (const t of listarTexturas(this.texturas)) t.anisotropy = anisotropia;
    this.bank = createMaterialBank(this.texturas);
    this.doutor = new AcervoDoutor(this.bank, anisotropia, this.carregamento);
    this.policial = new AcervoPolicial(this.bank, anisotropia, this.carregamento);
    this.chefe = new AcervoChefe(this.bank, anisotropia, this.carregamento);
    this.pistola = new AcervoPistola(this.bank, anisotropia, this.carregamento);
    this.escopeta = new AcervoEscopeta(this.bank, anisotropia, this.carregamento);
    this.smg = new AcervoSMG(this.bank, anisotropia, this.carregamento);
    this.lancador = new AcervoLancador(this.bank, anisotropia, this.carregamento);
    this.fechadura = new AcervoFechadura(this.bank, anisotropia, this.carregamento);
    this.carregamento.fechar();
    this.lights = new LightRig(this.scene, this.camera);
    this.pipeline = new PostPipeline(this.renderer);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    this._estilo = this.acharEstilo(filtro);
    this.aplicarEstilo();
    this.resize();
  }

  get estilo(): VisualStyle {
    return this._estilo;
  }

  /** Troca o filtro visual; `true` se mudou (a névoa da fase deve ser reaplicada por quem chama). */
  definirFiltro(id: string): boolean {
    const estilo = this.acharEstilo(id);
    if (estilo === this._estilo) return false;
    this._estilo = estilo;
    this.aplicarEstilo();
    return true;
  }

  aplicarQualidade(q: Qualidade, fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.pipeline.setEscala(ESCALA_POR_QUALIDADE[q]);
    this.lights.definirSombra(SOMBRA_POR_QUALIDADE[q]);
  }

  /** Névoa, fundo e luz ambiente: filtro combinado com o ambiente da fase (ou nenhum). */
  aplicarCena(amb: AmbienteDef | undefined): void {
    const c = this._estilo.cena;
    const cor = c.nevoa.cor ?? amb?.corNevoa ?? 0x000000;
    this.fog.color.setHex(cor);
    this.fog.density = c.nevoa.densidade * (amb ? amb.nevoa / NEVOA_REFERENCIA : 1);
    (this.scene.background as Color).setHex(cor);
    this.lights.aplicar(c, amb?.ambiente ?? 0);
  }

  /** Desenha o quadro; devolve as draw calls. */
  render(tempo: number): number {
    this.renderer.info.reset();
    this.pipeline.render(this.scene, this.camera, tempo);
    return this.renderer.info.render.calls;
  }

  dispose(): void {
    this.carregamento.cancelar();
    this.resizeObserver.disconnect();
    this.lights.dispose();
    this.doutor.dispose();
    this.policial.dispose();
    this.chefe.dispose();
    this.pistola.dispose();
    this.escopeta.dispose();
    this.smg.dispose();
    this.lancador.dispose();
    this.fechadura.dispose();
    this.bank.dispose();
    this.pipeline.dispose();
    this.renderer.dispose();
  }

  private acharEstilo(id: string): VisualStyle {
    return this.styles.find((s) => s.id === id)
      ?? this.styles.find((s) => s.id === OPCOES_PADRAO.filtro)
      ?? this.styles[0];
  }

  private aplicarEstilo(): void {
    const c = this._estilo.cena;
    this.bank.setKind(c.material);
    this.bank.setNearest(c.texturasNearest);
    this.bank.setEmissivo(c.emissivo);
    this.pipeline.setStyle(this._estilo);
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.pipeline.resize(Math.round(w * pr), Math.round(h * pr));
  }
}

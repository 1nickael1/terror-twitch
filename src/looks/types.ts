import type { Scene } from 'three';
import type { LightRig } from '../engine/lights';
import type { MaterialBank } from '../engine/materials';

export interface SceneContext {
  scene: Scene;
  bank: MaterialBank;
  lights: LightRig;
}

export interface VisualStyle {
  id: string;
  key: string;
  nome: string;
  frase: string;
  /** altura interna de render; largura segue o aspecto. null = resolução nativa */
  alturaInterna: number | null;
  /** como o render target é ampliado para a tela */
  ampliacao: 'nearest' | 'linear';
  /** ajusta a cena partindo do estado neutro (o motor reseta antes) */
  aplicar(ctx: SceneContext): void;
  /** corpo do fragment shader; COMMON é prefixado automaticamente */
  fragmentShader: string;
}

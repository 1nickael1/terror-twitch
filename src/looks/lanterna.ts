import { Color, FogExp2 } from 'three';
import type { VisualStyle } from './types';

export const LANTERNA: VisualStyle = {
  id: 'lanterna',
  key: '3',
  nome: 'Lanterna',
  frase: 'Escuro de verdade. Só o que a sua lanterna alcança existe.',
  alturaInterna: null,
  ampliacao: 'linear',
  aplicar({ scene, bank, lights }) {
    bank.setKind('standard');
    scene.fog = new FogExp2(0x000000, 0.11);
    scene.background = new Color(0x000000);
    lights.apply({
      ambient: 0.015, ambientColor: 0x445066, fluorescent: 2.5, flicker: 1, alarm: 12,
      flashlight: 140, flashlightShadows: true, flashlightAngle: 0.42,
    });
  },
  fragmentShader: /* glsl */ `
void main() {
  vec3 c = toSRGB(aces(texture2D(tDiffuse, vUv).rgb * 1.1));
  vec2 v = vUv - 0.5;
  c *= 1.0 - dot(v, v) * 1.1;
  c += (hash(vUv * uResolution + fract(uTime) * 91.0) - 0.5) * 0.04;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`,
};

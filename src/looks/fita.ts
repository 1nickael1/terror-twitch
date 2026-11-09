import { Color, FogExp2 } from 'three';
import type { VisualStyle } from './types';

export const FITA: VisualStyle = {
  id: 'fita',
  key: '2',
  nome: 'Fita Encontrada',
  frase: 'Alguém gravou isso. A fita foi achada no Sítio, sem o dono.',
  alturaInterna: 360,
  ampliacao: 'linear',
  aplicar({ scene, bank, lights }) {
    bank.setKind('standard');
    scene.fog = new FogExp2(0x0d0d0f, 0.06);
    scene.background = new Color(0x0d0d0f);
    lights.apply({ ambient: 0.12, fluorescent: 8, fluorescentColor: 0xe8f0d8, flicker: 0.8, alarm: 25, flashlight: 25, flashlightAngle: 0.7 });
  },
  fragmentShader: /* glsl */ `
void main() {
  vec2 uv = vUv;
  float line = fract(uTime * 0.07);
  float band = smoothstep(0.0, 0.03, abs(uv.y - line));
  uv.x += (1.0 - band) * 0.02 * (hash(vec2(uTime, uv.y)) - 0.5);
  uv.x += 0.0015 * sin(uv.y * 240.0 + uTime * 6.0);
  float ab = 0.004;
  vec3 c;
  c.r = (texture2D(tDiffuse, uv + vec2(ab, 0.0)).r + texture2D(tDiffuse, uv + vec2(ab + 0.002, 0.0)).r) * 0.5;
  c.g = (texture2D(tDiffuse, uv).g + texture2D(tDiffuse, uv + vec2(0.002, 0.0)).g) * 0.5;
  c.b = (texture2D(tDiffuse, uv - vec2(ab, 0.0)).b + texture2D(tDiffuse, uv - vec2(ab - 0.002, 0.0)).b) * 0.5;
  c = toSRGB(aces(c * 1.4));
  c = mix(vec3(luma(c)), c, 0.6) * vec3(1.05, 1.0, 0.92) + 0.03;
  c += (hash(uv * uResolution + fract(uTime) * 100.0) - 0.5) * 0.12;
  c += (1.0 - band) * 0.15 * hash(vec2(uv.y * 500.0, uTime));
  vec2 v = vUv - 0.5;
  c *= 1.0 - dot(v, v) * 1.3;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`,
};

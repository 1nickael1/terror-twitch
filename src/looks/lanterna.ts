import type { VisualStyle } from './types';

export const LANTERNA: VisualStyle = {
  id: 'lanterna',
  nome: 'Lanterna',
  frase: 'Escuro de verdade. Só o que a sua lanterna alcança existe.',
  alturaInterna: null,
  ampliacao: 'linear',
  cena: {
    nevoa: { cor: null, densidade: 0.11 },
    material: 'standard',
    texturasNearest: false,
    ambiente: 0.125,
    corAmbiente: 0x445066,
    luzes: 0.25,
    lanterna: 1,
    emissivo: 1,
    infravermelho: 0,
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

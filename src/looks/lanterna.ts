import type { VisualStyle } from './types';

export const LANTERNA: VisualStyle = {
  id: 'lanterna',
  nome: 'Lanterna',
  frase: 'Escuro de verdade. Só o que a sua lanterna alcança existe.',
  alturaInterna: null,
  ampliacao: 'linear',
  cena: {
    nevoa: { cor: null, densidade: 0.085 },
    material: 'standard',
    texturasNearest: false,
    ambiente: 0.19,
    corAmbiente: 0x445066,
    luzes: 0.48,
    lanterna: 1,
    emissivo: 1,
    infravermelho: 0,
  },
  fragmentShader: /* glsl */ `
void main() {
  vec3 linear = texture2D(tDiffuse, vUv).rgb;
  // Halo seletivo nas fontes muito claras, com oito amostras de custo fixo.
  vec3 halo = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 offset = vec2(cos(a), sin(a)) * 3.0 / uResolution;
    halo += max(texture2D(tDiffuse, vUv + offset).rgb - 0.9, 0.0);
  }
  linear += halo * 0.045;
  // Sombras ligeiramente frias, luz preservada em marfim.
  linear *= mix(vec3(0.86, 0.98, 1.06), vec3(1.04, 1.01, 0.95), smoothstep(0.0, 0.5, luma(linear)));
  vec3 c = toSRGB(aces(linear * 1.15));
  vec2 v = vUv - 0.5;
  c *= 1.0 - dot(v, v) * 0.85;
  c += (hash(vUv * uResolution + fract(uTime) * 91.0) - 0.5) * 0.022;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`,
};

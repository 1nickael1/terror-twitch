import type { VisualStyle } from './types';

export const DISQUETE: VisualStyle = {
  id: 'disquete',
  nome: 'Disquete 1994',
  frase: 'Pixels gordos e paleta curta, como se a Fundação rodasse num 486.',
  alturaInterna: 180,
  ampliacao: 'nearest',
  // protótipo: Fog linear 3–24 m; a exponencial 0,065 tem a mesma metade de opacidade (~13 m)
  cena: {
    nevoa: { cor: 0x140f0b, densidade: 0.065 },
    material: 'lambert',
    texturasNearest: true,
    ambiente: 5,
    corAmbiente: 0xb59a7a,
    luzes: 1.4,
    lanterna: 0.35,
    emissivo: 1,
    infravermelho: 0,
  },
  fragmentShader: /* glsl */ `
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return m[int(q.y * 4.0 + q.x)] / 16.0 - 0.5;
}
void main() {
  vec3 c = toSRGB(aces(texture2D(tDiffuse, vUv).rgb * 1.2));
  vec3 steps = vec3(4.0, 4.0, 3.0); // 5×5×4 = 100 cores
  float d = bayer4(vUv * uResolution) * 0.75; // dither mais contido: menos chiado nas áreas escuras
  c = floor(c * steps + 0.5 + d) / steps;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`,
};

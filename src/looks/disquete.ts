import { Color, Fog } from 'three';
import type { VisualStyle } from './types';

export const DISQUETE: VisualStyle = {
  id: 'disquete',
  key: '1',
  nome: 'Disquete 1994',
  frase: 'Pixels gordos e paleta curta, como se a Fundação rodasse num 486.',
  alturaInterna: 180,
  ampliacao: 'nearest',
  aplicar({ scene, bank, lights }) {
    bank.setKind('lambert');
    bank.setNearest(true);
    scene.fog = new Fog(0x140f0b, 3, 24);
    scene.background = new Color(0x140f0b);
    lights.apply({ ambient: 0.6, ambientColor: 0xb59a7a, fluorescent: 14, fluorescentColor: 0xfff0d0, flicker: 0.5, alarm: 30 });
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

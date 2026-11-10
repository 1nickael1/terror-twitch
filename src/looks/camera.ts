import type { VisualStyle } from './types';

export const CAMERA: VisualStyle = {
  id: 'camera',
  nome: 'Câmera do Agente',
  frase: 'Body-cam de visão noturna de um agente da Força-Tarefa. Verde, ruidosa, fria.',
  alturaInterna: 450,
  ampliacao: 'linear',
  cena: {
    nevoa: { cor: 0x000000, densidade: 0.035 },
    material: 'standard',
    texturasNearest: false,
    ambiente: 0.42,
    luzes: 0.6,
    lanterna: 0.1,
    emissivo: 1,
    infravermelho: 6,
  },
  fragmentShader: /* glsl */ `
vec2 barrel(vec2 uv) {
  vec2 c = uv - 0.5;
  return 0.5 + c * (1.0 + 0.18 * dot(c, c));
}
void main() {
  vec2 uv = barrel(vUv);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 src = texture2D(tDiffuse, uv).rgb;
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    // textureLod: sem derivadas dentro do loop (o render target não tem mipmaps, o resultado é igual)
    glow += max(textureLod(tDiffuse, uv + vec2(cos(a), sin(a)) * 0.012, 0.0).rgb - 0.6, 0.0);
  }
  float l = luma(src) * 2.2 + luma(glow) * 0.5;
  l = pow(l / (1.0 + l), 0.8);
  l += (hash(uv * uResolution + uTime * 61.0) - 0.5) * 0.18;
  l *= 0.85 + 0.15 * sin(uv.y * uResolution.y * 3.14159);
  vec3 c = vec3(0.12, 1.0, 0.35) * l;
  vec2 v = vUv - 0.5;
  c *= 1.0 - dot(v, v) * 1.6;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`,
};

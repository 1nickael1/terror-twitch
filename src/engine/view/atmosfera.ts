import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, Vector3, type Group, type PerspectiveCamera } from 'three';
import { CELL, type Grid } from '../../sim/grid';
import type { World } from '../../sim/world';
import type { Recursos } from './recursos';

/** Poeira em suspensão: uma única chamada de desenho, animação na GPU e teste de profundidade. */
export class Atmosfera {
  private readonly pontos: Points;
  private readonly material: ShaderMaterial;
  private tempo = 0;

  constructor(g: Grid, rec: Recursos, grupo: Group) {
    const pos: number[] = [];
    let s = 1977;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let row = 0; row < g.rows; row++) {
      for (let col = 0; col < g.cols; col++) {
        const c = g.celulas[row * g.cols + col];
        if (c.tipo !== 'piso' || c.rampa) continue;
        for (let i = 0; i < 3; i++) {
          pos.push((col + .12 + r() * .76) * CELL, c.piso + .3 + r() * (c.teto - c.piso - .6), (row + .12 + r() * .76) * CELL);
        }
      }
    }
    this.material = rec.mat(new ShaderMaterial({
      uniforms: { tempo: { value: 0 }, olho: { value: new Vector3() }, direcao: { value: new Vector3() }, lanterna: { value: 1 } },
      vertexShader: `
        uniform float tempo; uniform vec3 olho; uniform vec3 direcao; uniform float lanterna;
        varying float alfa;
        void main() {
          vec3 p = position;
          p.x += sin(tempo * .22 + position.z * 3.) * .065;
          p.y += sin(tempo * .17 + position.x * 4.) * .10;
          vec3 delta = p - olho;
          float d = length(delta);
          float cone = smoothstep(.76, .96, dot(normalize(delta), direcao));
          alfa = exp(-d * .14) * (.035 + cone * lanterna * .32);
          vec4 view = modelViewMatrix * vec4(p, 1.);
          gl_Position = projectionMatrix * view;
          gl_PointSize = clamp(22. / max(1., -view.z), 1., 3.5);
        }`,
      fragmentShader: `
        varying float alfa;
        void main() {
          float r = length(gl_PointCoord - .5) * 2.;
          if (r > 1.) discard;
          gl_FragColor = vec4(.78, .85, .81, alfa * (1. - r) * (1. - r));
        }`,
      transparent: true, depthWrite: false,
    }));
    const geo = rec.geo(new BufferGeometry());
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    this.pontos = new Points(geo, this.material);
    this.pontos.name = 'fase:poeira';
    grupo.add(this.pontos);
  }

  atualizar(world: World, camera: PerspectiveCamera, dt: number): void {
    this.tempo += dt;
    const u = this.material.uniforms;
    u.tempo.value = this.tempo;
    camera.getWorldPosition(u.olho.value);
    camera.getWorldDirection(u.direcao.value);
    u.lanterna.value = world.jogador.lanterna ? 1 : 0;
  }
}

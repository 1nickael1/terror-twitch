// Contas puras das placas de sinalização: quebra do texto em linhas, para onde a placa olha e o atlas das texturas.
import type { PropDef } from '../../sim/fase';
import type { Vec2 } from '../../sim/grid';

const MAX_LINHAS = 3;

/**
 * Texto da placa em caixa alta, quebrado por palavra em linhas de até `max` caracteres (uma
 * palavra maior fica inteira). Respeita `\n`. Acima de 3 linhas, a terceira termina em "…".
 */
export function linhasDaPlaca(texto: string, max: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.toUpperCase().split('\n')) {
    let atual = '';
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      if (atual && atual.length + 1 + palavra.length > max) {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = atual ? `${atual} ${palavra}` : palavra;
      }
    }
    if (atual) linhas.push(atual);
  }
  if (linhas.length <= MAX_LINHAS) return linhas;
  const cortadas = linhas.slice(0, MAX_LINHAS);
  cortadas[MAX_LINHAS - 1] = `${cortadas[MAX_LINHAS - 1]}…`;
  return cortadas;
}

/**
 * Normal da placa (para onde ela olha, unitária em planta). Com `parede` (n = -z, s = +z, l = +x,
 * o = -x, como os decalques), olha para dentro da célula; sem, para a frente do `yaw`
 * (frente = (-sin yaw, -cos yaw)) e fica presa na borda oposta.
 */
export function normalParede(parede: PropDef['parede'], yaw: number): Vec2 {
  switch (parede) {
    case 'n': return { x: 0, z: 1 };
    case 's': return { x: 0, z: -1 };
    case 'l': return { x: -1, z: 0 };
    case 'o': return { x: 1, z: 0 };
    default: return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  }
}

/** Atlas das placas: `colunas` × `linhas` ladrilhos de `larg` × `alt` px num canvas de `largTotal` × `altTotal`. */
export interface LayoutAtlas { colunas: number; linhas: number; larg: number; alt: number; largTotal: number; altTotal: number }

/** Lado máximo (px) do canvas do atlas. */
export const ATLAS_MAX = 2048;

/**
 * Layout do atlas para `n` placas: ladrilhos de 512 × 256 em até 4 colunas; se não couberem em
 * `ATLAS_MAX` de altura, os ladrilhos caem pela metade (e as colunas dobram) até caberem.
 */
export function layoutAtlas(n: number): LayoutAtlas {
  let larg = 512;
  let alt = 256;
  for (;;) {
    const colunas = Math.max(1, Math.min(n, Math.floor(ATLAS_MAX / larg)));
    const linhas = Math.max(1, Math.ceil(n / colunas));
    if (linhas * alt <= ATLAS_MAX || larg <= 32) return { colunas, linhas, larg, alt, largTotal: colunas * larg, altTotal: linhas * alt };
    larg /= 2;
    alt /= 2;
  }
}

/** Canto superior esquerdo (px) do ladrilho `i` no canvas. */
export function origemNoAtlas(i: number, l: LayoutAtlas): { x: number; y: number } {
  return { x: (i % l.colunas) * l.larg, y: Math.floor(i / l.colunas) * l.alt };
}

/**
 * UVs [u0, v0, u1, v1] do ladrilho `i` (textura com `flipY`: v = 1 no topo do canvas), com meio
 * pixel de margem para o filtro não puxar a vizinha.
 */
export function uvNoAtlas(i: number, l: LayoutAtlas): [number, number, number, number] {
  const { x, y } = origemNoAtlas(i, l);
  const mu = 0.5 / l.largTotal;
  const mv = 0.5 / l.altTotal;
  return [x / l.largTotal + mu, 1 - (y + l.alt) / l.altTotal + mv, (x + l.larg) / l.largTotal - mu, 1 - y / l.altTotal - mv];
}

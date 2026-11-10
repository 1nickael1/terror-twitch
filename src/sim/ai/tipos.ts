// Tipos de inimigo: números de cada um. Lógica pura.

export type Arquetipo = 'avancador' | 'atirador' | 'emboscador';
export interface TipoInimigo {
  arquetipo: Arquetipo; vida: number; velocidade: number; raio: number; altura: number;
  visao: number; visaoEscuro: number; cone: number; audicao: number;   // audicao multiplica o raio do ruído
  dano: number; alcanceAtaque: number; cadencia: number; preparo: number; dor: number;
  distanciaIdeal: number;                                               // atirador
  projetil: { velocidade: number; raio: number } | null;
}

const CONE = (110 * Math.PI) / 180;

export const TIPOS: Record<string, TipoInimigo> = {
  funcionario: {
    arquetipo: 'avancador', vida: 40, velocidade: 4.5, raio: 0.35, altura: 1.8,
    visao: 16, visaoEscuro: 7, cone: CONE, audicao: 1,
    dano: 10, alcanceAtaque: 1.2, cadencia: 1.0, preparo: 0.35, dor: 0.25,
    distanciaIdeal: 0, projetil: null,
  },
  seguranca: {
    arquetipo: 'atirador', vida: 55, velocidade: 3.2, raio: 0.35, altura: 1.8,
    visao: 20, visaoEscuro: 9, cone: CONE, audicao: 1,
    dano: 12, alcanceAtaque: 16, cadencia: 1.6, preparo: 0.5, dor: 0.25,
    distanciaIdeal: 9, projetil: { velocidade: 11, raio: 0.15 },
  },
  // chefe da fase 1: a IA é `ai/chefe096.ts` (regras em `CHEFE_096`); `dor` 0 = não para ao levar dano
  entidade096: {
    arquetipo: 'avancador', vida: 900, velocidade: 8.2, raio: 0.45, altura: 2.4,
    visao: 60, visaoEscuro: 60, cone: 2 * Math.PI, audicao: 0,
    dano: 70, alcanceAtaque: 1.3, cadencia: 1.4, preparo: 0.45, dor: 0,
    distanciaIdeal: 0, projetil: null,
  },
};

/** Tipo pelo nome; erro claro se não existe. */
export function tipoDe(nome: string): TipoInimigo {
  const t = Object.prototype.hasOwnProperty.call(TIPOS, nome) ? TIPOS[nome] : undefined;
  if (!t) throw new Error(`Tipo de inimigo desconhecido: "${nome}"`);
  return t;
}

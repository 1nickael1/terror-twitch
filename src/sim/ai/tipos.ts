// Tipos de inimigo: números de cada um. Lógica pura.
import { IA } from '../balance';
import type { Inimigo } from '../world';

export type Arquetipo = 'avancador' | 'atirador' | 'emboscador';
export interface TipoInimigo {
  imovel?: boolean;
  arquetipo: Arquetipo; vida: number; velocidade: number; raio: number; altura: number;
  visao: number; visaoEscuro: number; cone: number; audicao: number;   // audicao multiplica o raio do ruído
  dano: number; alcanceAtaque: number; cadencia: number; preparo: number; dor: number;
  distanciaIdeal: number;                                               // atirador
  /** com `arco`: voa em parábola até o ponto mirado; ao tocar piso ou parede, fere o jogador a até `respingo` m (C3.2) */
  projetil: { velocidade: number; raio: number; arco?: { gravidade: number; respingo: number } } | null;
  reanimavel: boolean;                                                  // o chefe 049 pode levantar o corpo (C3.2)
  /** começa sempre `dormindo`, deitado; ao perceber o jogador (ou levar dano) passa por `levantando` (C3.2) */
  deitado: boolean;
}

const CONE = (110 * Math.PI) / 180;

export const TIPOS: Record<string, TipoInimigo> = {
  alvo_treino: {
    imovel: true, arquetipo: 'avancador', vida: 500, velocidade: 0, raio: 0.4, altura: 1.8,
    visao: 0, visaoEscuro: 0, cone: 0, audicao: 0,
    dano: 0, alcanceAtaque: 0, cadencia: 1, preparo: 1, dor: 0.15,
    distanciaIdeal: 0, projetil: null, reanimavel: false, deitado: false,
  },
  funcionario: {
    arquetipo: 'avancador', vida: 40, velocidade: 4.5, raio: 0.35, altura: 1.8,
    visao: 16, visaoEscuro: 7, cone: CONE, audicao: 1,
    dano: 10, alcanceAtaque: 1.2, cadencia: 1.0, preparo: 0.35, dor: 0.25,
    distanciaIdeal: 0, projetil: null, reanimavel: false, deitado: false,
  },
  seguranca: {
    arquetipo: 'atirador', vida: 55, velocidade: 3.2, raio: 0.35, altura: 1.8,
    visao: 20, visaoEscuro: 9, cone: CONE, audicao: 1,
    dano: 12, alcanceAtaque: 16, cadencia: 1.6, preparo: 0.5, dor: 0.25,
    distanciaIdeal: 9, projetil: { velocidade: 11, raio: 0.15 }, reanimavel: false, deitado: false,
  },
  // chefe da fase 1: a IA é `ai/chefe096.ts` (regras em `CHEFE_096`); `dor` 0 = não para ao levar dano
  entidade096: {
    arquetipo: 'avancador', vida: 900, velocidade: 8.2, raio: 0.45, altura: 2.4,
    visao: 60, visaoEscuro: 60, cone: 2 * Math.PI, audicao: 0,
    dano: 70, alcanceAtaque: 1.3, cadencia: 1.4, preparo: 0.45, dor: 0,
    distanciaIdeal: 0, projetil: null, reanimavel: false, deitado: false,
  },
  // fase 2: avançador resistente; o chefe 049 levanta o corpo
  reanimado: {
    arquetipo: 'avancador', vida: 70, velocidade: 3.6, raio: 0.38, altura: 1.8,
    visao: 14, visaoEscuro: 6, cone: CONE, audicao: 1.2,
    dano: 14, alcanceAtaque: 1.2, cadencia: 1.1, preparo: 0.45, dor: 0.12,
    distanciaIdeal: 0, projetil: null, reanimavel: true, deitado: false,
  },
  // emboscador deitado entre os corpos: levanta (`IA.levantar`) ao perceber o jogador
  reanimado_cirurgico: {
    arquetipo: 'emboscador', vida: 55, velocidade: 5.0, raio: 0.36, altura: 1.75,
    visao: 10, visaoEscuro: 5, cone: CONE, audicao: 0.8,
    dano: 18, alcanceAtaque: 1.3, cadencia: 1.0, preparo: 0.3, dor: 0.2,
    distanciaIdeal: 0, projetil: null, reanimavel: true, deitado: true,
  },
  // atirador de frascos: parábola até o ponto mirado, respingo ao quebrar
  enfermeiro: {
    arquetipo: 'atirador', vida: 50, velocidade: 3.0, raio: 0.35, altura: 1.8,
    visao: 18, visaoEscuro: 8, cone: CONE, audicao: 1,
    dano: 16, alcanceAtaque: 14, cadencia: 2.2, preparo: 0.7, dor: 0.3,
    distanciaIdeal: 8, projetil: { velocidade: 9, raio: 0.18, arco: { gravidade: 12, respingo: 1.6 } },
    reanimavel: false, deitado: false,
  },
  // chefe da fase 2: a IA é `ai/chefe049.ts` (regras em `CHEFE_049`); o toque é o golpe (`dano`, `preparo`)
  entidade049: {
    arquetipo: 'avancador', vida: 1100, velocidade: 2.2, raio: 0.4, altura: 2.0,
    visao: 40, visaoEscuro: 40, cone: 2 * Math.PI, audicao: 0,
    dano: 85, alcanceAtaque: 1.4, cadencia: 2.2, preparo: 0.9, dor: 0,
    distanciaIdeal: 0, projetil: null, reanimavel: false, deitado: false,
  },
};

/** Tipo pelo nome; erro claro se não existe. */
export function tipoDe(nome: string): TipoInimigo {
  const t = Object.prototype.hasOwnProperty.call(TIPOS, nome) ? TIPOS[nome] : undefined;
  if (!t) throw new Error(`Tipo de inimigo desconhecido: "${nome}"`);
  return t;
}

/**
 * Altura do corpo agora (tiro, cabeça, olhos): deitado (`IA.alturaDeitado`) com o tipo `deitado` dormindo e com
 * quem está `levantando` no começo (até faltar `IA.levantar / 2`); senão a `altura` do tipo (C3.2, correção 1).
 */
export function alturaCorpo(i: Inimigo): number {
  const t = tipoDe(i.tipo);
  const deitado = (i.modo === 'dormindo' && t.deitado) || (i.modo === 'levantando' && i.timer > IA.levantar / 2);
  return deitado ? Math.min(t.altura, IA.alturaDeitado) : t.altura;
}

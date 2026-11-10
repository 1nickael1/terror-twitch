// Chefe da fase 2 (entidade 049): inerte até a ação `chefe` ou dano; depois caminha devagar até o
// jogador sabendo onde ele está, toca (golpe pesado com preparo), levanta corpos reanimáveis e se
// apressa quando o jogador foge para longe. Não abre nem arromba portas. Lógica pura.
import { CHEFE_049, IA, NUVEM } from '../balance';
import { solidoDe } from '../doors';
import type { SimEvent } from '../eventos';
import { alturaPiso, caminho, centro, DEGRAU, naArea, SALTO, visivel } from '../grid';
import { resolverOnde } from '../onde';
import type { EstadoChefe049, FaseChefe049, Inimigo, ModoIA, World } from '../world';
import { confirmarMorteChefe, contarPassos, inimigoDoChefe } from './chefeComum';
import type { IaDeChefe } from './chefes';
import { entrarLevantando, ferirJogador } from './comum';
import { andar, celulaMaisProxima, encarar, linhaAndavel, normalizar, yawPara } from './movimento';
import { aoAlcance, distanciaJogador } from './percepcao';
import { alturaCorpo, tipoDe, type TipoInimigo } from './tipos';

/** O `Inimigo.modo` do chefe é derivado da fase (para as views e a tensão). */
const MODO: Record<FaseChefe049, ModoIA> = {
  inerte: 'patrulha', despertando: 'suspeita', reanimando: 'suspeita',
  caminhando: 'perseguicao', apressado: 'perseguicao', tocando: 'ataque', morto: 'morto',
};

export function modoDoChefe049(f: FaseChefe049): ModoIA {
  return MODO[f];
}


/** O estado do chefe, se for o 049. */
function estado049(w: World): EstadoChefe049 | null {
  return w.chefe?.tipo === 'entidade049' ? w.chefe : null;
}

// --- transições ------------------------------------------------------------------------------

/** Desperta o chefe inerte (evento `chefe_desperta`). Sem chefe 049, ou já acordado, nada. */
export function despertarChefe049(w: World): SimEvent[] {
  const c = estado049(w);
  if (!c || c.fase !== 'inerte') return [];
  c.fase = 'despertando';
  c.timer = CHEFE_049.despertar;
  const i = inimigoDoChefe(w);
  if (i && i.modo !== 'morto') i.modo = MODO.despertando;
  return [{ tipo: 'chefe_desperta' }];
}

function entrarCaminhando(c: EstadoChefe049, i: Inimigo): void {
  c.fase = 'caminhando';
  c.timer = 0;
  i.rotaEm = 0;
}

/** Espera até a próxima tentativa de reanimar: menor com a vida abaixo da metade. */
function intervaloReanimar(i: Inimigo, t: TipoInimigo): number {
  return i.vida < t.vida * 0.5 ? CHEFE_049.intervaloReanimarFerido : CHEFE_049.intervaloReanimar;
}

/**
 * O chefe alcança o corpo: piso a até `SALTO` de diferença e linha livre dos olhos dele ao corpo deitado,
 * pela mesma regra de visão dos inimigos (paredes, portas fechadas, janelas e grades não deixam; C3.2, correção 1).
 */
function corpoAlcancavel(w: World, i: Inimigo, x: Inimigo): boolean {
  if (Math.abs(x.y - i.y) > SALTO) return false;
  const olhos = i.y + tipoDe(i.tipo).altura * IA.olhos;
  return visivel(w.grid, i.pos, x.pos, solidoDe(w), olhos, x.y + alturaCorpo(x));
}

/**
 * Corpo (`morto`, tipo reanimável, não o chefe) mais próximo a até `alcanceReanimar` e alcançável
 * (`corpoAlcancavel`), desde que ele tenha menos de `maxLevantados` levantados vivos; senão null.
 */
function corpoParaReanimar(w: World, c: EstadoChefe049, i: Inimigo): Inimigo | null {
  const vivos = w.inimigos.filter((x) => c.levantados.includes(x.id) && x.modo !== 'morto').length;
  if (vivos >= CHEFE_049.maxLevantados) return null;
  let melhor: Inimigo | null = null;
  let melhorD: number = CHEFE_049.alcanceReanimar;
  for (const x of w.inimigos) {
    if (x.id === i.id || x.modo !== 'morto' || !tipoDe(x.tipo).reanimavel) continue;
    const d = Math.hypot(x.pos.x - i.pos.x, x.pos.z - i.pos.z);
    if (d <= melhorD && corpoAlcancavel(w, i, x)) {
      melhor = x;
      melhorD = d;
    }
  }
  return melhor;
}

/**
 * O corpo volta: `levantando` por `CHEFE_049.levantar` s com `vidaReanimado` da vida do tipo, sem grupo
 * (não mexe em `grupo_morto`). Conta no total só se nunca contou (`contado`); a morte já contada fica.
 */
function levantarCorpo(w: World, c: EstadoChefe049, x: Inimigo): SimEvent[] {
  x.vida = tipoDe(x.tipo).vida * CHEFE_049.vidaReanimado;
  x.grupo = null;
  x.espera = 0;
  x.lento = 0;
  x.ultimoVisto = null;
  x.semVer = 0;
  x.alertado = false;
  x.refugio = null;
  x.semRota = false;
  x.destinoRota = null;
  if (!x.contado) {
    x.contado = true;
    w.stats.totalInimigos++;
  }
  if (!c.levantados.includes(x.id)) c.levantados.push(x.id);
  return entrarLevantando(x, CHEFE_049.levantar);
}

// --- fases -----------------------------------------------------------------------------------

/** Parado, de frente para o `yaw`. Só o dano o desperta (a ação `chefe` vem por `despertar`). */
function inerte(w: World, i: Inimigo, t: TipoInimigo): SimEvent[] {
  return i.vida < t.vida ? despertarChefe049(w) : [];
}

/** Parado, virando para o jogador; depois caminha, com a primeira reanimação marcada. */
function despertando(w: World, c: EstadoChefe049, i: Inimigo, dt: number): SimEvent[] {
  const alvo = yawPara(w.jogador.pos.x - i.pos.x, w.jogador.pos.z - i.pos.z);
  const giro = (Math.PI / CHEFE_049.despertar) * dt;
  const falta = normalizar(alvo - i.yaw);
  i.yaw = normalizar(i.yaw + Math.max(-giro, Math.min(giro, falta)));
  c.timer -= dt;
  if (c.timer <= 0) {
    entrarCaminhando(c, i);
    c.reanimar = CHEFE_049.primeiraReanimacao;
    c.longe = 0;
  }
  return [];
}

/**
 * Perto do jogador (`alcanceToque`), toca: `tocando` com o `preparo` do tipo (evento `chefe_toque`); entre
 * dois toques espera a `cadencia`, parado de frente para ele. Devolve null se não está perto.
 */
function tentarToque(w: World, c: EstadoChefe049, i: Inimigo, t: TipoInimigo): SimEvent[] | null {
  if (!aoAlcance(w, i, t, CHEFE_049.alcanceToque)) return null;
  encarar(i, w.jogador.pos);
  if (i.espera > 0) return [];
  c.fase = 'tocando';
  c.timer = t.preparo;
  c.longe = 0;
  return [{ tipo: 'chefe_toque' }];
}

/**
 * Sabe sempre onde o jogador está. Desconta `reanimar`. Perto do jogador, toca (o toque vence a reanimação:
 * ela espera ele se afastar). Senão, com `reanimar` vencido, procura um corpo; conta o tempo com o jogador
 * além de `longe` (passando de `tempoLonge`, se apressa); e segue a rota.
 */
function caminhando(w: World, c: EstadoChefe049, i: Inimigo, t: TipoInimigo, vel: number, dt: number): SimEvent[] {
  c.reanimar -= dt;
  const toque = tentarToque(w, c, i, t);
  if (toque) return toque;
  if (c.reanimar <= 0) {
    const corpo = corpoParaReanimar(w, c, i);
    if (corpo) {
      c.fase = 'reanimando';
      c.timer = CHEFE_049.reanimar;
      c.corpoAlvo = corpo.id;
      encarar(i, corpo.pos);
      return [{ tipo: 'chefe_reanima', corpo: corpo.id }];
    }
    c.reanimar = intervaloReanimar(i, t);
  }
  c.longe = distanciaJogador(w, i) > CHEFE_049.longe ? c.longe + dt : 0;
  if (c.longe > CHEFE_049.tempoLonge) {
    c.fase = 'apressado';
    c.timer = CHEFE_049.apressado;
    return [{ tipo: 'chefe_apressa' }];
  }
  seguirRota(w, i, vel, dt);
  return [];
}

/** Apressado: a `velocidadeApressado` por `apressado` s (pode tocar); depois caminha com `longe = 0`. */
function apressado(w: World, c: EstadoChefe049, i: Inimigo, t: TipoInimigo, lentidao: number, dt: number): SimEvent[] {
  c.timer -= dt;
  if (c.timer <= 0) {
    entrarCaminhando(c, i);
    c.longe = 0;
    return [];
  }
  const toque = tentarToque(w, c, i, t);
  if (toque) return toque;
  seguirRota(w, i, CHEFE_049.velocidadeApressado * lentidao, dt);
  return [];
}

/** Preparo parado de frente para o jogador; no fim, fere se ele ainda está a `alcanceToque × folgaToque`. */
function tocando(w: World, c: EstadoChefe049, i: Inimigo, t: TipoInimigo, dt: number): SimEvent[] {
  encarar(i, w.jogador.pos);
  c.timer -= dt;
  if (c.timer > 0) return [];
  entrarCaminhando(c, i);
  i.espera = t.cadencia;
  return aoAlcance(w, i, t, CHEFE_049.alcanceToque * CHEFE_049.folgaToque) ? ferirJogador(w, t.dano, i.pos) : [];
}

/** Parado reanimando; no fim o corpo levanta (se ainda é corpo) e ele volta a caminhar. */
function reanimando(w: World, c: EstadoChefe049, i: Inimigo, t: TipoInimigo, dt: number): SimEvent[] {
  const corpo = w.inimigos.find((x) => x.id === c.corpoAlvo);
  if (corpo) encarar(i, corpo.pos);
  c.timer -= dt;
  if (c.timer > 0) return [];
  c.corpoAlvo = null;
  c.reanimar = intervaloReanimar(i, t);
  entrarCaminhando(c, i);
  return corpo && corpo.modo === 'morto' ? levantarCorpo(w, c, corpo) : [];
}

/**
 * Rota A* comum até o jogador: em linha reta quando dá; senão recalculada a cada `IA.intervaloRota`,
 * com portas não abertas (e células de comporta) como sólidas: ele não abre nem arromba. Sem rota, vai à
 * célula alcançável mais próxima do jogador (`refugio`) e espera ali virado para ele.
 */
function seguirRota(w: World, i: Inimigo, vel: number, dt: number): void {
  const j = w.jogador;
  if (linhaAndavel(w, i, j.pos)) {
    i.rota = [];
    i.refugio = null;
    andar(w, i, j.pos, vel, dt);
    return;
  }
  if (i.rotaEm <= 0) {
    const solido = solidoDe(w);
    let rota = caminho(w.grid, i.pos, j.pos, DEGRAU, solido, SALTO);
    let destino = j.pos;
    i.refugio = null;
    if (rota === null) {
      i.refugio = celulaMaisProxima(w, i, j.pos, solido);
      destino = i.refugio;
      rota = caminho(w.grid, i.pos, destino, DEGRAU, solido, SALTO);
    }
    i.rotasCalculadas++;
    i.rotaEm = IA.intervaloRota;
    i.rota = rota === null ? [] : rota.length > 0 ? rota : [{ x: destino.x, z: destino.z }];
  }
  const prox = i.rota[0];
  if (!prox) {
    encarar(i, j.pos);
    return;
  }
  if (andar(w, i, prox, vel, dt)) i.rota.shift();
  if (i.rota.length === 0 && i.refugio) encarar(i, j.pos);
}

/**
 * Um passo do chefe 049. O `Inimigo` morto leva à fase `morto` (`confirmarMorteChefe`). Ao fim,
 * `i.modo` segue a fase (`modoDoChefe049`).
 */
export function avancarChefe049(w: World, i: Inimigo, dt: number): SimEvent[] {
  const c = estado049(w);
  if (!c) return [];
  if (i.modo === 'morto') return confirmarMorteChefe(w);
  const t = tipoDe(i.tipo);
  i.espera = Math.max(0, i.espera - dt);
  i.rotaEm = Math.max(0, i.rotaEm - dt);
  const lentidao = i.lento > 0 ? NUVEM.lentidao : 1;
  i.lento = Math.max(0, i.lento - dt);
  const arena = w.fase.chefe?.arena;
  if (c.fase !== 'inerte' && !c.naArena && arena && naArea(i.pos, arena)) c.naArena = true;

  const faseAntes = c.fase;
  const antes = { x: i.pos.x, z: i.pos.z };
  let eventos: SimEvent[] = [];
  switch (c.fase) {
    case 'inerte':
      eventos = inerte(w, i, t);
      break;
    case 'despertando':
      eventos = despertando(w, c, i, dt);
      break;
    case 'caminhando':
      eventos = caminhando(w, c, i, t, t.velocidade * lentidao, dt);
      break;
    case 'apressado':
      eventos = apressado(w, c, i, t, lentidao, dt);
      break;
    case 'tocando':
      eventos = tocando(w, c, i, t, dt);
      break;
    case 'reanimando':
      eventos = reanimando(w, c, i, t, dt);
      break;
    case 'morto':
      break;
  }
  i.modo = MODO[c.fase];
  return faseAntes === 'caminhando' || faseAntes === 'apressado' ? [...eventos, ...contarPassos(c, antes, i.pos, CHEFE_049.passoMetros)] : eventos;
}

/**
 * Restauro de checkpoint. Corpos levantados por ele que estavam em `levantando` voltam a `morto` (sem
 * contar morte nova); o que levantava pela primeira vez sem nunca ter morrido (corpo `corpo: true`) volta
 * também a não contar no total, para o placar seguir alcançável (correção 1). Acordado (nem inerte nem morto): volta na `retomada`, `despertando` com
 * `CHEFE_049.retomada`, sem corpo-alvo.
 */
export function retomarChefe049(w: World): void {
  const c = estado049(w);
  const def = w.fase.chefe;
  if (!c || !def) return;
  for (const x of w.inimigos) {
    if (x.modo !== 'levantando' || !c.levantados.includes(x.id)) continue;
    x.modo = 'morto';
    x.vida = 0;
    x.timer = 0;
    if (!x.jaMorreu && x.contado) {
      x.contado = false;
      w.stats.totalInimigos--;
    }
  }
  if (c.fase === 'inerte' || c.fase === 'morto') return;
  const i = inimigoDoChefe(w);
  if (!i || i.modo === 'morto') return;
  i.pos = centro(resolverOnde(w.grid, def.retomada));
  i.y = alturaPiso(w.grid, i.pos);
  i.rota = [];
  i.rotaEm = 0;
  i.espera = 0;
  i.refugio = null;
  c.fase = 'despertando';
  c.timer = CHEFE_049.retomada;
  c.corpoAlvo = null;
  c.longe = 0;
  i.modo = MODO[c.fase];
}

/** Estado inicial do 049: inerte. */
function criarEstado049(inimigoId: number): EstadoChefe049 {
  return {
    tipo: 'entidade049', inimigoId, fase: 'inerte', timer: 0, naArena: false, passo: 0,
    reanimar: 0, corpoAlvo: null, longe: 0, levantados: [],
  };
}

/** A IA do 049 no registro de `ai/chefes.ts`. */
export const IA_049: IaDeChefe = {
  avancar: avancarChefe049,
  criarEstado: criarEstado049,
  retomar: retomarChefe049,
  despertar: despertarChefe049,
};

// Chefe da fase 1 (entidade 096): inerte até ser visto, persegue sabendo onde o jogador está,
// arromba portas e, na arena, alterna investidas e pausas. Lógica pura.
import { CHEFE_096, IA, JOGADOR, NUVEM, PORTA } from '../balance';
import { comandarPorta, solidoDe } from '../doors';
import type { SimEvent } from '../eventos';
import type { Area } from '../fase';
import {
  alturaPiso, caminho, CELL, coordDe, DEGRAU, moverComColisao, SALTO, visivel, type Solido, type Vec2,
} from '../grid';
import { celulaFechada } from '../perigos';
import { frente } from '../player';
import type { EstadoChefe, FaseChefe, Inimigo, ModoIA, World } from '../world';
import { ferirJogador } from './comum';
import { andar, celulaMaisProxima, encarar, linhaAndavel } from './movimento';
import { distanciaJogador, linhaDeVisao } from './percepcao';
import { tipoDe, type TipoInimigo } from './tipos';

/** O `Inimigo.modo` do chefe é derivado da fase (para as views e a tensão). */
const MODO: Record<FaseChefe, ModoIA> = {
  inerte: 'patrulha', despertando: 'suspeita', pausa: 'suspeita',
  perseguicao: 'perseguicao', investida: 'perseguicao', arrombando: 'ataque', morto: 'morto',
};

export function modoDoChefe(f: FaseChefe): ModoIA {
  return MODO[f];
}

/** Folga além do raio do corpo para contar como encostado na porta (maior que o passo de um quadro a 12 m/s, 0,2 m). */
const FOLGA_PORTA = 0.3;

/** Ângulo em (-π, π]. */
function normalizar(a: number): number {
  const v = a % (2 * Math.PI);
  if (v > Math.PI) return v - 2 * Math.PI;
  if (v <= -Math.PI) return v + 2 * Math.PI;
  return v;
}

/** Yaw de quem olha na direção (dx, dz), com frente = (-sin yaw, -cos yaw). */
function yawPara(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

function naArea(p: Vec2, a: Area): boolean {
  const [col, row] = coordDe(p);
  return col >= a[0] && col < a[0] + a[2] && row >= a[1] && row < a[1] + a[3];
}

function inimigoDoChefe(w: World, c: EstadoChefe): Inimigo | undefined {
  return w.inimigos.find((i) => i.id === c.inimigoId);
}

/**
 * O jogador mira no chefe: o olhar 3D (yaw e pitch) fica a até `olharAngulo` do vetor dos olhos
 * do jogador à cabeça do chefe (`y + altura * IA.olhos`), e a cabeça está visível.
 */
function miradoPeloJogador(w: World, i: Inimigo): boolean {
  const j = w.jogador;
  const olhos = j.y + JOGADOR.olhos;
  const cabeca = i.y + tipoDe(i.tipo).altura * IA.olhos;
  const dx = i.pos.x - j.pos.x;
  const dy = cabeca - olhos;
  const dz = i.pos.z - j.pos.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > 1e-6) {
    const f = frente(j.yaw);
    const cp = Math.cos(j.pitch);
    const cos = (f.x * cp * dx + Math.sin(j.pitch) * dy + f.z * cp * dz) / d;
    if (cos < Math.cos(CHEFE_096.olharAngulo)) return false;
  }
  return visivel(w.grid, j.pos, i.pos, solidoDe(w), olhos, cabeca);
}

/** Dá para investir: vê o jogador e a linha reta até ele é andável (sem janela, grade, degrau alto nem queda > SALTO). */
function podeInvestir(w: World, i: Inimigo): boolean {
  return linhaDeVisao(w, i) && linhaAndavel(w, i, w.jogador.pos);
}

/** O jogador está ao alcance `alcance` em planta e na mesma faixa de altura. */
function aoAlcance(w: World, i: Inimigo, t: TipoInimigo, alcance: number): boolean {
  return distanciaJogador(w, i) <= alcance && Math.abs(w.jogador.y - i.y) <= t.altura / 2;
}

// --- transições ------------------------------------------------------------------------------

/**
 * Se o `Inimigo` do chefe está morto e a fase ainda não, passa a `morto` com `chefe_morto` (uma vez).
 * Chamada no passo do chefe e logo depois de dano fora dele (comporta), para valer no mesmo passo.
 */
export function confirmarMorteChefe(w: World): SimEvent[] {
  const c = w.chefe;
  if (!c || c.fase === 'morto') return [];
  const i = inimigoDoChefe(w, c);
  if (!i || i.modo !== 'morto') return [];
  c.fase = 'morto';
  c.portaAlvo = null;
  c.investida = null;
  return [{ tipo: 'chefe_morto' }];
}

/** Desperta o chefe inerte (evento `chefe_desperta`). Sem chefe, ou já acordado, nada. */
export function despertarChefe(w: World): SimEvent[] {
  const c = w.chefe;
  if (!c || c.fase !== 'inerte') return [];
  c.fase = 'despertando';
  c.timer = CHEFE_096.despertar;
  const i = inimigoDoChefe(w, c);
  if (i && i.modo !== 'morto') i.modo = MODO.despertando;
  return [{ tipo: 'chefe_desperta' }];
}

function entrarPerseguicao(c: EstadoChefe, i: Inimigo): void {
  c.fase = 'perseguicao';
  c.timer = 0;   // na perseguição, o timer é o preparo do golpe
  c.portaAlvo = null;
  c.investida = null;
  i.rotaEm = 0;
}

function entrarPausa(c: EstadoChefe): void {
  c.fase = 'pausa';
  c.timer = CHEFE_096.pausa;
  c.investida = null;
}

/** Investida na direção do jogador de agora: `preparoInvestida` s parado e depois a corrida. */
function entrarInvestida(w: World, c: EstadoChefe, i: Inimigo): SimEvent[] {
  const dx = w.jogador.pos.x - i.pos.x;
  const dz = w.jogador.pos.z - i.pos.z;
  const d = Math.hypot(dx, dz);
  const dir = d > 1e-6 ? { x: dx / d, z: dz / d } : frente(i.yaw);
  c.fase = 'investida';
  // preparo parado antes de correr (o urro sai agora); a direção fica a do início do preparo
  c.timer = CHEFE_096.investidaMax + CHEFE_096.preparoInvestida;
  c.investida = dir;
  i.yaw = yawPara(dir.x, dir.z);
  return [{ tipo: 'chefe_investida' }];
}

// --- fases -----------------------------------------------------------------------------------

/** Parado, de costas. Desperta com a mira acumulada, com o jogador perto ou com qualquer dano. */
function inerte(w: World, c: EstadoChefe, i: Inimigo, t: TipoInimigo, dt: number): SimEvent[] {
  if (miradoPeloJogador(w, i)) c.olhar += dt;
  const ferido = i.vida < t.vida;   // a vida só cai enquanto inerte: dano por tiro, nuvem ou comporta
  if (c.olhar >= CHEFE_096.olharTempo || distanciaJogador(w, i) <= CHEFE_096.distanciaDespertar || ferido) {
    return despertarChefe(w);
  }
  return [];
}

/** Parado, virando para o jogador (meia-volta no tempo todo); depois persegue. */
function despertando(w: World, c: EstadoChefe, i: Inimigo, dt: number): SimEvent[] {
  const alvo = yawPara(w.jogador.pos.x - i.pos.x, w.jogador.pos.z - i.pos.z);
  const giro = (Math.PI / CHEFE_096.despertar) * dt;
  const falta = normalizar(alvo - i.yaw);
  i.yaw = normalizar(i.yaw + Math.max(-giro, Math.min(giro, falta)));
  c.timer -= dt;
  if (c.timer <= 0) entrarPerseguicao(c, i);
  return [];
}

/**
 * Sabe sempre onde o jogador está. Na arena, com linha de visão, investe. A `alcanceAtaque`,
 * golpeia como os inimigos comuns: `preparo` virado para ele (em `c.timer`), golpe se ainda está a
 * `alcanceAtaque * 1.2`, e `espera = cadencia`. Senão, segue a rota.
 */
function perseguir(w: World, c: EstadoChefe, i: Inimigo, t: TipoInimigo, vel: number, dt: number): SimEvent[] {
  const j = w.jogador;
  if (c.timer > 0) {
    encarar(i, j.pos);
    c.timer -= dt;
    if (c.timer > 0) return [];
    c.timer = 0;
    i.espera = t.cadencia;
    return aoAlcance(w, i, t, t.alcanceAtaque * 1.2) ? ferirJogador(w, t.dano, i.pos) : [];
  }
  if (c.naArena && podeInvestir(w, i)) return entrarInvestida(w, c, i);
  if (aoAlcance(w, i, t, t.alcanceAtaque)) {
    encarar(i, j.pos);
    if (i.espera > 0) return [];
    c.timer = t.preparo;
    return [{ tipo: 'inimigo_ataque', id: i.id }];
  }
  return seguirRota(w, c, i, t, vel, dt);
}

/** Para a rota do chefe, portas não contam (ele arromba): só as células fechadas por perigo. */
function solidoRotaChefe(w: World): Solido {
  return (col, row) => celulaFechada(w, col, row);
}

/**
 * Em linha reta quando dá; senão pela rota (recalculada a cada `IA.intervaloRota`), que passa por
 * portas fechadas e trancadas. Encostado numa porta da rota que não está abrindo: arromba. Sem
 * rota até o jogador, vai ao `refugio` (célula alcançável mais próxima dele) e espera virado para
 * ele; a cada recálculo tenta de novo a rota até o jogador.
 */
function seguirRota(w: World, c: EstadoChefe, i: Inimigo, t: TipoInimigo, vel: number, dt: number): SimEvent[] {
  const j = w.jogador;
  if (linhaAndavel(w, i, j.pos)) {
    i.rota = [];
    andar(w, i, j.pos, vel, dt);
    return [];
  }
  if (i.rotaEm <= 0) {
    const solido = solidoRotaChefe(w);
    let rota = caminho(w.grid, i.pos, j.pos, DEGRAU, solido, SALTO);
    let destino = j.pos;
    i.refugio = null;
    if (rota === null) {
      // jogador inalcançável: vai à célula alcançável mais próxima dele e espera ali
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
    return [];
  }
  const [col, row] = coordDe(prox);
  const porta = w.portas.find((p) => p.coord[0] === col && p.coord[1] === row);
  if (porta && porta.abertura < PORTA.livreEm) {
    if (porta.estado === 'abrindo') {
      encarar(i, prox);
      return [];
    }
    if (Math.hypot(prox.x - i.pos.x, prox.z - i.pos.z) <= CELL / 2 + t.raio + FOLGA_PORTA) {
      c.fase = 'arrombando';
      c.timer = CHEFE_096.arrombar;
      c.portaAlvo = porta.id;
      encarar(i, prox);
      return [{ tipo: 'chefe_arromba', porta: porta.id }];
    }
  }
  if (andar(w, i, prox, vel, dt)) i.rota.shift();
  if (i.rota.length === 0 && i.refugio) encarar(i, j.pos);
  return [];
}

/**
 * `arrombar` segundos na porta; depois ela abre, mesmo trancada, e ele volta a perseguir. Se ela
 * já deixa passar (aberta por outro), volta a perseguir na hora.
 */
function arrombando(w: World, c: EstadoChefe, i: Inimigo, dt: number): SimEvent[] {
  const porta = w.portas.find((p) => p.id === c.portaAlvo);
  if (porta && porta.abertura >= PORTA.livreEm) {
    entrarPerseguicao(c, i);
    return [];
  }
  c.timer -= dt;
  if (c.timer > 0) return [];
  const id = c.portaAlvo;
  entrarPerseguicao(c, i);
  return id ? comandarPorta(w, id, 'abrir') : [];
}

/** Componente da direção acima disto conta para dizer que a colisão parou aquele eixo. */
const EIXO_RELEVANTE = 0.2;

/**
 * Bateu: a colisão zerou um eixo em que a direção tem componente relevante (assim não escorrega
 * pela parede em ângulo), ou andou menos de 90% do passo.
 */
function bateu(antes: Vec2, depois: Vec2, dir: Vec2, passo: number): boolean {
  const mx = depois.x - antes.x;
  const mz = depois.z - antes.z;
  if (Math.abs(dir.x) > EIXO_RELEVANTE && Math.abs(mx) < Math.abs(dir.x * passo) * 0.5) return true;
  if (Math.abs(dir.z) > EIXO_RELEVANTE && Math.abs(mz) < Math.abs(dir.z * passo) * 0.5) return true;
  return Math.hypot(mx, mz) < passo * 0.9;
}

/**
 * Depois do preparo (`c.timer` acima de `investidaMax`), corre em linha reta a `investidaVel` por até `investidaMax` ou até bater (`bateu`). Passando a `investidaGolpe` do jogador, golpeia uma vez. Depois, pausa.
 */
function investir(w: World, c: EstadoChefe, i: Inimigo, t: TipoInimigo, lentidao: number, dt: number): SimEvent[] {
  const dir = c.investida;
  if (!dir) {
    entrarPausa(c);
    return [];
  }
  if (c.timer > CHEFE_096.investidaMax) {
    // preparo: parado, virado para a direção da investida
    c.timer -= dt;
    return [];
  }
  const passo = CHEFE_096.investidaVel * lentidao * dt;
  const antes = i.pos;
  i.pos = moverComColisao(w.grid, i.pos, i.y, dir.x * passo, dir.z * passo, t.raio, DEGRAU, solidoDe(w));
  i.y = alturaPiso(w.grid, i.pos);
  if (aoAlcance(w, i, t, CHEFE_096.investidaGolpe)) {
    entrarPausa(c);
    return ferirJogador(w, t.dano, i.pos);
  }
  c.timer -= dt;
  if (bateu(antes, i.pos, dir, passo) || c.timer <= 0) entrarPausa(c);
  return [];
}

/** Parado, encolhido. Depois investe de novo se pode (`podeInvestir`); senão, persegue. */
function pausar(w: World, c: EstadoChefe, i: Inimigo, dt: number): SimEvent[] {
  c.timer -= dt;
  if (c.timer > 0) return [];
  if (podeInvestir(w, i)) return entrarInvestida(w, c, i);
  entrarPerseguicao(c, i);
  return [];
}

/**
 * Um passo do chefe 096. O `Inimigo` morto (tiro, comporta, robô) leva à fase `morto`, com
 * `chefe_morto` uma vez. Ao fim, `i.modo` segue a fase (`modoDoChefe`).
 */
export function avancarChefe096(w: World, i: Inimigo, dt: number): SimEvent[] {
  const c = w.chefe;
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
      eventos = inerte(w, c, i, t, dt);
      break;
    case 'despertando':
      eventos = despertando(w, c, i, dt);
      break;
    case 'perseguicao':
      eventos = perseguir(w, c, i, t, CHEFE_096.velocidadePerseguicao * lentidao, dt);
      break;
    case 'arrombando':
      eventos = arrombando(w, c, i, dt);
      break;
    case 'investida':
      eventos = investir(w, c, i, t, lentidao, dt);
      break;
    case 'pausa':
      eventos = pausar(w, c, i, dt);
      break;
    case 'morto':
      break;
  }
  i.modo = MODO[c.fase];
  return faseAntes === 'perseguicao' || faseAntes === 'investida' ? [...eventos, ...contarPassos(c, antes, i.pos)] : eventos;
}

/** Soma o que andou; a cada `passoMetros`, um `chefe_passo` na posição dele (o áudio toca o passo pesado). */
function contarPassos(c: EstadoChefe, antes: Vec2, agora: Vec2): SimEvent[] {
  c.passo += Math.hypot(agora.x - antes.x, agora.z - antes.z);
  if (c.passo < CHEFE_096.passoMetros) return [];
  c.passo %= CHEFE_096.passoMetros;
  return [{ tipo: 'chefe_passo', pos: { x: agora.x, z: agora.z } }];
}

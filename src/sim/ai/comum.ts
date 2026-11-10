// IA comum dos inimigos: criação, máquina de estados, ataque e dano ao jogador. Lógica pura.
// Percepção em `percepcao.ts`; movimento, rota e portas em `movimento.ts`.
import { IA, NUVEM } from '../balance';
import { absorver } from '../damage';
import type { SimEvent } from '../eventos';
import type { InimigoDef } from '../fase';
import { alturaPiso, caminho, centro, DEGRAU, SALTO, type Vec2 } from '../grid';
import { ouve } from '../noise';
import { resolverOnde } from '../onde';
import { frente } from '../player';
import type { Inimigo, World } from '../world';
import { iaDeChefe } from './chefes';
import { celulaMaisProxima, encarar, irPara, normalizar, recuar, solidoRota } from './movimento';
import { alcanceVisao, distanciaJogador, linhaDeVisao, tiroLivre, ve } from './percepcao';
import { tipoDe, type TipoInimigo } from './tipos';

export { ve } from './percepcao';

type Ruido = { pos: Vec2; raio: number };

function copia(p: Vec2): Vec2 {
  return { x: p.x, z: p.z };
}

/**
 * Cria o inimigo no centro da célula. Não o põe em `w.inimigos`: quem chama adiciona (`adicionarInimigo`).
 * Corpo (`corpo: true`) nasce `morto`, sem vida; tipo `deitado` nasce sempre `dormindo`.
 */
export function criarInimigo(w: World, def: InimigoDef): Inimigo {
  const tipo = tipoDe(def.tipo);
  const pos = centro(resolverOnde(w.grid, def.em));
  const modo = def.corpo ? 'morto' : def.dormindo || tipo.deitado ? 'dormindo' : 'patrulha';
  return {
    id: w.proximoId++, tipo: def.tipo, grupo: def.grupo ?? null, pos, y: alturaPiso(w.grid, pos),
    yaw: def.yaw ?? 0, vida: def.corpo ? 0 : tipo.vida, modo, timer: 0, espera: 0,
    alvo: null, rota: [], rotaEm: 0, patrulha: (def.patrulha ?? []).map(centro), patrulhaI: 0, lento: 0,
    ultimoVisto: null, semVer: 0, semRota: false, destinoRota: null, rotasCalculadas: 0, alertado: false,
    refugio: null,
    // quem cria conta em `stats.totalInimigos` na hora; corpo (`corpo: true`) só ao levantar (C3.2)
    jaMorreu: false, contado: def.corpo !== true,
  };
}

/** Cria o inimigo, põe em `w.inimigos` e conta em `stats.totalInimigos` (corpo não conta até levantar). */
export function adicionarInimigo(w: World, def: InimigoDef): Inimigo {
  const i = criarInimigo(w, def);
  w.inimigos.push(i);
  if (i.contado) w.stats.totalInimigos++;
  return i;
}

/**
 * Começa a levantar (`levantando` por `tempo` s: não anda nem ataca; depois persegue). Emite `inimigo_levanta`.
 * Usado pelo emboscador deitado ao perceber o jogador e pelo chefe 049 ao reanimar um corpo.
 */
export function entrarLevantando(i: Inimigo, tempo: number): SimEvent[] {
  i.modo = 'levantando';
  i.timer = tempo;
  i.alvo = null;
  i.rota = [];
  return [{ tipo: 'inimigo_levanta', id: i.id }];
}

/**
 * Golpe no jogador: passa pelo colete (`absorver`) e emite `dano_jogador` com a origem.
 * Vida zero encerra o jogo (`jogador_morto` uma vez só). Com o jogo parado, nada.
 */
export function ferirJogador(w: World, dano: number, de: Vec2): SimEvent[] {
  return desgastarJogador(w, dano, de, true);
}

/**
 * Dano contínuo (perigo de área, um pouco a cada passo): como `ferirJogador`, mas `dano_jogador`
 * só sai com `avisar` (pulsos, para o HUD e o som de dor não dispararem a cada passo) ou na morte,
 * com `quantia` (padrão: o dano deste passo; o perigo passa o acumulado do pulso).
 */
export function desgastarJogador(w: World, dano: number, de: Vec2, avisar: boolean, quantia: number = dano): SimEvent[] {
  if (w.estado !== 'jogando' || dano <= 0) return [];
  const j = w.jogador;
  const r = absorver({ vida: j.vida, colete: j.colete }, dano);
  j.vida = r.vida;
  j.colete = r.colete;
  const eventos: SimEvent[] = [];
  if (avisar || j.vida <= 0) eventos.push({ tipo: 'dano_jogador', quantia, de: copia(de) });
  if (j.vida <= 0) {
    w.estado = 'morto';
    eventos.push({ tipo: 'jogador_morto' });
  }
  return eventos;
}

// --- transições ------------------------------------------------------------------------------

/**
 * Sem `ultimoVisto` (entrou na perseguição por dano, sem nunca ter visto o jogador), grava onde
 * o jogador está agora. Transições não mexem na rota nem em `rotaEm`: a rota antiga segue até o
 * próximo cálculo, que `irPara` faz para o destino novo (apagá-la deixaria o inimigo parado).
 */
function entrarPerseguicao(w: World, i: Inimigo): void {
  i.modo = 'perseguicao';
  i.timer = 0;
  i.semVer = 0;
  i.alvo = null;
  i.ultimoVisto ??= copia(w.jogador.pos);
}

function entrarSuspeita(i: Inimigo, alvo: Vec2): void {
  i.modo = 'suspeita';
  i.alvo = copia(alvo);
  i.timer = 0;
}

/** Volta à patrulha esquecendo o jogador: o próximo alerta sai de novo. */
function voltarAPatrulha(i: Inimigo): void {
  i.modo = 'patrulha';
  i.alvo = null;
  i.timer = 0;
  i.ultimoVisto = null;
  i.alertado = false;
}

function alerta(i: Inimigo): SimEvent[] {
  i.alertado = true;
  return [{ tipo: 'inimigo_alerta', id: i.id }];
}

/** Viu o jogador (vindo de patrulha ou suspeita): persegue; alerta uma vez por ciclo, até voltar à patrulha. */
function alertar(w: World, i: Inimigo): SimEvent[] {
  i.ultimoVisto = copia(w.jogador.pos);
  entrarPerseguicao(w, i);
  return i.alertado ? [] : alerta(i);
}

/** Fim da dor: persegue; se ainda não tinha alertado (dormia ou patrulhava), alerta agora. */
function sairDaDor(w: World, i: Inimigo): SimEvent[] {
  entrarPerseguicao(w, i);
  return i.alertado ? [] : alerta(i);
}

/** O emboscador não sai da emboscada por ruído vindo de mais longe que `IA.emboscadaCostas`. */
function escuta(w: World, i: Inimigo, r: Ruido): boolean {
  const longe = Math.hypot(r.pos.x - i.pos.x, r.pos.z - i.pos.z) > IA.emboscadaCostas;
  if (longe && tipoDe(i.tipo).arquetipo === 'emboscador') return false;
  return ouve(w, i, r);
}

function entrarAtaque(i: Inimigo, t: TipoInimigo): SimEvent[] {
  i.modo = 'ataque';
  i.timer = t.preparo;
  return [{ tipo: 'inimigo_ataque', id: i.id }];
}

// --- estados ---------------------------------------------------------------------------------

/**
 * Só acorda com dano (via `ferirInimigo`) ou com ruído a até `IA.acordar` do raio. O deitado também
 * percebe o jogador pela vista (regra do emboscador) e, percebendo, levanta antes de perseguir.
 */
function dormir(w: World, i: Inimigo, ruidos: readonly Ruido[]): SimEvent[] {
  const perto = ruidos.find((r) => escuta(w, i, { pos: r.pos, raio: r.raio * IA.acordar }));
  if (tipoDe(i.tipo).deitado) return perto || ve(w, i) ? entrarLevantando(i, IA.levantar) : [];
  if (perto) entrarSuspeita(i, perto.pos);
  return [];
}

/** Parado, levantando: no fim do `timer`, persegue (e alerta, se ainda não alertou). */
function levantar(w: World, i: Inimigo, dt: number): SimEvent[] {
  i.timer -= dt;
  return i.timer <= 0 ? sairDaDor(w, i) : [];
}

/**
 * Segue os pontos de patrulha em laço; sem pontos, ou emboscador, fica parado. Ponto
 * inalcançável (dois cálculos de rota seguidos sem caminho) é pulado.
 */
function patrulhar(w: World, i: Inimigo, vel: number, dt: number): SimEvent[] {
  if (tipoDe(i.tipo).arquetipo === 'emboscador' || i.patrulha.length === 0) return [];
  const ida = irPara(w, i, i.patrulha[i.patrulhaI % i.patrulha.length], vel, dt);
  if (ida.chegou || ida.inalcancavel) {
    i.patrulhaI = (i.patrulhaI + 1) % i.patrulha.length;
  }
  return ida.eventos;
}

/**
 * Vai ao `alvo` (inalcançável conta como chegou); lá, olha em volta (`timer` conta o tempo
 * olhando) e volta à patrulha.
 */
function investigar(w: World, i: Inimigo, vel: number, dt: number): SimEvent[] {
  let eventos: SimEvent[] = [];
  if (i.timer <= 0 && i.alvo) {
    const ida = irPara(w, i, i.alvo, vel, dt);
    if (!ida.chegou && !ida.inalcancavel) return ida.eventos;
    eventos = ida.eventos;
  }
  i.timer += dt;
  i.yaw = normalizar(i.yaw + IA.giroOlhando * dt);
  if (i.timer >= IA.olharEmVolta) voltarAPatrulha(i);
  return eventos;
}

/** Patrulha e suspeita: ver leva à perseguição; ouvir leva (ou renova) a suspeita. */
function vigiar(w: World, i: Inimigo, ruidos: readonly Ruido[], vel: number, dt: number): SimEvent[] {
  if (ve(w, i)) return alertar(w, i);
  const ouvido = ruidos.find((r) => escuta(w, i, r));
  if (ouvido) entrarSuspeita(i, ouvido.pos);
  return i.modo === 'patrulha'
    ? patrulhar(w, i, vel * IA.fracaoPatrulha, dt)
    : investigar(w, i, vel * IA.fracaoSuspeita, dt);
}

/**
 * Vai atrás do jogador: vendo-o, à posição dele; sem ver, ao `ultimoVisto`. Ao chegar lá (ou se lá
 * é inalcançável) ainda sem vê-lo, entra em suspeita nesse ponto. `IA.semVerMax` sem ver é o teto.
 * Avançador e emboscador atacam a `alcanceAtaque` (na mesma faixa de altura). Atirador ataca
 * vendo o jogador a até `alcanceAtaque` com o tiro livre; vendo-o a menos de
 * `distanciaIdeal / 2`, recua; com tiro possível enquanto recarrega, fica parado mirando.
 */
function perseguir(w: World, i: Inimigo, vel: number, dt: number): SimEvent[] {
  const t = tipoDe(i.tipo);
  const j = w.jogador;
  const d = distanciaJogador(w, i);
  const visto = d <= alcanceVisao(w, i) && linhaDeVisao(w, i);
  // posto em perseguição de fora (gatilho, teste) sem nunca ter visto: parte de onde o jogador está
  i.ultimoVisto ??= copia(j.pos);
  if (visto) {
    i.ultimoVisto = copia(j.pos);
    i.semVer = 0;
  } else {
    i.semVer += dt;
    if (i.semVer >= IA.semVerMax) {
      entrarSuspeita(i, i.ultimoVisto);
      return [];
    }
  }

  if (t.arquetipo === 'atirador') {
    const podeAtirar = visto && d <= t.alcanceAtaque && tiroLivre(w, i);
    if (podeAtirar && i.espera <= 0) {
      encarar(i, j.pos);
      return entrarAtaque(i, t);
    }
    if (visto && d < t.distanciaIdeal / 2) {
      recuar(w, i, j.pos, vel, dt);
      return [];
    }
    if (podeAtirar) {
      encarar(i, j.pos);
      return [];
    }
  } else if (d <= t.alcanceAtaque && Math.abs(j.y - i.y) <= t.altura / 2) {
    encarar(i, j.pos);
    return i.espera <= 0 ? entrarAtaque(i, t) : [];
  }
  if (visto && t.arquetipo === 'avancador') return irAoJogador(w, i, vel, dt);
  i.refugio = null;
  const destino = visto ? j.pos : i.ultimoVisto;
  const ida = irPara(w, i, destino, vel, dt);
  if (!visto && (ida.chegou || ida.inalcancavel)) entrarSuspeita(i, destino);
  return ida.eventos;
}

/**
 * Avançador vendo o jogador: rota até ele. Duas falhas seguidas de rota (jogador inalcançável)
 * o levam ao `refugio`, a célula alcançável mais próxima do jogador, onde espera de frente para
 * ele; a cada recálculo de rota (`IA.intervaloRota`), tenta de novo a rota normal.
 */
function irAoJogador(w: World, i: Inimigo, vel: number, dt: number): SimEvent[] {
  const j = w.jogador;
  const recalculo = i.refugio !== null && i.rotaEm <= 0;
  if (recalculo) {
    i.rotasCalculadas++;
    const rota = caminho(w.grid, i.pos, j.pos, DEGRAU, solidoRota(w), SALTO);
    i.refugio = rota === null ? celulaMaisProxima(w, i, j.pos) : null;   // o jogador pode ter andado
  }
  if (!i.refugio) {
    const ida = irPara(w, i, j.pos, vel, dt);
    if (ida.inalcancavel) i.refugio = celulaMaisProxima(w, i, j.pos);
    return ida.eventos;
  }
  const ida = irPara(w, i, i.refugio, vel, dt);
  if (ida.chegou || ida.inalcancavel) encarar(i, j.pos);
  // `irPara` em linha reta não reinicia o intervalo: sem isto, a nova tentativa sairia a cada passo
  if (recalculo) i.rotaEm = Math.max(i.rotaEm, IA.intervaloRota);
  return ida.eventos;
}

/**
 * Projétil do atirador, da altura do disparo até o peito do jogador onde ele está agora. Com `arco`
 * (frasco), parábola até o ponto do jogador no chão: velocidade horizontal fixa e a subida calculada para
 * cair ali; alvo além de `alcanceAtaque` (o alcance do arco), cai no máximo, na mesma direção.
 */
function disparar(w: World, i: Inimigo, t: TipoInimigo, p: NonNullable<TipoInimigo['projetil']>): SimEvent[] {
  const j = w.jogador;
  const dx = j.pos.x - i.pos.x;
  const dz = j.pos.z - i.pos.z;
  const d = Math.hypot(dx, dz);
  const u = d > 1e-6 ? { x: dx / d, z: dz / d } : frente(i.yaw);
  const y = i.y + t.altura * IA.disparo;
  let vy = d > 1e-6 ? (j.y + IA.peitoJogador - y) / (d / p.velocidade) : 0;
  if (p.arco) {
    const alcance = Math.min(d, t.alcanceAtaque);
    const alvo = { x: i.pos.x + u.x * alcance, z: i.pos.z + u.z * alcance };
    const yAlvo = alcance < d ? alturaPiso(w.grid, alvo) : j.y;
    const voo = alcance / p.velocidade;
    // y + vy·T − g·T²/2 = yAlvo
    vy = voo > 1e-6 ? (yAlvo - y + (p.arco.gravidade * voo * voo) / 2) / voo : 0;
  }
  const id = w.proximoId++;
  w.projeteis.push({
    id, de: 'inimigo', tipo: i.tipo, pos: copia(i.pos), y,
    vel: { x: u.x * p.velocidade, z: u.z * p.velocidade }, vy, dano: t.dano, vida: IA.vidaProjetil,
  });
  return [{ tipo: 'projetil', id }];
}

/** Espera o `preparo` virado para o jogador, aplica o golpe e volta a perseguir com `espera = cadencia`. */
function atacar(w: World, i: Inimigo, dt: number): SimEvent[] {
  const t = tipoDe(i.tipo);
  const j = w.jogador;
  encarar(i, j.pos);
  i.timer -= dt;
  if (i.timer > 0) return [];
  entrarPerseguicao(w, i);
  i.espera = t.cadencia;
  if (t.projetil) return disparar(w, i, t, t.projetil);
  const fere = distanciaJogador(w, i) <= t.alcanceAtaque * 1.2 && Math.abs(j.y - i.y) <= t.altura / 2;
  return fere ? ferirJogador(w, t.dano, i.pos) : [];
}

function avancarInimigo(w: World, i: Inimigo, ruidos: readonly Ruido[], dt: number): SimEvent[] {
  if (i.modo === 'morto') return [];
  i.espera = Math.max(0, i.espera - dt);
  i.rotaEm = Math.max(0, i.rotaEm - dt);
  const vel = tipoDe(i.tipo).velocidade * (i.lento > 0 ? NUVEM.lentidao : 1);
  i.lento = Math.max(0, i.lento - dt);
  switch (i.modo) {
    case 'dormindo':
      return dormir(w, i, ruidos);
    case 'levantando':
      return levantar(w, i, dt);
    case 'patrulha':
    case 'suspeita':
      return vigiar(w, i, ruidos, vel, dt);
    case 'perseguicao':
      return perseguir(w, i, vel, dt);
    case 'ataque':
      return atacar(w, i, dt);
    case 'dor':
      i.timer -= dt;
      return i.timer <= 0 ? sairDaDor(w, i) : [];
  }
}

/**
 * Um passo de todos os inimigos. O inimigo do chefe (`w.chefe.inimigoId`) vai para a IA do tipo
 * dele (`ai/chefes.ts`). Com o jogo parado (`estado !== 'jogando'`), nada acontece.
 */
export function avancarInimigos(w: World, ruidos: readonly Ruido[], dt: number): SimEvent[] {
  const eventos: SimEvent[] = [];
  for (const i of w.inimigos) {
    if (w.estado !== 'jogando') break;
    const chefe = w.chefe?.inimigoId === i.id ? iaDeChefe(w.chefe.tipo) : null;
    eventos.push(...(chefe ? chefe.avancar(w, i, dt) : avancarInimigo(w, i, ruidos, dt)));
  }
  return eventos;
}

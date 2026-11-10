// Uma fase carregada na cena: malha estática, portas, comportas, props e placas, pickups, objetos, luzes, decalques e as
// views dinâmicas (inimigos, projéteis e nuvens, partículas, armas em primeira pessoa). Só lê o World (passado a cada quadro; nada dele é guardado entre quadros).
// `dispose()` tira tudo do grafo e libera cada geometria, material, textura, luz e instância.
import { Group, type PerspectiveCamera, type Scene } from 'three';
import type { SimEvent } from '../sim/eventos';
import type { LevelDef } from '../sim/fase';
import type { World } from '../sim/world';
import { ClaraoCano } from './lights';
import type { MaterialBank } from './materials';
import type { Textures } from './textures';
import { ArmasView } from './view/armas';
import { ComportasView } from './view/comportas';
import { DecalsView } from './view/decals';
import { construirFase, malhasInstanciadas } from './view/faseMesh';
import { Coletor } from './view/geometria';
import { InimigosView } from './view/inimigos';
import { LuzesFase } from './view/luzes';
import { construirObjetos } from './view/objetos';
import { ParticulasView } from './view/particulas';
import { PickupsView } from './view/pickups';
import { PortasView } from './view/portas';
import { construirProps } from './view/props';
import { ProjeteisView } from './view/projeteis';
import { Recursos } from './view/recursos';

/** Slots da malha estática que não projetam sombra. */
const SEM_SOMBRA = new Set(['vidro', 'tela', 'papel']);

export class LevelRuntime {
  readonly fase: LevelDef;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly rec: Recursos;
  private readonly raiz = new Group();
  private readonly portas: PortasView;
  private readonly comportas: ComportasView;
  private readonly pickups: PickupsView;
  private readonly luzes: LuzesFase;
  private readonly inimigos: InimigosView;
  private readonly projeteis: ProjeteisView;
  private readonly particulas: ParticulasView;
  private readonly decals: DecalsView;
  private readonly armas: ArmasView;
  private readonly clarao: ClaraoCano;
  private t = 0;
  private descartado = false;

  constructor(deps: {
    scene: Scene; camera: PerspectiveCamera; bank: MaterialBank; texturas: Textures; fase: LevelDef; world: World;
  }) {
    const { scene, camera, bank, fase, world } = deps;
    this.scene = scene;
    this.camera = camera;
    this.fase = fase;
    this.rec = new Recursos(bank);
    this.raiz.name = `fase:${fase.id}`;

    // falhou no meio (fase inválida): libera o que já foi registrado e relança
    let clarao: ClaraoCano | null = null;
    let armas: ArmasView | null = null;
    try {
      const co = new Coletor();
      const instancias = construirFase(world.grid, co);
      this.portas = new PortasView(world, this.rec, co, this.raiz);
      construirObjetos(fase, world.grid, co);
      co.finalizar(this.rec, this.raiz, SEM_SOMBRA);
      malhasInstanciadas(instancias, this.rec, this.raiz);
      this.comportas = new ComportasView(fase, world.grid, this.rec, this.raiz);
      construirProps(fase, world.grid, this.rec, this.raiz);

      this.pickups = new PickupsView(world, this.rec, this.raiz);
      this.luzes = new LuzesFase(fase, world.grid, this.rec, this.raiz);
      this.decals = new DecalsView(fase, world.grid, this.rec, this.raiz, camera);
      this.inimigos = new InimigosView(this.rec, this.raiz);
      this.projeteis = new ProjeteisView(this.rec, this.raiz, camera);
      this.particulas = new ParticulasView(this.rec, this.raiz, camera);
      // presos à câmera (fora da raiz): descartados à parte
      clarao = new ClaraoCano(camera);
      armas = new ArmasView(this.rec, camera, clarao);
      this.clarao = clarao;
      this.armas = armas;
      scene.add(this.raiz);
      this.sincronizar(world, [], 0, 0);
    } catch (e) {
      armas?.dispose();
      clarao?.dispose();
      scene.remove(this.raiz);
      this.rec.dispose();
      this.raiz.clear();
      throw e;
    }
  }

  /** Multiplicadores do filtro e a opção de reduzir flashes. */
  configurarLuzes(multiplicador: number, emissivo: number, reduzirFlashes: boolean): void {
    this.luzes.configurar(multiplicador, emissivo, reduzirFlashes);
    this.inimigos.configurar(reduzirFlashes);
    this.comportas.configurar(reduzirFlashes);
    this.armas.configurar(reduzirFlashes, multiplicador);
  }

  /**
   * Atualiza as views a partir do World. `eventos`: os dos passos deste quadro (inimigos, armas,
   * partículas e decalques reagem a eles); `alfa`: fração do passo para interpolar; `dt`: tempo
   * real do quadro.
   */
  sincronizar(world: World, eventos: readonly SimEvent[], alfa: number, dt: number): void {
    this.t += dt;
    this.portas.sincronizar(world);
    this.comportas.sincronizar(world);
    this.pickups.sincronizar(world, this.t);
    this.luzes.sincronizar(world, this.camera.position, this.t);
    this.inimigos.sincronizar(world, eventos, dt, alfa);
    this.projeteis.sincronizar(world, dt, alfa);
    this.particulas.sincronizar(world, eventos, dt);
    this.decals.sincronizar(world, eventos);
    this.armas.sincronizar(world, eventos, dt);
  }

  /** Arma em primeira pessoa visível (só em jogo). */
  mostrarArmas(v: boolean): void {
    this.armas.exibir(v);
  }

  /** Zera as views dinâmicas (depois de `restaurarCheckpoint`: ids reaproveitados, arrays trocados). */
  reconstruirDinamicos(world: World): void {
    this.inimigos.limpar();
    this.comportas.reiniciar();
    this.projeteis.limpar();
    this.particulas.limpar();
    this.decals.limparMarcas();
    this.armas.reiniciar();
    this.sincronizar(world, [], 0, 0);
  }

  dispose(): void {
    if (this.descartado) return;
    this.descartado = true;
    this.scene.remove(this.raiz);
    this.inimigos.dispose();
    this.armas.dispose();
    this.clarao.dispose();
    this.rec.dispose();
    this.raiz.clear();
  }
}

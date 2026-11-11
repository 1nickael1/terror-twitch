'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FASES } from '../levels/indice';
import { STYLES } from '../looks/registry';
import { AvisoToque, useSoToque } from './AvisoToque';
import { Documento } from './Documento';
import { EngineStore } from './engineStore';
import { Final, FimDeFase } from './FimDeFase';
import css from './game.module.css';
import { Hud } from './Hud';
import { Menu } from './Menu';
import { Morte } from './Morte';
import { Pausa } from './Pausa';

/** Canvas da engine + a tela atual (a máquina de telas mora no `Game`; aqui só se desenha). */
export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [store] = useState(() => new EngineStore(STYLES));
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const soToque = useSoToque();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void store.attach(canvas);
    return () => store.detach();
  }, [store]);

  // em jogo, nenhum botão fica com o foco (Enter, Espaço e E iriam para ele, não para o jogo)
  useEffect(() => {
    if (snap.tela === 'jogando' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [snap.tela]);

  const comando = store.comando.bind(store);
  const definirOpcoes = store.definirOpcoes.bind(store);
  const t = snap.tela;
  const comHud = t === 'jogando' || t === 'pausa' || t === 'documento' || t === 'morte';

  let tela: React.ReactNode = null;
  if (snap.pronto) {
    if (t === 'titulo') {
      tela = soToque
        ? <AvisoToque />
        : <Menu progresso={snap.progresso} opcoes={snap.opcoes} comando={comando} definirOpcoes={definirOpcoes} />;
    } else if (t === 'pausa') {
      tela = (
        <Pausa nomeFase={snap.nomeFase} estande={snap.fase < 0} travaRecusada={snap.travaRecusada} opcoes={snap.opcoes}
          comando={comando} definirOpcoes={definirOpcoes} />
      );
    } else if (t === 'documento' && snap.documento) {
      tela = (
        <Documento doc={snap.documento} fechar={() => comando({ c: 'fechar_documento' })}
          fecharParaPausa={() => store.fecharDocumentoParaPausa()} />
      );
    } else if (t === 'morte') {
      tela = <Morte />;
    } else if (t === 'fim_de_fase') {
      tela = (
        <FimDeFase nomeFase={snap.nomeFase} stats={snap.stats} totais={snap.totais}
          ultima={snap.fase >= FASES.length - 1} comando={comando} />
      );
    } else if (t === 'final') {
      tela = <Final comando={comando} />;
    }
  }

  return (
    <main className={css.root}>
      <canvas ref={canvasRef} className={css.canvas} aria-label="Cena do jogo" />
      {!snap.pronto && <section className={css.carregamento} aria-label="Carregamento do jogo" aria-busy={!snap.erro}>
        <div className={css.carregamentoPainel}>
          <p className={css.carregamentoEtiqueta}>FUNDAÇÃO SCP / ACESSO RESTRITO</p>
          <h1>SCP TERROR</h1>
          <h2>{snap.erro ? 'Falha no carregamento' : 'Preparando a instalação'}</h2>
          {snap.erro ? <>
            <p role="alert">{snap.erro}</p>
            <button className={css.carregamentoBotao} onClick={() => { if (canvasRef.current) void store.attach(canvasRef.current); }}>Tentar novamente</button>
          </> : <>
            <p>Baixando texturas, modelos e sons. O jogo começa quando tudo estiver pronto.</p>
            <div className={css.carregamentoNumeros}><span>{snap.carregamento.concluidos} / {snap.carregamento.total || '…'} recursos</span><strong>{snap.carregamento.total ? Math.floor(snap.carregamento.concluidos / snap.carregamento.total * 100) : 0}%</strong></div>
            <progress className={css.carregamentoBarra} aria-label="Progresso do carregamento" max={Math.max(1, snap.carregamento.total)} value={snap.carregamento.concluidos} />
            <p className={css.carregamentoDica}>O primeiro acesso pode demorar um pouco mais.</p>
          </>}
        </div>
      </section>}
      {snap.pronto && comHud && <Hud snap={snap} />}
      {tela}
    </main>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MaterialBank } from '../engine/materials';
import { Recursos } from '../engine/view/recursos';
import { CarregamentoAssets } from '../engine/carregamentoAssets';
import { AcervoChefePrevia, type InstanciaChefePrevia } from '../engine/view/chefePrevia';
import styles from './previaChefe.module.css';

const NOMES: Record<string, string> = {
  Running: 'Corrida', Walking: 'Caminhada', Right_Hand_Sword_Slash: 'Golpe com o braço direito',
  Skill_01: 'Habilidade / ataque', Strangled_and_Fall_Forward: 'Queda para a frente',
  Walking_Scan_with_Sudden_Look_Back: 'Caminhar observando e olhar para trás', run_fast_2: 'Corrida rápida 2',
};
const SUGESTOES = [
  ['Caminhada', 'Walking'], ['Corrida alternativa', 'Running'], ['Perseguição / investida', 'run_fast_2'],
  ['Ataque', 'Right_Hand_Sword_Slash'], ['Despertar / arrombar (Ataque B)', 'Skill_01'],
  ['Morte', 'Strangled_and_Fall_Forward'], ['Procurando jogador', 'Walking_Scan_with_Sudden_Look_Back'],
];

export function PreviaChefe() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controle = useRef({ clip: 'Walking', serial: 0, pausado: false, velocidade: 1, repetir: true, noLugar: true, buscar: undefined as number | undefined, vista: -1 });
  const [clips, setClips] = useState<{ nome: string; duracao: number }[]>([]);
  const [selecionado, setSelecionado] = useState('Walking');
  const [status, setStatus] = useState('Carregando modelo e texturas…');
  const [pronto, setPronto] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const [repetir, setRepetir] = useState(true);
  const [noLugar, setNoLugar] = useState(true);
  const [tempo, setTempo] = useState(0);
  const duracao = clips.find(c => c.nome === selecionado)?.duracao ?? 0;

  const escolher = (nome: string) => {
    setSelecionado(nome); setTempo(0);
    controle.current.clip = nome; controle.current.buscar = undefined; controle.current.serial++;
  };

  useEffect(() => {
    if (!canvas.current) return;
    const renderer = new WebGLRenderer({ canvas: canvas.current, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true;
    renderer.toneMapping = ACESFilmicToneMapping;
    const scene = new Scene(); scene.background = new Color(0x192326);
    const camera = new PerspectiveCamera(38, 1, .05, 100);
    camera.position.set(0, 1.9, -6.4);
    const orbit = new OrbitControls(camera, canvas.current);
    orbit.target.set(0, 1.2, 0); orbit.enableDamping = true; orbit.minDistance = 1; orbit.maxDistance = 18;
    const hemi = new HemisphereLight(0xdcecff, 0x514839, 2.4);
    const luz = new DirectionalLight(0xffe5c4, 3.8); luz.position.set(-3, 6, -4); luz.castShadow = true;
    luz.shadow.mapSize.set(1024, 1024);
    const recorte = new DirectionalLight(0x8db5db, 2); recorte.position.set(2, 4, 3);
    scene.add(hemi, luz, recorte);
    const bank = new MaterialBank(), rec = new Recursos(bank), lote = new CarregamentoAssets();
    const piso = new Mesh(rec.geo(new PlaneGeometry(60, 60)), rec.mat(new MeshStandardMaterial({ color: 0x303a39, roughness: .9 })));
    piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
    const acervo = new AcervoChefePrevia(bank, lote);
    lote.fechar();
    let instancia: InstanciaChefePrevia | null = null;
    let encerrado = false, raf = 0, antes = performance.now(), serial = -1, ultimaUI = 0;
    const unsubscribe = lote.subscribe(p => setStatus(`Carregando arquivos: ${p.concluidos}/${p.total}`));
    void lote.pronto.then(() => {
      if (encerrado) return;
      instancia = acervo.criar(rec);
      if (!instancia) throw new Error(acervo.erro || 'Modelo indisponível.');
      scene.add(instancia.raiz);
      setClips(instancia.clips.map(c => ({ nome: c.name, duracao: c.duration })));
      setStatus(`${instancia.clips.length} animações · 4 mapas PBR · altura de 2,40 m`); setPronto(true);
    }).catch(erro => { if (!encerrado) setStatus(`Falha ao carregar: ${erro.message}`); });
    const resize = new ResizeObserver(() => {
      if (!canvas.current) return;
      const w = canvas.current.clientWidth, h = canvas.current.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
    });
    resize.observe(canvas.current);
    const frame = (agora: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (agora - antes) / 1000); antes = agora;
      const c = controle.current;
      if (instancia && serial !== c.serial) { instancia.selecionar(c.clip, c.repetir, c.noLugar); serial = c.serial; }
      const t = instancia?.atualizar(dt, c.velocidade, c.pausado, c.buscar) ?? 0;
      c.buscar = undefined;
      if (agora - ultimaUI > 100) { setTempo(t); ultimaUI = agora; }
      if (c.vista >= 0) {
        const a = c.vista * Math.PI / 2;
        orbit.target.set(0, 1.2, 0); camera.position.set(Math.sin(a) * 6.4, 1.9, -Math.cos(a) * 6.4); c.vista = -1;
      }
      orbit.update(); renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      encerrado = true; cancelAnimationFrame(raf); resize.disconnect(); unsubscribe(); lote.cancelar();
      orbit.dispose(); instancia?.dispose(); acervo.dispose(); rec.dispose(); bank.dispose();
      hemi.dispose(); luz.dispose(); recorte.dispose(); renderer.dispose();
    };
  }, []);

  return <main className={styles.pagina}>
    <section className={styles.painel}>
      <p className={styles.legenda}>BANCADA DE ANIMAÇÕES / FASE 1</p>
      <h1>O chefão</h1>
      <p role="status">{status}</p>
      <fieldset disabled={!pronto}>
        <label htmlFor="clip-chefe">Animação original</label>
        <select id="clip-chefe" value={selecionado} onChange={e => escolher(e.target.value)}>
          {!clips.length && <option value="Walking">Carregando…</option>}
          {clips.map(c => <option key={c.nome} value={c.nome}>{NOMES[c.nome] ?? c.nome} · {c.duracao.toFixed(2)} s</option>)}
        </select>
        <p className={styles.codigo}>{selecionado}</p>
        <label><input type="checkbox" checked={pausado} onChange={e => { setPausado(e.target.checked); controle.current.pausado = e.target.checked; }} /> Pausar animação</label>
        <label htmlFor="tempo-chefe">Tempo: {tempo.toFixed(2)} / {duracao.toFixed(2)} s · quadro {Math.round(tempo * 60)}</label>
        <input id="tempo-chefe" type="range" min={0} max={duracao || 1} step={1 / 60} value={Math.min(tempo, duracao)} onChange={e => {
          const t = Number(e.target.value); setTempo(t); setPausado(true); controle.current.pausado = true; controle.current.buscar = t;
        }} />
        <label htmlFor="velocidade-chefe">Velocidade: {velocidade.toFixed(2)}×</label>
        <input id="velocidade-chefe" type="range" min={.1} max={2} step={.05} value={velocidade} onChange={e => { const v = Number(e.target.value); setVelocidade(v); controle.current.velocidade = v; }} />
        <label><input type="checkbox" checked={repetir} onChange={e => { setRepetir(e.target.checked); controle.current.repetir = e.target.checked; controle.current.serial++; }} /> Repetir em loop</label>
        <label><input type="checkbox" checked={noLugar} onChange={e => { setNoLugar(e.target.checked); controle.current.noLugar = e.target.checked; controle.current.serial++; }} /> Manter no lugar (sem deslocamento horizontal)</label>
        <button onClick={() => { controle.current.buscar = undefined; controle.current.serial++; setTempo(0); }}>Reiniciar animação</button>
        <h2>Comparar situações</h2>
        <p>Movimentos usados na campanha. A corrida alternativa continua disponível para comparação.</p>
        <div className={styles.botoes}>{SUGESTOES.map(([nome, clip]) => <button key={nome} aria-pressed={selecionado === clip} onClick={() => escolher(clip)}>{nome}</button>)}</div>
        <p>Este arquivo não tem uma animação de espera parada nem de despertar dedicada.</p>
      </fieldset>
      <h2>Câmera</h2>
      <div className={styles.botoes}>{['Frente', 'Lado', 'Costas'].map((nome, i) => <button key={nome} onClick={() => { controle.current.vista = i; }}>{nome}</button>)}</div>
      <p>Arraste para girar · roda do mouse para aproximar · botão direito para mover a câmera.</p>
      <Link href="/">Voltar ao jogo</Link>
    </section>
    <canvas className={styles.canvas} ref={canvas} aria-label="Pré-visualização 3D do chefão da fase 1" />
  </main>;
}

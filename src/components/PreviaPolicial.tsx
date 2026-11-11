'use client';

import { useEffect, useRef, useState } from 'react';
import { ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer } from 'three';
import { MaterialBank } from '../engine/materials';
import { AcervoPolicial, type InstanciaPolicial } from '../engine/view/policial';
import { Recursos } from '../engine/view/recursos';
import type { ModoIA } from '../sim/world';

const CLIPS = ['Mira', 'TiroParado', 'Walk_Forward_While_Shooting', 'Walking', 'Running', 'Archery_Aim_with_Lateral_Scan', 'Walk_Forward_with_Bow_Aimed', 'Walk_Backward_with_Bow', 'Gunshot_Reaction', 'Dead'] as const;
const NOMES = ['Mira parada (adaptada)', 'Tiro parado (adaptado)', 'Caminhar atirando', 'Caminhada', 'Corrida', 'Mira lateral com rifle (adaptada do arco)', 'Caminhada com rifle (adaptada do arco)', 'Recuo com rifle (adaptado do arco)', 'Reação ao tiro', 'Morte'];

/** Bancada visual local: testa o mesmo acervo, material, esqueleto e controlador usados no jogo. */
export function PreviaPolicial() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const estado = useRef({ clip: 'Mira', serial: 0, disparo: 0, angulo: 0, congelar: false, momento: 20, detalhe: false });
  const [selecionado, setSelecionado] = useState('Mira');
  const [congelar, setCongelar] = useState(false);
  const [momento, setMomento] = useState(20);
  const [status, setStatus] = useState('Carregando o modelo e seus mapas PBR…');
  useEffect(() => {
    if (!canvas.current) return;
    const renderer = new WebGLRenderer({ canvas: canvas.current, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = ACESFilmicToneMapping;
    const scene = new Scene(); scene.background = new Color(0x192326);
    const camera = new PerspectiveCamera(38, 1, .05, 50);
    const bank = new MaterialBank();
    for (const [slot, color] of [['arma', 0x303638], ['arma-detalhe', 0x646b70], ['arma-cabo', 0x171d20]] as const) bank.define(slot, { color, roughness: .75, metalness: .35 });
    const rec = new Recursos(bank);
    const acervo = new AcervoPolicial(bank);
    const hemi = new HemisphereLight(0xdcecff, 0x514839, 2.4);
    const luz = new DirectionalLight(0xffe5c4, 3.8); luz.position.set(-3, 5, -4); luz.castShadow = true;
    luz.shadow.mapSize.set(1024, 1024);
    const recorte = new DirectionalLight(0x8db5db, 2); recorte.position.set(2, 3, 3);
    scene.add(hemi, luz, recorte);
    const piso = new Mesh(rec.geo(new PlaneGeometry(30, 30)), rec.mat(new MeshStandardMaterial({ color: 0x303a39, roughness: .9 })));
    piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
    let instancia: InstanciaPolicial | null = null;
    let encerrado = false, raf = 0, antes = performance.now(), tempo = 0, serial = -1, disparo = 0;
    acervo.pronto.then(() => {
      if (!encerrado) setStatus(acervo.estado === 'pronto' ? 'Modelo do usuário · 8 animações · 4 mapas PBR' : acervo.erro);
    });
    const resize = new ResizeObserver(() => {
      if (!canvas.current) return;
      const w = canvas.current.clientWidth, h = canvas.current.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
      camera.setViewOffset(w, h, -Math.min(150, w * .12), 0, w, h);
    });
    resize.observe(canvas.current);
    const frame = (agora: number) => {
      if (encerrado) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (agora - antes) / 1000); antes = agora;
      if (acervo.estado === 'pronto' && (!instancia || serial !== estado.current.serial)) {
        instancia?.dispose(); instancia = acervo.criar(rec); serial = estado.current.serial; tempo = 0;
        if (instancia) scene.add(instancia.raiz);
      }
      tempo += dt;
      const clip = estado.current.clip;
      const modo: ModoIA = clip === 'Dead' ? 'morto' : clip === 'Gunshot_Reaction' ? 'dor' : 'patrulha';
      if (clip === 'Dead' && tempo <= dt) instancia?.animar({ modo: 'patrulha', timer: 0 }, 0, 0, 'Mira');
      instancia?.animar({ modo, timer: 0 }, clip === 'Running' ? 3.2 : 1.5, estado.current.congelar ? 0 : dt, clip, estado.current.congelar ? estado.current.momento / 100 : undefined);
      if (disparo !== estado.current.disparo) { instancia?.disparar(); disparo = estado.current.disparo; }
      const a = estado.current.angulo;
      camera.position.set(Math.sin(a) * 4.1, 1.55, -Math.cos(a) * 4.1);
      camera.lookAt(0, .93, 0);
      if (estado.current.detalhe) { camera.position.set(1.4, 1.65, -1.2); camera.lookAt(0, 1.35, -.25); }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      encerrado = true; cancelAnimationFrame(raf); resize.disconnect();
      instancia?.dispose(); acervo.dispose(); rec.dispose(); bank.dispose();
      hemi.dispose(); luz.dispose(); recorte.dispose(); renderer.dispose();
    };
  }, []);
  return (
    <main style={{ position: 'fixed', inset: 0, fontFamily: 'system-ui', color: '#e4e8df' }}>
      <canvas ref={canvas} aria-label="Prévia 3D do policial importado" style={{ width: '100%', height: '100%', display: 'block' }} />
      <section style={{ position: 'absolute', top: 20, left: 20, width: 'min(310px, calc(100% - 40px))', padding: 20, background: '#091315e8', border: '1px solid #b6c5bc33', borderTop: '2px solid #d4b478' }}>
        <p style={{ font: '10px monospace', letterSpacing: '.16em', color: '#d4b478' }}>PRÉVIA LOCAL / PERSONAGEM</p>
        <h1 style={{ margin: '8px 0', fontSize: 24 }}>O policial · fuzil verde-oliva</h1>
        <p role="status" style={{ fontSize: 12, lineHeight: 1.5, color: '#a5b5ad' }}>{status}</p>
        <label htmlFor="animacao-policial" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>Animação</label>
        <select id="animacao-policial" value={selecionado} onChange={(e) => { setSelecionado(e.target.value); estado.current.clip = e.target.value; estado.current.serial++; }} style={{ width: '100%', padding: 10, background: '#172324', color: '#e4e8df', border: '1px solid #62756a' }}>
          {CLIPS.map((c, i) => <option key={c} value={c}>{NOMES[i]}</option>)}
        </select>
        {<div style={{ marginTop: 12, fontSize: 12 }}>
          <label><input type="checkbox" checked={congelar} onChange={(e) => { setCongelar(e.target.checked); estado.current.congelar = e.target.checked; }} /> Pausar animação</label>
          {congelar && <label style={{ display: 'block', marginTop: 10 }}>Quadro da animação: {momento}%<input aria-label="Quadro da animação" type="range" min={0} max={100} value={momento} onChange={(e) => { const n = Number(e.target.value); setMomento(n); estado.current.momento = n; }} style={{ width: '100%', accentColor: '#d4b478' }} /></label>}
        </div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {['Frente', 'Lado', 'Costas'].map((n, i) => <button key={n} onClick={() => { estado.current.angulo = i * Math.PI / 2; estado.current.detalhe = false; }} style={{ padding: '8px 12px', background: '#20302c', border: '1px solid #62756a', color: '#e4e8df', cursor: 'pointer' }}>{n}</button>)}
          <button onClick={() => { estado.current.detalhe = true; }} style={{ padding: 8, color: "#fff", background: "#20302c", border: "1px solid #62756a" }}>Detalhe da arma</button>
          <button onClick={() => { estado.current.disparo++; }} style={{ padding: 8, color: '#fff', background: '#20302c', border: '1px solid #62756a' }}>Testar clarão</button>
          <button onClick={() => { estado.current.serial++; }} style={{ padding: '8px 12px', background: '#20302c', border: '1px solid #62756a', color: '#e4e8df', cursor: 'pointer' }}>Repetir</button>
        </div>
      </section>
    </main>
  );
}

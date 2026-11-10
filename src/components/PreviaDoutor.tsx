'use client';

import { useEffect, useRef, useState } from 'react';
import { ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer } from 'three';
import { MaterialBank } from '../engine/materials';
import { AcervoDoutor, type InstanciaDoutor } from '../engine/view/doutor';
import { Recursos } from '../engine/view/recursos';
import type { ModoIA } from '../sim/world';

const CLIPS = ['Idle_02', 'Walking', 'Unsteady_Walk', 'Running', 'Run_02', 'Gunshot_Reaction', 'Dead', 'Ataque'] as const;
const NOMES = ['Espera', 'Caminhada', 'Cambaleando', 'Corrida', 'Corrida 2', 'Reação ao tiro', 'Morte', 'Ataque adaptado'];

/** Bancada visual local: testa o mesmo acervo, material, esqueleto e controlador usados no jogo. */
export function PreviaDoutor() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const estado = useRef({ clip: 'Idle_02', serial: 0, angulo: 0, congelar: false, momento: 100 });
  const [selecionado, setSelecionado] = useState('Idle_02');
  const [congelar, setCongelar] = useState(false);
  const [momento, setMomento] = useState(100);
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
    const rec = new Recursos(bank);
    const acervo = new AcervoDoutor(bank);
    const hemi = new HemisphereLight(0xdcecff, 0x514839, 2.4);
    const luz = new DirectionalLight(0xffe5c4, 3.8); luz.position.set(-3, 5, -4); luz.castShadow = true;
    luz.shadow.mapSize.set(1024, 1024);
    const recorte = new DirectionalLight(0x8db5db, 2); recorte.position.set(2, 3, 3);
    scene.add(hemi, luz, recorte);
    const piso = new Mesh(rec.geo(new PlaneGeometry(30, 30)), rec.mat(new MeshStandardMaterial({ color: 0x303a39, roughness: .9 })));
    piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
    let instancia: InstanciaDoutor | null = null;
    let encerrado = false, raf = 0, antes = performance.now(), tempo = 0, serial = -1;
    acervo.pronto.then(() => {
      if (!encerrado) setStatus(acervo.estado === 'pronto' ? 'Modelo do usuário · 7 animações · 4 mapas PBR' : acervo.erro);
    });
    const resize = new ResizeObserver(() => {
      if (!canvas.current) return;
      const w = canvas.current.clientWidth, h = canvas.current.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
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
      let modo: ModoIA = clip === 'Dead' ? 'morto' : clip === 'Gunshot_Reaction' ? 'dor' : 'patrulha';
      const congelado = clip === 'Ataque' && estado.current.congelar;
      const faseAtaque = congelado ? .35 * estado.current.momento / 100 : tempo % 1.2;
      if (clip === 'Ataque' && (congelado || faseAtaque < .35)) modo = 'ataque';
      // Primeiro quadro vivo antes da morte: testa a queda completa, em vez do corpo já salvo no checkpoint.
      if (clip === 'Dead' && tempo <= dt) instancia?.animar({ modo: 'patrulha', timer: 0 }, 0, 0, 'Idle_02');
      instancia?.animar({ modo, timer: Math.max(0, .35 - faseAtaque) }, clip.includes('Run') ? 4.5 : 1.5, congelado ? 0 : dt, clip === 'Ataque' ? 'Idle_02' : clip);
      const a = estado.current.angulo;
      camera.position.set(Math.sin(a) * 4.1, 1.55, -Math.cos(a) * 4.1);
      camera.lookAt(0, .93, 0); renderer.render(scene, camera);
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
      <canvas ref={canvas} aria-label="Prévia 3D do doutor importado" style={{ width: '100%', height: '100%', display: 'block' }} />
      <section style={{ position: 'absolute', top: 20, left: 20, width: 'min(310px, calc(100% - 40px))', padding: 20, background: '#091315e8', border: '1px solid #b6c5bc33', borderTop: '2px solid #d4b478' }}>
        <p style={{ font: '10px monospace', letterSpacing: '.16em', color: '#d4b478' }}>PRÉVIA LOCAL / PERSONAGEM</p>
        <h1 style={{ margin: '8px 0', fontSize: 24 }}>O doutor</h1>
        <p role="status" style={{ fontSize: 12, lineHeight: 1.5, color: '#a5b5ad' }}>{status}</p>
        <label htmlFor="animacao-doutor" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>Animação</label>
        <select id="animacao-doutor" value={selecionado} onChange={(e) => { setSelecionado(e.target.value); estado.current.clip = e.target.value; estado.current.serial++; }} style={{ width: '100%', padding: 10, background: '#172324', color: '#e4e8df', border: '1px solid #62756a' }}>
          {CLIPS.map((c, i) => <option key={c} value={c}>{NOMES[i]}</option>)}
        </select>
        {selecionado === 'Ataque' && <div style={{ marginTop: 12, fontSize: 12 }}>
          <label><input type="checkbox" checked={congelar} onChange={(e) => { setCongelar(e.target.checked); estado.current.congelar = e.target.checked; }} /> Pausar ataque para inspeção</label>
          {congelar && <label style={{ display: 'block', marginTop: 10 }}>Momento do golpe: {momento}%<input aria-label="Momento do golpe" type="range" min={0} max={100} value={momento} onChange={(e) => { const n = Number(e.target.value); setMomento(n); estado.current.momento = n; }} style={{ width: '100%', accentColor: '#d4b478' }} /></label>}
        </div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {['Frente', 'Lado', 'Costas'].map((n, i) => <button key={n} onClick={() => { estado.current.angulo = i * Math.PI / 2; }} style={{ padding: '8px 12px', background: '#20302c', border: '1px solid #62756a', color: '#e4e8df', cursor: 'pointer' }}>{n}</button>)}
          <button onClick={() => { estado.current.serial++; }} style={{ padding: '8px 12px', background: '#20302c', border: '1px solid #62756a', color: '#e4e8df', cursor: 'pointer' }}>Repetir</button>
        </div>
      </section>
    </main>
  );
}

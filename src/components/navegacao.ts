'use client';

// Navegação de menu por teclado: setas para cima e para baixo movem o foco entre os controles do
// contêiner, Esc chama `aoVoltar`, Enter e Espaço ativam o botão (comportamento nativo).
import { useEffect, useRef, type RefObject } from 'react';

const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]';

export function useNavegacaoMenu<T extends HTMLElement>(aoVoltar?: () => void): RefObject<T | null> {
  const ref = useRef<T>(null);
  const voltar = useRef(aoVoltar);
  useEffect(() => {
    voltar.current = aoVoltar;
  });

  useEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;
    // foco inicial no primeiro controle (ou no marcado com data-foco-inicial)
    const inicial = raiz.querySelector<HTMLElement>('[data-foco-inicial]') ?? raiz.querySelector<HTMLElement>(FOCAVEIS);
    inicial?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (voltar.current) {
          e.preventDefault();
          voltar.current();
        }
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const itens = [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)];
      if (itens.length === 0) return;
      e.preventDefault();
      const i = itens.indexOf(document.activeElement as HTMLElement);
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      const prox = i < 0 ? 0 : (i + passo + itens.length) % itens.length;
      itens[prox].focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return ref;
}

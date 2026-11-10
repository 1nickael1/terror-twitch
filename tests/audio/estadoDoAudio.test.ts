import { describe, expect, it } from 'vitest';
import { audioDeveTocar } from '../../src/audio/regras';

const base = { oculta: false, pausado: false, audioNaPausa: false, travado: true, semTrava: false };

describe('audioDeveTocar', () => {
  it('toca em jogo com a trava (ou sem trava na depuração)', () => {
    expect(audioDeveTocar(base)).toBe(true);
    expect(audioDeveTocar({ ...base, travado: false, semTrava: true })).toBe(true);
  });
  it('em jogo sem trava, não toca', () => {
    expect(audioDeveTocar({ ...base, travado: false })).toBe(false);
  });
  it('pausa de verdade e título suspendem', () => {
    expect(audioDeveTocar({ ...base, pausado: true })).toBe(false);
  });
  it('morte, fim de fase, final e documento mantêm o áudio, mesmo sem trava', () => {
    expect(audioDeveTocar({ ...base, pausado: true, audioNaPausa: true, travado: false })).toBe(true);
  });
  it('aba oculta suspende sempre', () => {
    expect(audioDeveTocar({ ...base, oculta: true })).toBe(false);
    expect(audioDeveTocar({ ...base, oculta: true, pausado: true, audioNaPausa: true })).toBe(false);
  });
  it('audioNaPausa sem pausa não muda nada', () => {
    expect(audioDeveTocar({ ...base, audioNaPausa: true, travado: false })).toBe(false);
  });
});

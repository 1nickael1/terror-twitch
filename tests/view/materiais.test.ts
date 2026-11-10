import { MeshStandardMaterial, NearestFilter, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { MaterialBank } from '../../src/engine/materials';

describe('MaterialBank.ajustarBrilho (lâmpadas dos perigos)', () => {
  it('multiplica o emissivo do slot e segue o multiplicador do filtro, nas duas variantes', () => {
    const b = new MaterialBank();
    b.define('lampada', { color: 0x200000, emissive: 0xff0000, emissiveIntensity: 2 });
    const std = b.get('lampada') as MeshStandardMaterial;
    expect(std.emissiveIntensity).toBe(2);
    b.ajustarBrilho('lampada', 0.5);
    expect(std.emissiveIntensity).toBeCloseTo(1);
    b.setEmissivo(0.6);
    expect(std.emissiveIntensity).toBeCloseTo(0.6);
    // a variante criada depois já nasce com o brilho e o filtro
    b.setKind('lambert');
    expect((b.get('lampada') as MeshStandardMaterial).emissiveIntensity).toBeCloseTo(0.6);
    b.ajustarBrilho('lampada', 0);
    expect((b.get('lampada') as MeshStandardMaterial).emissiveIntensity).toBe(0);
    expect(std.emissiveIntensity).toBe(0);
  });

  it('slot desconhecido é ignorado; remover o slot esquece o brilho', () => {
    const b = new MaterialBank();
    expect(() => b.ajustarBrilho('nada', 0.3)).not.toThrow();
    b.define('x', { emissive: 0xffffff, emissiveIntensity: 1 });
    b.ajustarBrilho('x', 0.2);
    b.removerSlot('x');
    b.define('x', { emissive: 0xffffff, emissiveIntensity: 1 });
    expect((b.get('x') as MeshStandardMaterial).emissiveIntensity).toBe(1);
  });

  it('os outros slots não mudam', () => {
    const b = new MaterialBank();
    b.define('a', { emissive: 0xffffff, emissiveIntensity: 1 });
    b.define('b', { emissive: 0xffffff, emissiveIntensity: 1 });
    b.ajustarBrilho('a', 0.1);
    expect((b.get('b') as MeshStandardMaterial).emissiveIntensity).toBe(1);
  });
});

describe('mapas compartilhados de superfície', () => {
  it('filtra cor, relevo, rugosidade e emissivo e libera cada textura uma única vez', () => {
    const b = new MaterialBank();
    const cor = new Texture(), relevo = new Texture(), rugosidade = new Texture();
    const descartadas: Texture[] = [];
    for (const t of [cor, relevo, rugosidade]) t.addEventListener('dispose', () => descartadas.push(t));
    const d = { map: cor, bumpMap: relevo, roughnessMap: rugosidade, emissiveMap: cor, bumpScale: .02 };
    b.define('global', d); b.define('fase', d);
    const material = b.get('global') as MeshStandardMaterial;
    expect(material.bumpMap).toBe(relevo);
    expect(material.roughnessMap).toBe(rugosidade);
    b.setNearest(true);
    for (const t of [cor, relevo, rugosidade]) expect(t.magFilter).toBe(NearestFilter);
    b.removerSlot('fase');
    expect(descartadas).toHaveLength(0);
    b.dispose();
    expect(descartadas).toHaveLength(3);
    expect(new Set(descartadas).size).toBe(3);
  });
});

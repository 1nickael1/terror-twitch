import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SCP Terror — demo',
  description: 'Demo de um jogo de tiro e terror em primeira pessoa, no navegador, inspirado na SCP Foundation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

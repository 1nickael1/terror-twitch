import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SCP Terror — protótipo de estilos',
  description: 'Protótipo de estilos visuais de um jogo de terror em primeira pessoa inspirado na SCP Foundation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

import { notFound } from 'next/navigation';
import { PreviaDoutor } from '../../../src/components/PreviaDoutor';

export default function Pagina() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <PreviaDoutor />;
}

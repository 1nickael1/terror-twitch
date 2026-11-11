import { notFound } from 'next/navigation';
import { PreviaPolicial } from '../../../src/components/PreviaPolicial';

export default function Pagina() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <PreviaPolicial />;
}

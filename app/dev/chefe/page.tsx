import { notFound } from 'next/navigation';
import { PreviaChefe } from '../../../src/components/PreviaChefe';

export default function Pagina() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <PreviaChefe />;
}

import CareersClient from './CareersClient';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Carreras · Onyx Trading Live',
  description: 'Plazas disponibles en Onyx Trading Live. Únete a nuestro equipo.',
};

export default function Page() {
  return <CareersClient />;
}

import ApplyForm from './ApplyForm';

// Landing OCULTA de reclutamiento. No se enlaza en el menú y no se indexa:
// solo entra quien tiene el link. Para clasificar candidatos (vendedor/supervisor).
export const metadata = {
  title: 'Únete al equipo de ventas · Onyx Trading Live',
  description: 'Programa privado para representantes de ventas de Onyx Trading Live.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ApplyForm />;
}

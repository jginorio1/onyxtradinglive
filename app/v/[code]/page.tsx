import { repPublicProfile } from '@/lib/salesKit';
import OnyxIcon from '@/app/components/OnyxIcon';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type Props = { params: { code: string } };

// Página propia (vitrina) de cada vendedor: tudominio.com/v/CÓDIGO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await repPublicProfile(params.code).catch(() => null);
  if (!p) return { title: 'Onyx Trading Live' };
  return {
    title: `${p.name} · Tu asesor Onyx`,
    description: p.bio || `Empieza en Onyx con ${p.name} como tu asesor.`,
    openGraph: { title: `${p.name} · Tu asesor Onyx`, description: p.bio || '', images: p.photo ? [p.photo] : [] },
  };
}

const S = {
  wrap: { maxWidth: 520, margin: '0 auto', padding: '28px 20px 60px', textAlign: 'center' as const },
  card: { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 16, padding: '28px 22px' },
  photo: { width: 104, height: 104, borderRadius: '50%', objectFit: 'cover' as const, margin: '0 auto 14px', display: 'block' },
  ini: { width: 104, height: 104, borderRadius: '50%', margin: '0 auto 14px', background: 'var(--accent,#8b93ff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 600 },
  name: { fontSize: 24, fontWeight: 600, color: 'var(--tx,#e8ecf5)', margin: 0 },
  role: { fontSize: 13, color: 'var(--mut,#9aa6bd)', marginTop: 4 },
  bio: { fontSize: 15, color: 'var(--mut,#9aa6bd)', lineHeight: 1.6, marginTop: 14 },
  btnP: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', borderRadius: 11, padding: '13px 22px', fontSize: 15, fontWeight: 600, textDecoration: 'none' },
  btn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--card,#1b2338)', color: 'var(--tx,#e8ecf5)', border: '1px solid var(--line,#2a3350)', borderRadius: 11, padding: '13px 22px', fontSize: 15, fontWeight: 600, textDecoration: 'none' },
  feat: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 22, borderTop: '1px solid var(--line,#2a3350)', paddingTop: 18 },
  ft: { fontSize: 12.5, color: 'var(--tx,#e8ecf5)' },
  fic: { color: 'var(--accent,#8b93ff)', display: 'flex', justifyContent: 'center', marginBottom: 6, fontSize: 22 },
};

export default async function RepLanding({ params }: Props) {
  const p = await repPublicProfile(params.code).catch(() => null);
  if (!p) {
    return <div style={S.wrap}><div style={S.card}><h1 style={S.name}>Onyx Trading Live</h1><p style={S.bio}>Este asesor no está disponible. <a href="/" style={{ color: 'var(--accent,#8b93ff)' }}>Ir al inicio →</a></p></div></div>;
  }
  const initial = (p.name || '?').trim().charAt(0).toUpperCase();
  return (
    <div style={S.wrap}>
      <div style={S.card}>
        {p.photo ? <img src={p.photo} alt={p.name} style={S.photo} /> : <div style={S.ini}>{initial}</div>}
        <h1 style={S.name}>{p.name}</h1>
        <div style={S.role}>Tu asesor Onyx · {p.roleName}</div>
        {p.bio && <p style={S.bio}>{p.bio}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
          <a href={`/?sv=${p.code}`} style={S.btnP}>Empieza en Onyx</a>
          {p.canRecruit && <a href={`/unete-ventas?sponsor=${p.code}`} style={S.btn}>Únete a mi equipo</a>}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 10 }}>
          Al registrarte con este enlace, {p.name} es tu asesor y te acompaña cada mes.
        </div>

        <div style={S.feat}>
          <div><div style={S.fic}><OnyxIcon name="link" size={24} /></div><div style={S.ft}>Conecto tu cuenta</div></div>
          <div><div style={S.fic}><OnyxIcon name="guardian" size={24} /></div><div style={S.ft}>Activo tu Guardian</div></div>
          <div><div style={S.fic}><OnyxIcon name="chat" size={24} /></div><div style={S.ft}>Soporte cada mes</div></div>
        </div>
      </div>
    </div>
  );
}

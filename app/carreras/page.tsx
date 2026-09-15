import CareersClient from './CareersClient';
import { openPositions, careersSettings } from '@/lib/careers';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Carreras · Onyx Trading Live',
  description: 'Plazas disponibles en Onyx Trading Live. Únete a nuestro equipo.',
};

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');
const EMP: Record<string, string> = { full: 'FULL_TIME', part: 'PART_TIME', contract: 'CONTRACTOR', intern: 'INTERN' };

// Convierte "$1500 - $2500" en baseSalary si es parseable (opcional).
function baseSalary(range?: string) {
  if (!range) return undefined;
  const nums = (range.match(/\d[\d,.]*/g) || []).map((n) => Number(n.replace(/[,.]/g, ''))).filter((n) => n > 0);
  if (!nums.length) return undefined;
  const value = nums.length >= 2 ? { '@type': 'QuantitativeValue', minValue: Math.min(...nums), maxValue: Math.max(...nums), unitText: 'MONTH' } : { '@type': 'QuantitativeValue', value: nums[0], unitText: 'MONTH' };
  return { '@type': 'MonetaryAmount', currency: 'USD', value };
}

// Construye el JSON-LD JobPosting de Google Jobs para cada plaza abierta.
function jobsLd(positions: any[]) {
  const org = { '@type': 'Organization', name: 'Onyx Trading Live', sameAs: BASE, logo: `${BASE}/icon-512.png` };
  return positions.map((p) => {
    const remote = /remot|remote|home|casa/i.test(p.location || '');
    const desc = (p.description || p.summary || p.title || '').toString();
    const ld: any = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: p.title,
      description: desc.replace(/\n/g, '<br>'),
      datePosted: (p.created_at || new Date().toISOString()).slice(0, 10),
      employmentType: EMP[p.type] || 'FULL_TIME',
      hiringOrganization: org,
      directApply: true,
      identifier: { '@type': 'PropertyValue', name: 'Onyx Trading Live', value: String(p.id) },
    };
    if (remote) {
      ld.jobLocationType = 'TELECOMMUTE';
      ld.applicantLocationRequirements = { '@type': 'Country', name: 'Worldwide' };
    } else {
      ld.jobLocation = { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: p.location || 'Remoto', addressCountry: 'US' } };
    }
    const bs = baseSalary(p.salary_range);
    if (bs) ld.baseSalary = bs;
    return ld;
  });
}

export default async function Page() {
  let ld: any[] = [];
  try {
    const s = await careersSettings();
    if (s.enabled) {
      const positions = await openPositions();
      ld = jobsLd(positions.filter((p) => (p.description || p.summary || '').toString().trim().length > 0));
    }
  } catch {}
  return (
    <>
      {ld.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />
      ))}
      <CareersClient />
    </>
  );
}

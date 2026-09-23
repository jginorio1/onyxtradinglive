'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { Hint } from '@/app/components/HintPop';
import GuidePanel, { type GuideStep } from '@/app/components/GuidePanel';

type Slot = { key: string; es: string; en: string; size: string; page: string };
type Rate = Slot & { price: number; unit: 'week' | 'month' | 'cpm' };
type Campaign = { id: string; advertiser: string; contact: string; slot_key: string; creative_url: string; link_url: string; alt: string; lang: string; starts_at: string | null; ends_at: string | null; weight: number; price: number; status: string; impressions: number; clicks: number };

const UNIT: Record<string, [string, string]> = { week: ['/ semana', '/ week'], month: ['/ mes', '/ month'], cpm: ['CPM (mil impresiones)', 'CPM (per 1k impressions)'] };
const emptyForm = { id: '', advertiser: '', contact: '', slot_key: '', creative_url: '', creative_path: '', link_url: '', alt: '', lang: 'all', geo: 'all', geo_tier: '', geo_exclude: '', device: 'all', category: 'general', disclaimer: false, pricing_model: 'flat', budget: 0, daily_cap: 0, starts_at: '', ends_at: '', weight: 1, price: 0, status: 'active' };
const emptyPartner = { id: '', name: '', logo_url: '', banner_url: '', blurb_es: '', blurb_en: '', link_url: '', category: 'broker', geo: 'all', cpa_payout: 0, featured: false, rank: 100, regulated: '', status: 'active' };

export default function AdsAdmin({ es }: { es: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const [cfg, setCfg] = useState<any>({ enabled: true, nativeEnabled: false, autoApprove: false, partnerFill: true, freqCap: 3, programmatic: { enabled: false, code: '' }, riskDisclaimer: { es: '', en: '' } });
  const [rates, setRates] = useState<Rate[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [camps, setCamps] = useState<Campaign[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [pForm, setPForm] = useState<any>(emptyPartner);
  const [progCode, setProgCode] = useState('');
  const [busy, setBusy] = useState('');
  const [upBusy, setUpBusy] = useState('');   // '' | 'logo' | 'banner'
  const [mk, setMk] = useState<any>(null);    // overrides del Media Kit
  const [proposals, setProposals] = useState<any[]>([]);
  const [mailReady, setMailReady] = useState(false);
  const emptyProp = { company: '', contact: '', email: '', packageId: '', noteEs: '', noteEn: '', lang: 'es' };
  const [prop, setProp] = useState<any>(emptyProp);

  async function propAction(body: any, okMsg: string) {
    setBusy('prop');
    try {
      const r = await fetch('/api/admin/ads', { method: 'POST', body: JSON.stringify({ entity: 'proposal', ...body }) });
      const j = await r.json();
      if (j.ok) { if (j.proposals) setProposals(j.proposals); toast(okMsg, 'ok'); return j; }
      toast(j.error || L('No se pudo.', 'Failed.'), 'err'); return null;
    } catch { toast(L('Error de red.', 'Network error.'), 'err'); return null; } finally { setBusy(''); }
  }
  async function createProp() {
    if (!prop.company.trim()) { toast(L('Pon al menos la empresa.', 'Add at least the company.'), 'err'); return; }
    const j = await propAction({ action: 'create', ...prop }, L('Propuesta creada.', 'Proposal created.'));
    if (j?.url) { try { await navigator.clipboard.writeText(j.url); toast(L('Enlace copiado.', 'Link copied.'), 'ok'); } catch {} setProp(emptyProp); }
  }
  function copyLink(token: string, lang: string) {
    const base = (typeof window !== 'undefined' ? window.location.origin : '');
    const url = `${base}${lang === 'en' ? '/en' : ''}/publicidad/propuesta?t=${token}`;
    try { navigator.clipboard.writeText(url); toast(L('Enlace copiado.', 'Link copied.'), 'ok'); } catch {}
  }

  async function saveMk() {
    setBusy('mk');
    try {
      const r = await fetch('/api/admin/ads', { method: 'POST', body: JSON.stringify({ entity: 'mediakit', data: mk }) });
      const j = await r.json();
      if (j.ok) { setMk(j.mediakit); toast(L('Media Kit guardado.', 'Media Kit saved.'), 'ok'); }
      else toast(j.error || L('No se pudo guardar.', 'Could not save.'), 'err');
    } catch { toast(L('Error de red.', 'Network error.'), 'err'); } finally { setBusy(''); }
  }
  const setMkPack = (i: number, k: string, v: any) => setMk((m: any) => ({ ...m, packages: m.packages.map((p: any, j: number) => j === i ? { ...p, [k]: v } : p) }));

  async function uploadImg(kind: 'logo' | 'banner', file: File | null) {
    if (!file) return;
    setUpBusy(kind);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/admin/ads/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.ok && j.url) { setPForm((p: any) => ({ ...p, [kind === 'logo' ? 'logo_url' : 'banner_url']: j.url })); toast(L('Imagen subida.', 'Image uploaded.'), 'ok'); }
      else toast(j.error || L('No se pudo subir.', 'Upload failed.'), 'err');
    } catch { toast(L('Error de red.', 'Network error.'), 'err'); } finally { setUpBusy(''); }
  }

  async function load() {
    try {
      const j = await (await fetch('/api/admin/ads')).json();
      if (j.config) { setCfg(j.config); setRates(j.rates || []); setSlots(j.slots || []); setCamps(j.campaigns || []); setPartners(j.partners || []); setProgCode(j.config.programmatic?.code || ''); if (j.mediakit) setMk(j.mediakit); setProposals(j.proposals || []); setMailReady(!!j.mailReady); }
    } catch {}
  }
  useEffect(() => { load(); }, []);
  const pending = camps.filter((c: any) => c.status === 'pending');

  async function patch(body: any, okMsg: string) {
    setBusy('cfg');
    try {
      const r = await fetch('/api/admin/ads', { method: 'PATCH', body: JSON.stringify(body) });
      if (r.ok) { toast(okMsg, 'ok'); load(); }
      else toast(r.status === 423 ? L('Panel bloqueado: desbloquea con tu PIN.', 'Panel locked: unlock with your PIN.') : L('No se pudo guardar.', 'Could not save.'), 'err');
    } catch { toast(L('Error de red.', 'Network error.'), 'err'); } finally { setBusy(''); }
  }
  async function saveRates() {
    const map: any = {}; rates.forEach((r) => { map[r.key] = { price: r.price, unit: r.unit }; });
    await patch({ rates: map }, L('Tarifario guardado.', 'Rate card saved.'));
  }
  async function post(body: any, okMsg: string) {
    setBusy('camp');
    try {
      const r = await fetch('/api/admin/ads', { method: 'POST', body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) { toast(okMsg, 'ok'); setForm(emptyForm); load(); }
      else toast(j.error || L('No se pudo guardar.', 'Could not save.'), 'err');
    } catch { toast(L('Error de red.', 'Network error.'), 'err'); } finally { setBusy(''); }
  }

  const box: any = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 };
  const lbl: any = { fontSize: 11.5, color: 'var(--mut)', marginBottom: 5 };
  const slotName = (k: string) => { const s = slots.find((x) => x.key === k); return s ? (es ? s.es : s.en) + ' · ' + s.size : k; };
  const ctr = (c: Campaign) => (c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) + '%' : '—');
  const stColor: Record<string, string> = { active: '#34e2a0', paused: '#f5b23e', draft: '#7c8cff', pending: '#e0a92e', rejected: '#ef6262', scheduled: '#7c8cff', ended: 'var(--mut)' };

  // Dibujos (SVG) que ilustran cada paso de la guía. Estilo oscuro + dorado.
  const G = '#d9b661', MUT = '#8a91a5', LN = '#39405a', GRN = '#5fd08a', RED = '#e0666b';
  const gsvg = {
    // 1 · Las 4 formas de ganar, de más a menos rentable (embudo de barras)
    ways: `<svg viewBox="0 0 250 132" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cuatro formas de ganar">
      <text x="4" y="12" fill="${MUT}" font-size="9" font-family="sans-serif">Rentabilidad ↓</text>
      <g font-family="sans-serif" font-size="9">
        <rect x="4" y="20" width="200" height="20" rx="4" fill="${G}"/><text x="10" y="34" fill="#1a1400" font-weight="700">1 · Socios CPA</text>
        <rect x="4" y="46" width="152" height="20" rx="4" fill="${G}" opacity=".72"/><text x="10" y="60" fill="#1a1400" font-weight="700">2 · Vender directo</text>
        <rect x="4" y="72" width="108" height="20" rx="4" fill="${G}" opacity=".5"/><text x="10" y="86" fill="#1a1400">3 · Autoservicio</text>
        <rect x="4" y="98" width="64" height="20" rx="4" fill="${MUT}" opacity=".5"/><text x="10" y="112" fill="#0d0f16">4 · AdSense</text>
      </g></svg>`,
    // 2 · Dos interruptores maestros ON/OFF
    switches: `<svg viewBox="0 0 250 96" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Interruptores">
      <g font-family="sans-serif" font-size="10">
        <text x="6" y="26" fill="#c7ccda">Anuncios (global)</text>
        <rect x="150" y="14" width="46" height="20" rx="10" fill="${GRN}"/><circle cx="186" cy="24" r="8" fill="#fff"/><text x="158" y="27" fill="#04120b" font-size="8" font-weight="700">ON</text>
        <text x="6" y="66" fill="#c7ccda">App nativa</text>
        <rect x="150" y="54" width="46" height="20" rx="10" fill="${LN}"/><circle cx="160" cy="64" r="8" fill="#aab0c0"/><text x="172" y="67" fill="#aab0c0" font-size="8" font-weight="700">OFF</text>
      </g></svg>`,
    // 3 · Revisión: tarjeta con banner + aprobar/rechazar
    review: `<svg viewBox="0 0 250 120" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Revisión de artes">
      <rect x="4" y="6" width="242" height="108" rx="8" fill="none" stroke="${LN}"/>
      <rect x="14" y="16" width="90" height="52" rx="4" fill="${LN}"/><text x="30" y="46" fill="${MUT}" font-size="9" font-family="sans-serif">Banner</text>
      <g font-family="sans-serif" font-size="9" fill="#c7ccda"><text x="114" y="26">Broker XYZ</text><text x="114" y="42" fill="${MUT}">Prop firm · $180</text><text x="114" y="58" fill="${MUT}">link → xyz.com</text></g>
      <rect x="14" y="80" width="104" height="24" rx="6" fill="${GRN}"/><text x="34" y="96" fill="#04120b" font-size="10" font-weight="700" font-family="sans-serif">✓ Aprobar</text>
      <rect x="130" y="80" width="104" height="24" rx="6" fill="none" stroke="${RED}"/><text x="150" y="96" fill="${RED}" font-size="10" font-weight="700" font-family="sans-serif">✕ Rechazar</text></svg>`,
    // 4 · Ajustes: toggles + tope
    settings: `<svg viewBox="0 0 250 118" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ajustes">
      <g font-family="sans-serif" font-size="9.5" fill="#c7ccda">
        <text x="6" y="20">Auto-aprobar</text><rect x="176" y="10" width="40" height="16" rx="8" fill="${LN}"/><circle cx="184" cy="18" r="6" fill="#aab0c0"/>
        <text x="6" y="48">Tope/día</text><rect x="150" y="38" width="66" height="16" rx="4" fill="none" stroke="${LN}"/><text x="178" y="50" fill="${G}" font-weight="700">3</text>
        <text x="6" y="76">Programático</text><rect x="176" y="66" width="40" height="16" rx="8" fill="${LN}"/><circle cx="184" cy="74" r="6" fill="#aab0c0"/>
        <text x="6" y="104" fill="${MUT}">Aviso de riesgo (legal) — no borrar</text>
      </g></svg>`,
    // 5 · Tarifario: etiquetas de precio por espacio
    rates: `<svg viewBox="0 0 250 118" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tarifario">
      <g font-family="sans-serif" font-size="9.5">
        <rect x="4" y="8" width="242" height="24" rx="5" fill="none" stroke="${LN}"/><text x="12" y="24" fill="#c7ccda">Portada · 970×90</text><rect x="176" y="12" width="62" height="16" rx="8" fill="${G}"/><text x="186" y="24" fill="#1a1400" font-weight="700">$90/sem</text>
        <rect x="4" y="38" width="242" height="24" rx="5" fill="none" stroke="${LN}"/><text x="12" y="54" fill="#c7ccda">Blog · 600×300</text><rect x="176" y="42" width="62" height="16" rx="8" fill="${G}"/><text x="186" y="54" fill="#1a1400" font-weight="700">$45/sem</text>
        <rect x="4" y="68" width="242" height="24" rx="5" fill="none" stroke="${LN}"/><text x="12" y="84" fill="#c7ccda">Artículo · 300×600</text><rect x="176" y="72" width="62" height="16" rx="8" fill="${G}"/><text x="184" y="84" fill="#1a1400" font-weight="700">$180/mes</text>
      </g></svg>`,
    // 6 · Campaña: formulario con campos
    campaign: `<svg viewBox="0 0 250 124" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Crear campaña">
      <g font-family="sans-serif" font-size="8.5" fill="${MUT}">
        <text x="6" y="14">Anunciante</text><rect x="6" y="18" width="110" height="14" rx="3" fill="${LN}"/>
        <text x="130" y="14">Ubicación</text><rect x="130" y="18" width="110" height="14" rx="3" fill="${LN}"/>
        <text x="6" y="46">País / Tier</text><rect x="6" y="50" width="72" height="14" rx="3" fill="${LN}"/>
        <text x="88" y="46">Dispositivo</text><rect x="88" y="50" width="70" height="14" rx="3" fill="${LN}"/>
        <text x="168" y="46">Cobro</text><rect x="168" y="50" width="72" height="14" rx="3" fill="${LN}"/>
        <text x="6" y="78">Banner + enlace</text><rect x="6" y="82" width="150" height="14" rx="3" fill="${LN}"/>
      </g>
      <rect x="164" y="100" width="76" height="18" rx="6" fill="${G}"/><text x="176" y="113" fill="#1a1400" font-size="9" font-weight="700" font-family="sans-serif">Crear</text></svg>`,
    // 7 · Socios CPA: broker → tu enlace → comisión
    partner: `<svg viewBox="0 0 250 118" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Socios CPA">
      <rect x="4" y="10" width="150" height="98" rx="8" fill="none" stroke="${LN}"/>
      <circle cx="28" cy="34" r="12" fill="${G}"/><text x="46" y="32" fill="#c7ccda" font-size="10" font-family="sans-serif">The5ers</text>
      <text x="46" y="46" fill="${MUT}" font-size="8" font-family="sans-serif">Prop firm · regulado</text>
      <rect x="16" y="58" width="126" height="16" rx="8" fill="${G}"/><text x="42" y="70" fill="#1a1400" font-size="9" font-weight="700" font-family="sans-serif">Ver oferta →</text>
      <text x="16" y="92" fill="${GRN}" font-size="8.5" font-family="sans-serif">tu enlace afiliado</text>
      <path d="M156 58 L196 58" stroke="${G}" stroke-width="2" stroke-dasharray="4 3" marker-end="url(#ah)"/>
      <defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${G}"/></marker></defs>
      <rect x="196" y="40" width="50" height="40" rx="6" fill="rgba(95,208,138,.15)" stroke="${GRN}"/><text x="204" y="58" fill="${GRN}" font-size="8" font-family="sans-serif">registro</text><text x="206" y="70" fill="${GRN}" font-size="10" font-weight="700" font-family="sans-serif">= $$</text></svg>`,
    // 8 · Media Kit: documento con "pisos" y gráfica
    mediakit: `<svg viewBox="0 0 250 128" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Media Kit">
      <rect x="4" y="6" width="150" height="116" rx="6" fill="#fff"/>
      <rect x="4" y="6" width="150" height="22" rx="6" fill="#0b0f1e"/><text x="14" y="21" fill="#fff" font-size="9" font-family="sans-serif">Preparado para: Broker</text>
      <rect x="14" y="36" width="60" height="6" rx="3" fill="${G}"/>
      <rect x="14" y="48" width="128" height="4" rx="2" fill="#e5e8ee"/><rect x="14" y="56" width="100" height="4" rx="2" fill="#e5e8ee"/>
      <g font-family="sans-serif" font-size="7"><rect x="14" y="70" width="40" height="34" rx="3" fill="#faf4e6"/><text x="20" y="82" fill="#7a5a12">12.4k</text><text x="18" y="92" fill="#999">visitas</text>
      <rect x="58" y="70" width="40" height="34" rx="3" fill="#f3edff"/><text x="66" y="82" fill="#6a3fd0">0.9%</text><text x="70" y="92" fill="#999">CTR</text></g>
      <text x="168" y="24" fill="${MUT}" font-size="8.5" font-family="sans-serif">Pisos (editable):</text>
      <rect x="168" y="30" width="76" height="16" rx="4" fill="none" stroke="${LN}"/><text x="174" y="42" fill="${G}" font-size="8.5" font-family="sans-serif">visitas ≥ 10k</text>
      <text x="168" y="62" fill="${MUT}" font-size="8" font-family="sans-serif">crece con lo real →</text>
      <path d="M170 96 L182 88 L194 92 L206 78 L220 82 L236 68" fill="none" stroke="${GRN}" stroke-width="2"/></svg>`,
  };

  const guideSteps: GuideStep[] = [
    { target: '[data-guide="global"]', title: L('1 · Cómo funciona (empieza aquí)', '1 · How it works (start here)'),
      body: L('Esta sección gana dinero mostrando anuncios en tu web (blog, artículos, footer, barra inferior) SOLO a usuarios del plan gratis; a los de pago nunca se les muestra nada.\n\nHay 4 formas de ganar, de la que más rinde a la que menos:\n1) Directorio de socios (CPA) — brokers/prop firms te pagan por cada registro. Lo más rentable.\n2) Vender tus banners directo a esos brokers.\n3) Que anunciantes compren solos en /publicidad.\n4) Relleno con AdSense (centavos) cuando un hueco queda vacío.\n\nSin clientes todavía, los huecos muestran tu propio anuncio de "Pro", así que la web nunca se ve vacía.',
        'This section earns money by showing ads on your site (blog, articles, footer, bottom bar) ONLY to free-plan users; paid users never see any.\n\nThere are 4 ways to earn, highest to lowest:\n1) Partner directory (CPA) — brokers/prop firms pay you per signup. Most profitable.\n2) Sell your banners directly to those brokers.\n3) Advertisers buy on their own at /publicidad.\n4) AdSense fill (pennies) when a slot is empty.\n\nWith no clients yet, empty slots show your own "Pro" ad, so the site never looks blank.'),
      svg: gsvg.ways,
      example: L('The5ers te da $X por cada trader que se registra con tu enlace (CPA). Con 20 registros al mes ya ganas más que meses de AdSense. Por eso el paso 7 (socios) es lo primero que conviene llenar.',
                 'The5ers pays you $X per trader who signs up via your link (CPA). 20 signups a month already beats months of AdSense. That’s why step 7 (partners) is the first thing to fill.') },
    { target: '[data-guide="global"]', title: L('2 · Interruptores globales', '2 · Global switches'),
      body: L('Dos interruptores maestros:\n\n• Anuncios (global): ON = el sistema de anuncios está encendido. OFF = apaga TODOS los espacios de golpe.\n\n• Anuncios en la app nativa: déjalo en OFF hasta que Apple/Google aprueben tus apps. Los anuncios solo deben salir en la web por ahora.\n\nToca la tarjeta para cambiar ON/OFF; se guarda solo.',
        'Two master switches:\n\n• Ads (global): ON = the ad system is on. OFF = turns OFF every space at once.\n\n• Ads in the native app: leave OFF until Apple/Google approve your apps. Ads should only show on the web for now.\n\nTap the card to toggle ON/OFF; it saves itself.'),
      svg: gsvg.switches,
      example: L('Si un cliente grande te pide "quiten los anuncios esta semana por una campaña especial", apagas "Anuncios (global)" y desaparecen de toda la web al instante. Lo vuelves a encender y regresan.',
                 'If a big client asks "turn ads off this week for a special campaign", switch "Ads (global)" off and they vanish site-wide instantly. Turn it back on and they return.') },
    { target: '[data-guide="review"]', title: L('3 · Revisión de artes', '3 · Creative review'),
      body: L('Cuando un anunciante paga en /publicidad, su banner NO sale live: espera aquí tu aprobación (así nadie publica cualquier cosa en tu web).\n\nCada anuncio pendiente muestra: la imagen, el anunciante, la categoría, el precio y el enlace de destino. Revisa que el arte sea apropiado y que el enlace no sea una estafa.\n\n• Aprobar → sale live al instante.\n• Rechazar → te pide un motivo y queda rechazado (reembolsa desde Stripe si aplica).\n\nSin clientes todavía, esto está vacío. Es normal.',
        'When an advertiser pays on /publicidad, their banner does NOT go live: it waits here for your approval (so nobody publishes junk on your site).\n\nEach pending ad shows: the image, advertiser, category, price and destination link. Check the creative is appropriate and the link isn’t a scam.\n\n• Approve → goes live instantly.\n• Reject → asks for a reason and marks it rejected (refund from Stripe if needed).\n\nWith no clients yet, this is empty. That’s normal.'),
      svg: gsvg.review,
      example: L('Llega un banner de "Broker XYZ · $180" con enlace a xyz.com. Miras que el arte no engañe y que el link sea real → Aprobar y sale live. Si el link fuera raro o el arte prometiera "ganancias garantizadas" → Rechazar con motivo.',
                 'A "Broker XYZ · $180" banner comes in linking to xyz.com. You check the creative isn’t misleading and the link is real → Approve and it goes live. If the link looked shady or the art promised "guaranteed profits" → Reject with a reason.') },
    { target: '[data-guide="settings"]', title: L('4 · Ajustes · parte por parte', '4 · Settings · part by part'),
      body: L('Cuatro controles:\n\n• Auto-aprobar artes: déjalo en OFF (recomendado). Con OFF tú revisas cada anuncio antes de que salga. Con ON saldría solo, sin revisión: peligroso.\n\n• Tope de impresiones/visitante/día: cuántas veces como máximo un mismo visitante ve el mismo anuncio al día (3 es buen número). Evita quemar al anunciante y molestar al usuario.\n\n• Relleno programático: pega aquí el código de AdSense y enciéndelo SOLO cuando Google te apruebe. Rellena huecos vacíos con anuncios de Google.\n\n• Aviso de riesgo financiero: ya viene el texto legal (ES/EN) que sale pequeñito bajo los anuncios de brokers/prop firms. No lo borres.',
        'Four controls:\n\n• Auto-approve creatives: leave OFF (recommended). With OFF you review each ad before it goes live. With ON it would go live with no review: risky.\n\n• Impression cap/visitor/day: the max times one visitor sees the same ad per day (3 is a good number). Avoids burning the advertiser and annoying the user.\n\n• Programmatic fill: paste your AdSense code here and turn it ON ONLY once Google approves you. It fills empty slots with Google ads.\n\n• Financial risk disclaimer: the legal text (ES/EN) that shows small under broker/prop-firm ads is already set. Don’t delete it.'),
      svg: gsvg.settings,
      example: L('Con "Tope/día = 3", si un visitante entra 10 veces al blog, ese banner se le muestra máximo 3 veces ese día; el resto ve otra cosa. Así no quemas al anunciante ni cansas al usuario.',
                 'With "Cap/day = 3", if a visitor opens the blog 10 times, that banner shows at most 3 times that day; the rest they see something else. That way you don’t burn the advertiser or tire the user.') },
    { target: '[data-guide="rates"]', title: L('5 · Tarifario (precios)', '5 · Rate card (prices)'),
      body: L('Aquí pones cuánto cobras por cada espacio. Es exactamente lo que el anunciante verá en tu página pública /publicidad.\n\nPor cada fila: escribe el precio ($) y elige la unidad:\n• / semana o / mes → precio plano (cobras fijo por ese tiempo).\n• CPM → cobras por cada 1.000 veces que se ve.\n\nLos espacios grandes o muy visibles (billboard de portada, barra sticky) valen más. Cuando termines, pulsa "Guardar precios".',
        'Here you set how much you charge per space. It’s exactly what advertisers see on your public /publicidad page.\n\nFor each row: type the price ($) and pick the unit:\n• / week or / month → flat price (fixed for that time).\n• CPM → charged per 1,000 views.\n\nBig or highly-visible spaces (landing billboard, sticky bar) are worth more. When done, hit "Save prices".'),
      svg: gsvg.rates,
      example: L('Portada 970×90 a $90/sem, artículo 300×600 a $180/mes. Lo que pongas aquí es EXACTO lo que el broker ve en /publicidad y en la propuesta PDF. Súbelos con el tiempo si tu tráfico crece.',
                 'Home 970×90 at $90/wk, article 300×600 at $180/mo. Whatever you set here is EXACTLY what the broker sees on /publicidad and in the PDF proposal. Raise them over time as traffic grows.') },
    { target: '[data-guide="campaign"]', title: L('6 · Crear campaña · los campos', '6 · Create campaign · the fields'),
      body: L('Crea un anuncio a mano (útil si vendiste el espacio por WhatsApp/correo). Campos clave:\n\n• Anunciante: nombre de quién paga.\n• Ubicación: en qué espacio va (elige de la lista).\n• Idioma / Región (tier) / País / Excluir país: a quién se le muestra. Tier 1 = US, UK, CA, AU… (paga más).\n• Dispositivo: escritorio, móvil o todos.\n• Categoría: broker, prop firm, herramienta, educación o general.\n• Modelo de cobro: plano, CPM, CPC o CPA + presupuesto y tope diario.\n• Imagen del banner + Enlace destino.\n• Aviso de riesgo: márcalo si es de broker/prop firm.\n• Estado: Activa lo pone live.\n\nAbajo pulsa "Crear campaña".',
        'Create an ad manually (handy if you sold the space over WhatsApp/email). Key fields:\n\n• Advertiser: who pays.\n• Placement: which space (pick from the list).\n• Language / Region (tier) / Country / Exclude country: who sees it. Tier 1 = US, UK, CA, AU… (pays more).\n• Device: desktop, mobile or all.\n• Category: broker, prop firm, tool, education or general.\n• Pricing model: flat, CPM, CPC or CPA + budget and daily cap.\n• Banner image + Destination link.\n• Risk disclaimer: tick it for broker/prop-firm ads.\n• Status: Active makes it live.\n\nHit "Create campaign" below.'),
      svg: gsvg.campaign,
      example: L('Vendiste por WhatsApp el footer a un broker por 1 mes: Anunciante "FundedX", Ubicación "Footer global", País US, Dispositivo Todos, subes el banner, pones el enlace, marcas aviso de riesgo, Estado Activa → sale live.',
                 'You sold the footer to a broker for 1 month over WhatsApp: Advertiser "FundedX", Placement "Global footer", Country US, Device All, upload the banner, set the link, tick risk disclaimer, Status Active → it goes live.') },
    { target: '[data-guide="partners"]', title: L('7 · Directorio de socios (CPA) · lo importante', '7 · Partner directory (CPA) · the big one'),
      body: L('EMPIEZA POR AQUÍ para ganar sin anunciantes. Son brokers y prop firms que te pagan por cada registro que les mandes.\n\nCómo: entra a la web del broker → busca "Affiliates/Partners/IB" → regístrate → te dan un enlace único.\n\nLuego rellena los campos:\n• Nombre + Logo (URL).\n• Categoría: broker / prop firm / herramienta.\n• Enlace afiliado: tu enlace único (¡el que te paga!).\n• Descripción ES/EN + Reguladores (da confianza).\n• Pago CPA: cuánto te dan por registro (referencia).\n• Destacado: lo sube arriba y lo resalta.\n• Orden: número menor = aparece primero.\n\nSe publican en tu página /socios. Cada clic sale por tu enlace y se cuenta.',
        'START HERE to earn without advertisers. These are brokers and prop firms that pay you per signup you send them.\n\nHow: go to the broker’s site → find "Affiliates/Partners/IB" → sign up → they give you a unique link.\n\nThen fill the fields:\n• Name + Logo (URL).\n• Category: broker / prop firm / tool.\n• Affiliate link: your unique link (the one that pays you!).\n• Description ES/EN + Regulators (builds trust).\n• CPA payout: how much per signup (reference).\n• Featured: pushes it to the top and highlights it.\n• Rank: lower number = appears first.\n\nThey publish on your /socios page. Every click goes through your link and is counted.'),
      svg: gsvg.partner,
      example: L('Cargas The5ers con tu enlace afiliado. Aparece en /socios Y rellena los huecos vacíos de banners por toda la web. Un trader hace clic → va por tu enlace → si se registra, The5ers te paga. Todo sin un solo anunciante de pago.',
                 'You load The5ers with your affiliate link. It shows on /socios AND fills empty banner slots across the site. A trader clicks → goes through your link → if they sign up, The5ers pays you. All without a single paying advertiser.') },
    { target: '[data-guide="mediakit"]', title: L('8 · Media Kit y propuesta (para clientes)', '8 · Media Kit & proposal (for clients)'),
      body: L('Esto es lo que le enseñas a un cliente que quiere comprar un banner.\n\n• Página pública /publicidad/estadisticas: muestra sola tus estadísticas reales por página (visitas, CTR), la audiencia por país y qué espacios están libres. Se actualiza sola.\n\n• Propuesta PDF /publicidad/propuesta: un documento profesional bilingüe (ES/EN) que el cliente descarga. Sale con tus cifras reales incrustadas.\n\nAquí editas los textos, los "pisos" y los paquetes:\n• Pisos: cifra mínima creíble que se muestra mientras tienes poco tráfico. Cuando el tráfico real la supera, se muestra el real (nunca inventa por encima).\n• Mostrar precios: enséñalos u ocúltalos (para negociar por contacto).\n• Paquetes: Starter/Growth/Enterprise con su precio y qué espacios incluyen.\n\nPulsa "Guardar" y usa "Ver página / Ver propuesta" para revisarlo.',
        'This is what you show a client who wants to buy a banner.\n\n• Public page /publicidad/estadisticas: automatically shows your real per-page stats (visits, CTR), audience by country and which spaces are open. It updates itself.\n\n• PDF proposal /publicidad/propuesta: a professional bilingual (ES/EN) document the client downloads. It comes with your real figures embedded.\n\nHere you edit the copy, the "floors" and the packages:\n• Floors: a credible minimum shown while traffic is low. Once real traffic beats it, the real number shows (never invents above real).\n• Show prices: display or hide them (to negotiate by contact).\n• Packages: Starter/Growth/Enterprise with price and which spaces they include.\n\nHit "Save" and use "View page / View proposal" to check it.'),
      svg: gsvg.mediakit,
      example: L('Vas a hablar con un broker. Pones "Piso visitas ≥ 10.000" para verte creíble aunque hoy tengas menos. Generas la propuesta para "Broker XYZ", eliges paquete Growth, y le mandas el enlace o el PDF. Cuando tu tráfico REAL pase de 10.000, la cifra sube sola.',
                 'You’re about to pitch a broker. You set "Floor visits ≥ 10,000" to look credible even if today it’s less. You generate the proposal for "Broker XYZ", pick the Growth package, and send the link or PDF. Once your REAL traffic passes 10,000, the figure rises on its own.') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ fontSize: 20, margin: '0 0 2px' }}>{L('Espacios patrocinados', 'Sponsored spaces')}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{L('Vende banners por ubicación y tamaño. Solo se muestran en la web y solo a usuarios del plan gratis.', 'Sell banners by placement and size. Shown only on web and only to free-plan users.')}</div>
        </div>
        <GuidePanel storageKey="ads" title={L('Guía de Publicidad', 'Advertising guide')} steps={guideSteps} es={es} />
      </div>

      {/* Interruptores globales */}
      <div data-guide="global" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <div onClick={() => patch({ enabled: !cfg.enabled }, cfg.enabled ? L('Anuncios apagados.', 'Ads off.') : L('Anuncios encendidos.', 'Ads on.'))} style={{ ...box, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{L('Anuncios (global)', 'Ads (global)')}</div><div className="muted" style={{ fontSize: 12 }}>{L('Interruptor maestro para todos los espacios.', 'Master switch for every space.')}</div></div>
          <span style={{ fontSize: 12, fontWeight: 700, color: cfg.enabled ? '#34e2a0' : 'var(--mut)' }}>{cfg.enabled ? 'ON' : 'OFF'}</span>
        </div>
        <div onClick={() => patch({ nativeEnabled: !cfg.nativeEnabled }, L('Guardado.', 'Saved.'))} style={{ ...box, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{L('Anuncios en la app nativa', 'Ads in the native app')}</div><div className="muted" style={{ fontSize: 12 }}>{L('Déjalo APAGADO hasta que Apple/Google aprueben.', 'Keep OFF until Apple/Google approve.')}</div></div>
          <span style={{ fontSize: 12, fontWeight: 700, color: cfg.nativeEnabled ? '#f5b23e' : 'var(--mut)' }}>{cfg.nativeEnabled ? 'ON' : 'OFF'}</span>
        </div>
      </div>

      {/* Cola de revisión de artes (F3) */}
      <div data-guide="review" style={{ ...box, borderColor: pending.length ? 'var(--brand)' : 'var(--line)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          {L('Revisión de artes', 'Creative review')}
          <Hint text={L('Los anuncios pagados en /publicidad esperan aquí tu aprobación antes de salir live. Revisa el arte y el enlace, y aprueba o rechaza. Sin clientes todavía, esto está vacío.', 'Ads paid on /publicidad wait here for your approval before going live. Check the creative and link, then approve or reject. With no clients yet, this is empty.')} />
          {pending.length > 0 && <span style={{ fontSize: 11, fontWeight: 800, background: 'var(--brand)', color: '#1a1400', borderRadius: 20, padding: '2px 9px' }}>{pending.length}</span>}
        </div>
        {pending.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>{L('Nada por revisar. Las campañas pagadas en autoservicio esperan aquí tu aprobación antes de salir live.', 'Nothing to review. Paid self-serve campaigns wait here for your approval before going live.')}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                {c.creative_url && <img src={c.creative_url} alt="" style={{ maxWidth: 160, maxHeight: 70, borderRadius: 6, border: '1px solid var(--line)' }} />}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.advertiser} · <span className="muted" style={{ fontWeight: 400 }}>{slotName(c.slot_key)}</span></div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{c.category} · ${c.price} · {c.contact}</div>
                  <a href={c.link_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: 'var(--brand)', wordBreak: 'break-all' }}>{c.link_url}</a>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" onClick={() => post({ action: 'approve', id: c.id }, L('Aprobada y live.', 'Approved and live.'))} style={{ fontSize: 12 }}>{L('Aprobar', 'Approve')}</button>
                  <button className="btn btn-ghost" onClick={() => { const note = prompt(L('Motivo del rechazo (opcional):', 'Rejection reason (optional):')) || ''; post({ action: 'reject', id: c.id, review_note: note }, L('Rechazada.', 'Rejected.')); }} style={{ fontSize: 12, color: 'var(--red,#ef6262)' }}>{L('Rechazar', 'Reject')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ajustes pro (F3/F5/F6) */}
      <div data-guide="settings" style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>{L('Ajustes de monetización', 'Monetization settings')}
          <Hint text={L('Controlas qué se muestra en un hueco vacío (tu anuncio de Pro o una red externa), el tope de veces que un visitante ve el mismo anuncio, y el aviso de riesgo de los anuncios financieros. Sin clientes, no tienes que tocar nada.', 'You control what shows in an empty slot (your Pro ad or an external network), the cap on how many times a visitor sees the same ad, and the risk disclaimer on financial ads. With no clients, you don’t need to touch anything.')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          <div onClick={() => patch({ autoApprove: !cfg.autoApprove }, L('Guardado.', 'Saved.'))} style={{ ...box, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>{L('Auto-aprobar artes', 'Auto-approve creatives')}</div><div className="muted" style={{ fontSize: 11 }}>{L('NO recomendado. Si está OFF, tú revisas cada anuncio.', 'Not recommended. If OFF, you review each ad.')}</div></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: cfg.autoApprove ? '#f5b23e' : '#34e2a0' }}>{cfg.autoApprove ? 'ON' : 'OFF'}</span>
          </div>
          <div onClick={() => patch({ partnerFill: !cfg.partnerFill }, L('Guardado.', 'Saved.'))} style={{ ...box, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>{L('Rellenar con socios', 'Fill with partners')}</div><div className="muted" style={{ fontSize: 11 }}>{L('ON = los huecos vacíos muestran a tus socios del directorio (CPA) con tu enlace afiliado, en vez del anuncio de Pro.', 'ON = empty slots show your directory partners (CPA) with your affiliate link, instead of the Pro ad.')}</div></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: cfg.partnerFill ? '#34e2a0' : 'var(--mut)' }}>{cfg.partnerFill ? 'ON' : 'OFF'}</span>
          </div>
          <div style={{ ...box }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{L('Tope de impresiones/visitante/día', 'Impression cap/visitor/day')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="number" min={0} value={cfg.freqCap} onChange={(e) => setCfg({ ...cfg, freqCap: Math.max(0, parseInt(e.target.value, 10) || 0) })} style={{ margin: 0, width: 70 }} />
              <button className="btn btn-ghost" onClick={() => patch({ freqCap: cfg.freqCap }, L('Guardado.', 'Saved.'))} style={{ fontSize: 11 }}>{L('Guardar', 'Save')}</button>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{L('Relleno programático (red externa)', 'Programmatic fallback (ad network)')}</div>
            <span onClick={() => patch({ programmatic: { enabled: !cfg.programmatic?.enabled, code: progCode } }, L('Guardado.', 'Saved.'))} style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: cfg.programmatic?.enabled ? '#34e2a0' : 'var(--mut)' }}>{cfg.programmatic?.enabled ? 'ON' : 'OFF'}</span>
          </div>
          <div className="muted" style={{ fontSize: 11, margin: '2px 0 6px' }}>{L('Se muestra cuando ningún anunciante compró el hueco (cero impresión perdida). Pega el código de tu red (AdSense/Ezoic…).', 'Shown when no advertiser bought the slot (zero wasted impression). Paste your network code (AdSense/Ezoic…).')}</div>
          <textarea value={progCode} onChange={(e) => setProgCode(e.target.value)} placeholder="<script>…</script>" style={{ width: '100%', minHeight: 60, fontSize: 12, fontFamily: 'monospace' }} />
          <button className="btn btn-ghost" onClick={() => patch({ programmatic: { enabled: cfg.programmatic?.enabled, code: progCode } }, L('Código guardado.', 'Code saved.'))} style={{ fontSize: 11, marginTop: 6 }}>{L('Guardar código', 'Save code')}</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{L('Aviso de riesgo financiero (broker/prop firm)', 'Financial risk disclaimer (broker/prop firm)')}</div>
          <input value={cfg.riskDisclaimer?.es || ''} onChange={(e) => setCfg({ ...cfg, riskDisclaimer: { ...cfg.riskDisclaimer, es: e.target.value } })} placeholder="ES" style={{ margin: '0 0 6px', width: '100%', fontSize: 12 }} />
          <input value={cfg.riskDisclaimer?.en || ''} onChange={(e) => setCfg({ ...cfg, riskDisclaimer: { ...cfg.riskDisclaimer, en: e.target.value } })} placeholder="EN" style={{ margin: 0, width: '100%', fontSize: 12 }} />
          <button className="btn btn-ghost" onClick={() => patch({ riskDisclaimer: cfg.riskDisclaimer }, L('Aviso guardado.', 'Disclaimer saved.'))} style={{ fontSize: 11, marginTop: 6 }}>{L('Guardar aviso', 'Save disclaimer')}</button>
        </div>
      </div>

      {/* Tarifario editable */}
      <div data-guide="rates" style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>{L('Tarifario (precio por ubicación y tamaño)', 'Rate card (price by placement & size)')}
            <Hint text={L('El precio de cada espacio. Es lo que verá el anunciante en /publicidad. Edítalo y da "Guardar precios". Ponlo una vez.', 'The price of each space. This is what advertisers see on /publicidad. Edit it and hit "Save prices". Set once.')} />
          </div>
          <button className="btn btn-primary" onClick={saveRates} disabled={busy === 'cfg'} style={{ fontSize: 12 }}>{L('Guardar precios', 'Save prices')}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rates.map((r, i) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{es ? r.es : r.en}</div>
                <div className="muted" style={{ fontSize: 11 }}>{r.size} · {r.page}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--mut)' }}>$</span>
                <input type="number" min={0} value={r.price} onChange={(e) => setRates((rs) => rs.map((x, j) => j === i ? { ...x, price: Math.max(0, parseFloat(e.target.value) || 0) } : x))} style={{ margin: 0, width: 90 }} />
              </div>
              <select value={r.unit} onChange={(e) => setRates((rs) => rs.map((x, j) => j === i ? { ...x, unit: e.target.value as any } : x))} style={{ margin: 0, fontSize: 12 }}>
                <option value="week">{L('/ semana', '/ week')}</option>
                <option value="month">{L('/ mes', '/ month')}</option>
                <option value="cpm">CPM</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Media Kit · estadísticas para anunciantes + propuesta PDF */}
      {mk && (
        <div data-guide="mediakit" style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>{L('Media Kit y propuesta (para clientes)', 'Media Kit & proposal (for clients)')}
              <Hint text={L('La página pública /publicidad/estadisticas y la propuesta PDF /publicidad/propuesta se llenan solas con tu tráfico real. Aquí ajustas los textos, los pisos (cifra mínima creíble mientras hay poco tráfico) y los paquetes. Cuando el dato real supera el piso, manda el real.', 'The public page /publicidad/estadisticas and the PDF proposal /publicidad/propuesta fill themselves from your real traffic. Here you tune the copy, the floors (a credible minimum while traffic is low) and the packages. When the real number beats the floor, the real one wins.')} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a className="btn btn-ghost" href="/publicidad/estadisticas" target="_blank" style={{ fontSize: 12 }}>{L('Ver página', 'View page')}</a>
              <a className="btn btn-ghost" href="/publicidad/propuesta" target="_blank" style={{ fontSize: 12 }}>{L('Ver propuesta', 'View proposal')}</a>
              <button className="btn btn-primary" onClick={saveMk} disabled={busy === 'mk'} style={{ fontSize: 12 }}>{L('Guardar', 'Save')}</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
            <div><div style={lbl}>{L('Titular (ES)', 'Headline (ES)')}</div><input value={mk.headlineEs} onChange={(e) => setMk({ ...mk, headlineEs: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
            <div><div style={lbl}>{L('Titular (EN)', 'Headline (EN)')}</div><input value={mk.headlineEn} onChange={(e) => setMk({ ...mk, headlineEn: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10, marginTop: 10 }}>
            <div><div style={lbl}>{L('Quiénes somos (ES)', 'About (ES)')}</div><textarea value={mk.aboutEs} onChange={(e) => setMk({ ...mk, aboutEs: e.target.value })} rows={3} style={{ margin: 0, width: '100%' }} /></div>
            <div><div style={lbl}>{L('Quiénes somos (EN)', 'About (EN)')}</div><textarea value={mk.aboutEn} onChange={(e) => setMk({ ...mk, aboutEn: e.target.value })} rows={3} style={{ margin: 0, width: '100%' }} /></div>
            <div><div style={lbl}>{L('Audiencia (ES)', 'Audience (ES)')}</div><textarea value={mk.audienceEs} onChange={(e) => setMk({ ...mk, audienceEs: e.target.value })} rows={2} style={{ margin: 0, width: '100%' }} /></div>
            <div><div style={lbl}>{L('Audiencia (EN)', 'Audience (EN)')}</div><textarea value={mk.audienceEn} onChange={(e) => setMk({ ...mk, audienceEn: e.target.value })} rows={2} style={{ margin: 0, width: '100%' }} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 10 }}>
            <div><div style={lbl}>{L('Piso visitantes/mes', 'Floor visitors/mo')} <Hint text={L('Cifra mínima que se muestra mientras el tráfico real es menor. Cuando el real la supera, se muestra el real.', 'Minimum shown while real traffic is lower. Once real beats it, real shows.')} /></div><input type="number" min={0} value={mk.floorVisitors} onChange={(e) => setMk({ ...mk, floorVisitors: +e.target.value || 0 })} style={{ margin: 0, width: '100%' }} /></div>
            <div><div style={lbl}>{L('Piso vistas/mes', 'Floor pageviews/mo')}</div><input type="number" min={0} value={mk.floorPageviews} onChange={(e) => setMk({ ...mk, floorPageviews: +e.target.value || 0 })} style={{ margin: 0, width: '100%' }} /></div>
            <div><div style={lbl}>{L('Tiempo medio', 'Avg. time')}</div><input value={mk.avgTime} onChange={(e) => setMk({ ...mk, avgTime: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
            <div><div style={lbl}>{L('% Móvil', '% Mobile')}</div><input type="number" min={0} max={100} value={mk.mobilePct} onChange={(e) => setMk({ ...mk, mobilePct: +e.target.value || 0 })} style={{ margin: 0, width: '100%' }} /></div>
            <div><div style={lbl}>{L('CTR piso (%)', 'CTR floor (%)')}</div><input type="number" min={0} step={0.1} value={mk.ctrPctFloor} onChange={(e) => setMk({ ...mk, ctrPctFloor: +e.target.value || 0 })} style={{ margin: 0, width: '100%' }} /></div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={!!mk.showPrices} onChange={(e) => setMk({ ...mk, showPrices: e.target.checked })} style={{ margin: 0 }} />
              {L('Mostrar precios en el kit y la propuesta', 'Show prices in the kit & proposal')}
            </label>
            <div style={{ flex: 1, minWidth: 200 }}><div style={lbl}>{L('Email de contacto', 'Contact email')}</div><input value={mk.contactEmail} onChange={(e) => setMk({ ...mk, contactEmail: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          </div>

          {/* Paquetes */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{L('Paquetes', 'Packages')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(mk.packages || []).map((p: any, i: number) => (
                <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
                  <div><div style={lbl}>{L('Nombre (ES)', 'Name (ES)')}</div><input value={p.es} onChange={(e) => setMkPack(i, 'es', e.target.value)} style={{ margin: 0, width: '100%' }} /></div>
                  <div><div style={lbl}>{L('Nombre (EN)', 'Name (EN)')}</div><input value={p.en} onChange={(e) => setMkPack(i, 'en', e.target.value)} style={{ margin: 0, width: '100%' }} /></div>
                  <div><div style={lbl}>{L('Precio/mes ($, 0 = a medida)', 'Price/mo ($, 0 = custom)')}</div><input type="number" min={0} value={p.priceMonthly} onChange={(e) => setMkPack(i, 'priceMonthly', +e.target.value || 0)} style={{ margin: 0, width: '100%' }} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Descripción (ES)', 'Description (ES)')}</div><input value={p.descEs} onChange={(e) => setMkPack(i, 'descEs', e.target.value)} style={{ margin: 0, width: '100%' }} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Descripción (EN)', 'Description (EN)')}</div><input value={p.descEn} onChange={(e) => setMkPack(i, 'descEn', e.target.value)} style={{ margin: 0, width: '100%' }} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Slots incluidos (claves separadas por coma)', 'Included slots (comma-separated keys)')}</div><input value={(p.slots || []).join(', ')} onChange={(e) => setMkPack(i, 'slots', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="landing_top, footer_site" style={{ margin: 0, width: '100%' }} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* ---- Generar propuesta personalizada para un cliente ---- */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              {L('Generar propuesta para un cliente', 'Generate a proposal for a client')}
              <Hint text={L('Crea una propuesta con el nombre y datos del cliente. Se genera un enlace único que puedes copiar y mandarle, o enviárselo directo por email desde aquí. Abre la misma propuesta bilingüe con sus datos y el paquete que le sugieres resaltado.', 'Create a proposal with the client’s name and details. It generates a unique link you can copy and send, or email directly from here. It opens the same bilingual proposal with their info and your suggested package highlighted.')} />
            </div>
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              {mailReady ? L('El correo está listo: puedes enviar directo.', 'Email is ready: you can send directly.') : L('El correo no está configurado (RESEND_API_KEY): podrás copiar el enlace y mandarlo tú.', 'Email is not configured (RESEND_API_KEY): you can copy the link and send it yourself.')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
              <div><div style={lbl}>{L('Empresa / broker', 'Company / broker')}</div><input value={prop.company} onChange={(e) => setProp({ ...prop, company: e.target.value })} placeholder="The5ers" style={{ margin: 0, width: '100%' }} /></div>
              <div><div style={lbl}>{L('Contacto', 'Contact')}</div><input value={prop.contact} onChange={(e) => setProp({ ...prop, contact: e.target.value })} placeholder="John" style={{ margin: 0, width: '100%' }} /></div>
              <div><div style={lbl}>{L('Email del cliente', 'Client email')}</div><input type="email" value={prop.email} onChange={(e) => setProp({ ...prop, email: e.target.value })} placeholder="ads@broker.com" style={{ margin: 0, width: '100%' }} /></div>
              <div><div style={lbl}>{L('Paquete sugerido', 'Suggested package')}</div>
                <select value={prop.packageId} onChange={(e) => setProp({ ...prop, packageId: e.target.value })} style={{ margin: 0, width: '100%' }}>
                  <option value="">{L('(ninguno)', '(none)')}</option>
                  {(mk.packages || []).map((p: any) => <option key={p.id} value={p.id}>{es ? p.es : p.en}</option>)}
                </select>
              </div>
              <div><div style={lbl}>{L('Idioma', 'Language')}</div>
                <select value={prop.lang} onChange={(e) => setProp({ ...prop, lang: e.target.value })} style={{ margin: 0, width: '100%' }}>
                  <option value="es">Español</option><option value="en">English</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <div><div style={lbl}>{L('Nota personal (ES)', 'Personal note (ES)')}</div><textarea value={prop.noteEs} onChange={(e) => setProp({ ...prop, noteEs: e.target.value })} rows={2} placeholder={L('Un mensaje breve para el cliente…', 'A short message for the client…')} style={{ margin: 0, width: '100%' }} /></div>
              <div><div style={lbl}>{L('Nota personal (EN)', 'Personal note (EN)')}</div><textarea value={prop.noteEn} onChange={(e) => setProp({ ...prop, noteEn: e.target.value })} rows={2} style={{ margin: 0, width: '100%' }} /></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={createProp} disabled={busy === 'prop'} style={{ fontSize: 12 }}>{L('Crear propuesta + copiar enlace', 'Create proposal + copy link')}</button>
            </div>

            {/* Lista de propuestas generadas */}
            {proposals.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {proposals.map((p: any) => (
                  <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.company || '—'} {p.contact_name ? <span className="muted" style={{ fontWeight: 400 }}>· {p.contact_name}</span> : null}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{p.email || L('sin email', 'no email')} · {p.lang?.toUpperCase()} · {p.views || 0} {L('vistas', 'views')} {p.status === 'sent' ? '· ' + L('enviada', 'sent') : ''}</div>
                    </div>
                    <button className="btn btn-ghost" onClick={() => copyLink(p.token, p.lang)} style={{ fontSize: 11 }}>{L('Copiar enlace', 'Copy link')}</button>
                    <a className="btn btn-ghost" href={`/publicidad/propuesta?t=${p.token}`} target="_blank" style={{ fontSize: 11 }}>{L('Ver', 'View')}</a>
                    {p.email && mailReady && <button className="btn btn-primary" onClick={() => propAction({ action: 'send', id: p.id, token: p.token }, L('Enviada por email.', 'Sent by email.'))} disabled={busy === 'prop'} style={{ fontSize: 11 }}>{L('Enviar email', 'Send email')}</button>}
                    <button className="btn btn-ghost" onClick={() => propAction({ action: 'delete', id: p.id }, L('Borrada.', 'Deleted.'))} style={{ fontSize: 11, color: 'var(--red, #e0555f)' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nueva / editar campaña */}
      <div data-guide="campaign" style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>{form.id ? L('Editar campaña', 'Edit campaign') : L('Nueva campaña', 'New campaign')}
          <Hint text={L('Crea un anuncio a mano (por ejemplo, si vendiste el espacio por WhatsApp). Elige ubicación, sube el banner, pon el enlace y actívalo. Puedes segmentar por país, tier, dispositivo y modelo de cobro.', 'Create an ad manually (e.g. if you sold the space over WhatsApp). Pick placement, upload the banner, set the link and activate. You can target by country, tier, device and pricing model.')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <div><div style={lbl}>{L('Anunciante', 'Advertiser')}</div><input value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Ubicación', 'Placement')}</div><select value={form.slot_key} onChange={(e) => setForm({ ...form, slot_key: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="">{L('elige…', 'choose…')}</option>{slots.map((s) => <option key={s.key} value={s.key}>{(es ? s.es : s.en) + ' · ' + s.size}</option>)}</select></div>
          <div><div style={lbl}>{L('Idioma', 'Language')}</div><select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="all">{L('Todos', 'All')}</option><option value="es">Español</option><option value="en">English</option></select></div>
          <div><div style={lbl}>{L('País (ISO, coma) o all', 'Country (ISO, comma) or all')}</div><input value={form.geo} onChange={(e) => setForm({ ...form, geo: e.target.value })} placeholder="all · US,MX,ES" style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Región (tier)', 'Region (tier)')}</div><select value={form.geo_tier} onChange={(e) => setForm({ ...form, geo_tier: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="">{L('Todas', 'All')}</option><option value="t1">Tier 1</option><option value="t2">Tier 2</option><option value="t3">Tier 3</option></select></div>
          <div><div style={lbl}>{L('Excluir países (ISO)', 'Exclude countries (ISO)')}</div><input value={form.geo_exclude} onChange={(e) => setForm({ ...form, geo_exclude: e.target.value })} placeholder="US,FR" style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Dispositivo', 'Device')}</div><select value={form.device} onChange={(e) => setForm({ ...form, device: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="all">{L('Todos', 'All')}</option><option value="desktop">{L('Escritorio', 'Desktop')}</option><option value="mobile">{L('Móvil', 'Mobile')}</option></select></div>
          <div><div style={lbl}>{L('Categoría', 'Category')}</div><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="general">General</option><option value="broker">Broker</option><option value="propfirm">Prop firm</option><option value="tool">{L('Herramienta', 'Tool')}</option><option value="education">{L('Educación', 'Education')}</option></select></div>
          <div><div style={lbl}>{L('Modelo de cobro', 'Pricing model')}</div><select value={form.pricing_model} onChange={(e) => setForm({ ...form, pricing_model: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="flat">{L('Plano', 'Flat')}</option><option value="cpm">CPM</option><option value="cpc">CPC</option><option value="cpa">CPA</option></select></div>
          <div><div style={lbl}>{L('Presupuesto ($, cpm/cpc/cpa)', 'Budget ($, cpm/cpc/cpa)')}</div><input type="number" min={0} value={form.budget} onChange={(e) => setForm({ ...form, budget: Math.max(0, parseFloat(e.target.value) || 0) })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Tope diario ($)', 'Daily cap ($)')}</div><input type="number" min={0} value={form.daily_cap} onChange={(e) => setForm({ ...form, daily_cap: Math.max(0, parseFloat(e.target.value) || 0) })} style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={!!form.disclaimer} onChange={(e) => setForm({ ...form, disclaimer: e.target.checked })} />{L('Mostrar aviso de riesgo', 'Show risk disclaimer')}</label></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Imagen del banner (URL)', 'Banner image (URL)')}</div><input value={form.creative_url} onChange={(e) => setForm({ ...form, creative_url: e.target.value })} placeholder="https://…/banner.png" style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Enlace destino', 'Destination link')}</div><input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Inicia', 'Starts')}</div><input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Termina', 'Ends')}</div><input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Peso (rotación)', 'Weight (rotation)')}</div><input type="number" min={1} value={form.weight} onChange={(e) => setForm({ ...form, weight: Math.max(1, parseInt(e.target.value, 10) || 1) })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Precio cobrado ($)', 'Price charged ($)')}</div><input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Math.max(0, parseFloat(e.target.value) || 0) })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Estado', 'Status')}</div><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="active">{L('Activa', 'Active')}</option><option value="paused">{L('Pausada', 'Paused')}</option><option value="draft">{L('Borrador', 'Draft')}</option><option value="ended">{L('Terminada', 'Ended')}</option></select></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={() => { if (!form.advertiser || !form.slot_key) return toast(L('Falta anunciante o ubicación.', 'Missing advertiser or placement.'), 'err'); post(form, form.id ? L('Campaña actualizada.', 'Campaign updated.') : L('Campaña creada.', 'Campaign created.')); }} disabled={busy === 'camp'} style={{ fontSize: 12.5 }}>{form.id ? L('Guardar cambios', 'Save changes') : L('Crear campaña', 'Create campaign')}</button>
          {form.id && <button className="btn btn-ghost" onClick={() => setForm(emptyForm)} style={{ fontSize: 12.5 }}>{L('Cancelar', 'Cancel')}</button>}
        </div>
      </div>

      {/* Lista de campañas */}
      <div style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{L('Campañas', 'Campaigns')} ({camps.length})</div>
        {camps.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>{L('Aún no hay campañas. Crea una arriba o llegan solas desde /publicidad.', 'No campaigns yet. Create one above or they arrive from /publicidad.')}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {camps.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: stColor[c.status] || 'var(--mut)', flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.advertiser || L('(sin nombre)', '(no name)')}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{slotName(c.slot_key)}{c.contact ? ' · ' + c.contact : ''}</div>
                </div>
                <div className="muted" style={{ fontSize: 11.5, flex: 'none' }}>{c.impressions.toLocaleString()} impr · {c.clicks} clic · {ctr(c)}</div>
                <div style={{ display: 'flex', gap: 5, flex: 'none' }}>
                  {c.status !== 'active' ? <button className="btn btn-ghost" onClick={() => post({ action: 'status', id: c.id, status: 'active' }, L('Activada.', 'Activated.'))} style={{ fontSize: 11, padding: '3px 8px' }}>{L('Activar', 'Activate')}</button>
                    : <button className="btn btn-ghost" onClick={() => post({ action: 'status', id: c.id, status: 'paused' }, L('Pausada.', 'Paused.'))} style={{ fontSize: 11, padding: '3px 8px' }}>{L('Pausar', 'Pause')}</button>}
                  <button className="btn btn-ghost" onClick={() => setForm({ ...emptyForm, ...c, starts_at: c.starts_at ? c.starts_at.slice(0, 10) : '', ends_at: c.ends_at ? c.ends_at.slice(0, 10) : '' })} style={{ fontSize: 11, padding: '3px 8px' }}>{L('Editar', 'Edit')}</button>
                  <button className="btn btn-ghost" onClick={() => { if (confirm(L('¿Borrar esta campaña?', 'Delete this campaign?'))) post({ action: 'delete', id: c.id }, L('Borrada.', 'Deleted.')); }} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red,#ef6262)' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Directorio de partners (CPA) — F6 */}
      <div data-guide="partners" style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>{L('Directorio de socios (CPA)', 'Partner directory (CPA)')}
          <Hint text={L('Aquí ganas SIN anunciantes: añade brokers y prop firms con tu enlace afiliado y aparecen en /socios. Cuando alguien se registra por tu enlace, te pagan comisión. Es lo primero que conviene llenar.', 'This earns you money WITHOUT advertisers: add brokers and prop firms with your affiliate link and they show on /socios. When someone signs up through your link, you get a commission. Fill this first.')} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{L('Brokers y prop firms que pagan por registro. Se listan en /socios. El ángulo que más rinde en este nicho.', 'Brokers and prop firms that pay per signup. Listed on /socios. The highest-yield angle in this niche.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <div><div style={lbl}>{L('Nombre', 'Name')}</div><input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Categoría', 'Category')}</div><select value={pForm.category} onChange={(e) => setPForm({ ...pForm, category: e.target.value })} style={{ margin: 0, width: '100%' }}><option value="broker">Broker</option><option value="propfirm">Prop firm</option><option value="tool">{L('Herramienta', 'Tool')}</option></select></div>
          <div>
            <div style={lbl}>{L('Logo — pega la URL o sube el archivo', 'Logo — paste URL or upload file')}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={pForm.logo_url} onChange={(e) => setPForm({ ...pForm, logo_url: e.target.value })} placeholder="https://…" style={{ margin: 0, flex: 1 }} />
              <label className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 8px', cursor: 'pointer', flex: 'none' }}>{upBusy === 'logo' ? '…' : L('Subir', 'Upload')}<input type="file" accept="image/*" onChange={(e) => uploadImg('logo', e.target.files?.[0] || null)} style={{ display: 'none' }} /></label>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={lbl}>{L('Banner del broker — opcional (pega la URL o sube el archivo)', 'Broker banner — optional (paste URL or upload file)')}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={pForm.banner_url} onChange={(e) => setPForm({ ...pForm, banner_url: e.target.value })} placeholder={L('El banner que te dan en su programa de afiliados', 'The banner they give you in their affiliate program')} style={{ margin: 0, flex: 1 }} />
              <label className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 8px', cursor: 'pointer', flex: 'none' }}>{upBusy === 'banner' ? '…' : L('Subir', 'Upload')}<input type="file" accept="image/*" onChange={(e) => uploadImg('banner', e.target.files?.[0] || null)} style={{ display: 'none' }} /></label>
            </div>
            {pForm.banner_url && <img src={pForm.banner_url} alt="banner" style={{ maxWidth: '100%', marginTop: 6, borderRadius: 8, border: '1px solid var(--line)' }} />}
          </div>
          <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Enlace afiliado', 'Affiliate link')}</div><input value={pForm.link_url} onChange={(e) => setPForm({ ...pForm, link_url: e.target.value })} placeholder="https://…?ref=onyx" style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Descripción ES', 'Description ES')}</div><input value={pForm.blurb_es} onChange={(e) => setPForm({ ...pForm, blurb_es: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Descripción EN', 'Description EN')}</div><input value={pForm.blurb_en} onChange={(e) => setPForm({ ...pForm, blurb_en: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Reguladores', 'Regulators')}</div><input value={pForm.regulated} onChange={(e) => setPForm({ ...pForm, regulated: e.target.value })} placeholder="FCA, ASIC…" style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Pago CPA ($)', 'CPA payout ($)')}</div><input type="number" min={0} value={pForm.cpa_payout} onChange={(e) => setPForm({ ...pForm, cpa_payout: Math.max(0, parseFloat(e.target.value) || 0) })} style={{ margin: 0, width: '100%' }} /></div>
          <div><div style={lbl}>{L('Orden', 'Rank')}</div><input type="number" value={pForm.rank} onChange={(e) => setPForm({ ...pForm, rank: parseInt(e.target.value, 10) || 100 })} style={{ margin: 0, width: '100%' }} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={!!pForm.featured} onChange={(e) => setPForm({ ...pForm, featured: e.target.checked })} />{L('Destacado', 'Featured')}</label></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={() => { if (!pForm.name || !pForm.link_url) return toast(L('Falta nombre o enlace.', 'Missing name or link.'), 'err'); post({ entity: 'partner', ...pForm }, pForm.id ? L('Socio actualizado.', 'Partner updated.') : L('Socio añadido.', 'Partner added.')); setPForm(emptyPartner); }} disabled={busy === 'camp'} style={{ fontSize: 12.5 }}>{pForm.id ? L('Guardar', 'Save') : L('Añadir socio', 'Add partner')}</button>
          {pForm.id && <button className="btn btn-ghost" onClick={() => setPForm(emptyPartner)} style={{ fontSize: 12.5 }}>{L('Cancelar', 'Cancel')}</button>}
        </div>
        {partners.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {partners.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                <div style={{ flex: 1, minWidth: 140, fontSize: 13 }}>{p.featured ? '★ ' : ''}{p.name} <span className="muted" style={{ fontSize: 11 }}>· {p.category}</span></div>
                <div className="muted" style={{ fontSize: 11.5 }}>{p.clicks || 0} clic · {p.signups || 0} reg</div>
                <button className="btn btn-ghost" onClick={() => setPForm({ ...emptyPartner, ...p })} style={{ fontSize: 11, padding: '3px 8px' }}>{L('Editar', 'Edit')}</button>
                <button className="btn btn-ghost" onClick={() => { if (confirm(L('¿Borrar socio?', 'Delete partner?'))) post({ entity: 'partner', action: 'delete', id: p.id }, L('Borrado.', 'Deleted.')); }} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red,#ef6262)' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="muted" style={{ fontSize: 11, borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
        {L('Requiere correr una vez supabase/ads.sql, ads_v2.sql y ads_v3.sql. Los enlaces llevan rel="sponsored nofollow" y todo va etiquetado como Publicidad. Páginas públicas: /publicidad (vender espacios) y /socios (directorio CPA).', 'Run supabase/ads.sql, ads_v2.sql and ads_v3.sql once. Links use rel="sponsored nofollow" and are labeled as advertising. Public pages: /publicidad (sell spaces) and /socios (CPA directory).')}
      </div>
    </div>
  );
}

// ============================================================
// Páginas SEO por prop firm ("el sistema operativo del trader de fondeo").
// Contenido factual y genérico sobre seguimiento de reglas con Onyx: NO
// afirmamos cifras concretas de cada firma (cambian y variarían por reto),
// hablamos de las reglas típicas (drawdown, pérdida diaria, consistencia).
// Cada firma trae SEO propio (título, descripción, keywords) ES/EN.
// ============================================================

export type Lang = 'es' | 'en';
type L<T> = Record<Lang, T>;

export type Faq = { q: L<string>; a: L<string> };
export type PropFirm = {
  slug: string;            // /prop-firms/{slug}
  name: string;            // marca (igual en ambos idiomas)
  tagline: L<string>;
  seoTitle: L<string>;
  seoDesc: L<string>;
  keywords: L<string[]>;
  intro: L<string>;        // párrafo de apertura (H1 lo genera la página)
  bullets: L<string[]>;    // cómo ayuda Onyx con esa firma
  faq: Faq[];
};

// Bloques reutilizables (misma promesa para todas las firmas, redactada por firma).
const help = (firm: string): L<string[]> => ({
  es: [
    `Sigue en vivo el marcador de tu reto de ${firm}: drawdown máximo, pérdida diaria y días de operación, todo en un panel.`,
    `El Onyx Guardian cuida tu riesgo dentro de MetaTrader/cTrader: límites de pérdida y freno automático para no romper las reglas.`,
    `Lleva varias cuentas de ${firm} (y de otras prop firms) a la vez, cada una con sus números por separado.`,
    `Copia operaciones entre tus cuentas con buenas prácticas anti-baneo (retardos y filtros configurables).`,
    `Analítica real de cada operación: profit factor, expectancy, drawdown y tu ganancia neta después de comisiones y swap.`,
    `Avisos por Telegram cuando te acercas a un límite de ${firm}, cuando alcanzas una meta o si tu EA se cae.`,
  ],
  en: [
    `Track your ${firm} challenge scoreboard live: max drawdown, daily loss and trading days, all in one dashboard.`,
    `Onyx Guardian protects your risk inside MetaTrader/cTrader: loss limits and an automatic stop so you don’t break the rules.`,
    `Manage several ${firm} accounts (and other prop firms) at once, each with its own numbers.`,
    `Copy trades across your accounts with anti-ban best practices (configurable delays and filters).`,
    `Real analytics on every trade: profit factor, expectancy, drawdown and your net profit after commissions and swap.`,
    `Telegram alerts when you approach a ${firm} limit, hit a goal, or if your EA goes down.`,
  ],
});

const commonFaq = (firm: string): Faq[] => [
  {
    q: { es: `¿Onyx opera por mí en ${firm}?`, en: `Does Onyx trade for me on ${firm}?` },
    a: {
      es: `No. La conexión para análisis es de solo lectura: Onyx lee tus operaciones para mostrarte tus números y el marcador del reto. El Onyx Guardian sí puede gestionar el riesgo (cerrar o frenar) según los límites que tú configures.`,
      en: `No. The analysis connection is read-only: Onyx reads your trades to show your numbers and the challenge scoreboard. Onyx Guardian can manage risk (close or stop) based on the limits you set.`,
    },
  },
  {
    q: { es: `¿Me pueden banear en ${firm} por usar Onyx?`, en: `Can ${firm} ban me for using Onyx?` },
    a: {
      es: `El análisis es de solo lectura, así que no afecta tu operativa. Si usas copy trading, Onyx incluye buenas prácticas anti-baneo (retardos aleatorios y filtros) para que las cuentas no operen idénticas. Aun así, revisa siempre las reglas de ${firm}.`,
      en: `Analysis is read-only, so it doesn’t affect your trading. If you use copy trading, Onyx includes anti-ban best practices (random delays and filters) so accounts don’t trade identically. Always review ${firm}’s rules.`,
    },
  },
  {
    q: { es: `¿Funciona con MetaTrader 4, 5 y cTrader?`, en: `Does it work with MetaTrader 4, 5 and cTrader?` },
    a: {
      es: `Sí. Onyx se conecta a MT4, MT5 y cTrader, así que puedes seguir tus cuentas de ${firm} sin importar la plataforma.`,
      en: `Yes. Onyx connects to MT4, MT5 and cTrader, so you can track your ${firm} accounts on any platform.`,
    },
  },
];

export const PROP_FIRMS: PropFirm[] = [
  {
    slug: 'ftmo',
    name: 'FTMO',
    tagline: { es: 'Sigue las reglas de FTMO y pasa el reto con datos', en: 'Track FTMO rules and pass the challenge with data' },
    seoTitle: { es: 'Seguimiento de reglas de FTMO con Onyx | Pasa el reto', en: 'FTMO rules tracker with Onyx | Pass the challenge' },
    seoDesc: {
      es: 'Sigue en vivo el drawdown, la pérdida diaria y la consistencia de tu reto de FTMO. Guardian, multi-cuenta y analítica real para traders de fondeo.',
      en: 'Track drawdown, daily loss and consistency of your FTMO challenge live. Guardian, multi-account and real analytics for funded traders.',
    },
    keywords: {
      es: ['seguimiento reglas ftmo', 'pasar el reto ftmo', 'drawdown ftmo', 'gestion de riesgo ftmo', 'ftmo metatrader', 'trader fondeado ftmo'],
      en: ['ftmo rules tracker', 'pass ftmo challenge', 'ftmo drawdown', 'ftmo risk management', 'ftmo metatrader', 'ftmo funded trader'],
    },
    intro: {
      es: 'FTMO es una de las prop firms más conocidas. Con Onyx conectas tu cuenta de FTMO y sigues el marcador de tu reto en tiempo real, mientras el Guardian cuida tu riesgo para que no rompas las reglas por un descuido.',
      en: 'FTMO is one of the best-known prop firms. With Onyx you connect your FTMO account and track your challenge scoreboard in real time, while Guardian protects your risk so a slip doesn’t break the rules.',
    },
    bullets: help('FTMO'),
    faq: commonFaq('FTMO'),
  },
  {
    slug: 'fundednext',
    name: 'FundedNext',
    tagline: { es: 'Controla tu reto de FundedNext sin sorpresas', en: 'Stay on top of your FundedNext challenge' },
    seoTitle: { es: 'Seguimiento de reglas de FundedNext con Onyx', en: 'FundedNext rules tracker with Onyx' },
    seoDesc: {
      es: 'Sigue el drawdown, la pérdida diaria y la consistencia de tu reto de FundedNext. Guardian, varias cuentas y analítica real en Onyx.',
      en: 'Track drawdown, daily loss and consistency of your FundedNext challenge. Guardian, multi-account and real analytics in Onyx.',
    },
    keywords: {
      es: ['seguimiento reglas fundednext', 'pasar reto fundednext', 'drawdown fundednext', 'gestion de riesgo fundednext', 'fundednext metatrader'],
      en: ['fundednext rules tracker', 'pass fundednext challenge', 'fundednext drawdown', 'fundednext risk management', 'fundednext metatrader'],
    },
    intro: {
      es: 'Si operas con FundedNext, Onyx te muestra en vivo cuánto margen te queda de drawdown y pérdida diaria, y el Guardian frena tu cuenta antes de que rompas una regla. Todo en un panel, con varias cuentas a la vez.',
      en: 'If you trade with FundedNext, Onyx shows you live how much drawdown and daily-loss room you have left, and Guardian stops your account before you break a rule. All in one dashboard, across multiple accounts.',
    },
    bullets: help('FundedNext'),
    faq: commonFaq('FundedNext'),
  },
  {
    slug: 'the5ers',
    name: 'The5ers',
    tagline: { es: 'Opera con The5ers cuidando cada regla', en: 'Trade The5ers while respecting every rule' },
    seoTitle: { es: 'Seguimiento de reglas de The5ers con Onyx', en: 'The5ers rules tracker with Onyx' },
    seoDesc: {
      es: 'Sigue el drawdown, la pérdida diaria y la consistencia de tu programa de The5ers. Guardian, multi-cuenta y analítica real en Onyx.',
      en: 'Track drawdown, daily loss and consistency of your The5ers program. Guardian, multi-account and real analytics in Onyx.',
    },
    keywords: {
      es: ['seguimiento reglas the5ers', 'the5ers reglas', 'drawdown the5ers', 'gestion de riesgo the5ers', 'the5ers metatrader'],
      en: ['the5ers rules tracker', 'the5ers rules', 'the5ers drawdown', 'the5ers risk management', 'the5ers metatrader'],
    },
    intro: {
      es: 'Con The5ers, la constancia y el control del riesgo lo son todo. Onyx sigue tu marcador en vivo y el Guardian mantiene tu pérdida bajo control para que avances de nivel sin sustos.',
      en: 'With The5ers, consistency and risk control are everything. Onyx tracks your scoreboard live and Guardian keeps your losses in check so you level up without scares.',
    },
    bullets: help('The5ers'),
    faq: commonFaq('The5ers'),
  },
  {
    slug: 'fundingpips',
    name: 'FundingPips',
    tagline: { es: 'Pasa tu reto de FundingPips con el riesgo bajo control', en: 'Pass your FundingPips challenge with risk under control' },
    seoTitle: { es: 'Seguimiento de reglas de FundingPips con Onyx', en: 'FundingPips rules tracker with Onyx' },
    seoDesc: {
      es: 'Sigue el drawdown, la pérdida diaria y la consistencia de tu reto de FundingPips. Guardian, varias cuentas y analítica real en Onyx.',
      en: 'Track drawdown, daily loss and consistency of your FundingPips challenge. Guardian, multi-account and real analytics in Onyx.',
    },
    keywords: {
      es: ['seguimiento reglas fundingpips', 'pasar reto fundingpips', 'drawdown fundingpips', 'gestion de riesgo fundingpips', 'fundingpips metatrader'],
      en: ['fundingpips rules tracker', 'pass fundingpips challenge', 'fundingpips drawdown', 'fundingpips risk management', 'fundingpips metatrader'],
    },
    intro: {
      es: 'Onyx conecta tu cuenta de FundingPips y te enseña, en tiempo real, cuánto te queda antes de tocar un límite. El Guardian frena por ti y los avisos por Telegram te mantienen tranquilo.',
      en: 'Onyx connects your FundingPips account and shows you, in real time, how far you are from a limit. Guardian stops for you and Telegram alerts keep you calm.',
    },
    bullets: help('FundingPips'),
    faq: commonFaq('FundingPips'),
  },
];

export const firmBySlug = (slug: string) => PROP_FIRMS.find((f) => f.slug === slug) || null;

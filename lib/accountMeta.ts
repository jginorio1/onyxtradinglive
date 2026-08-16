export type Lang = 'es' | 'en';

export const ACC_TYPES = [
  { key: 'challenge', es: 'Challenge', en: 'Challenge', color: '#2f6bff' },
  { key: 'funded', es: 'Real Fondeo', en: 'Funded', color: '#34e2a0' },
  { key: 'own', es: 'Capital Propio', en: 'Own Capital', color: '#ffd45e' },
  { key: 'demo', es: 'Demo', en: 'Demo', color: '#9aa6bd' },
];

export const CH_STATUS = [
  { key: 'running', es: 'En curso', en: 'Running', color: '#7c8cff' },
  { key: 'passed', es: 'Aprobado', en: 'Passed', color: '#34e2a0' },
  { key: 'failed', es: 'Reprobado', en: 'Failed', color: '#ff6b7d' },
];

export const typeMeta = (k?: string | null) => ACC_TYPES.find((t) => t.key === k);
export const statusMeta = (k?: string | null) => CH_STATUS.find((t) => t.key === k);
export const money2 = (n: number) => (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

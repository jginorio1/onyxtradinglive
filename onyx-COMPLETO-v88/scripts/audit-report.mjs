import fs from 'fs';

// Junta los resultados de Lighthouse + Playwright + type-check + npm audit
// en un solo JSON que se manda a /api/admin/audit.
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

const lh = read('lh.json');
const pw = read('pw-report.json');

let lighthouse = null, vitals = null;
if (lh?.categories) {
  const s = (k) => Math.round((lh.categories[k]?.score ?? 0) * 100);
  lighthouse = { url: '/', performance: s('performance'), accessibility: s('accessibility'), seo: s('seo'), best_practices: s('best-practices') };
  const a = lh.audits || {};
  const num = (k) => a[k]?.numericValue;
  const lcp = num('largest-contentful-paint');
  const cls = num('cumulative-layout-shift');
  const tbt = num('total-blocking-time');
  vitals = {
    lcp: lcp != null ? Math.round(lcp / 100) / 10 : 0,
    inp: tbt != null ? Math.round(tbt) : 0,
    cls: cls != null ? Math.round(cls * 100) / 100 : 0,
  };
}

const flows = [];
if (pw?.suites) {
  const walk = (suite) => {
    (suite.specs || []).forEach((spec) => {
      const ok = !!spec.ok || (spec.tests || []).every((t) => (t.results || []).every((r) => r.status === 'passed'));
      flows.push({ name: spec.title, ok });
    });
    (suite.suites || []).forEach(walk);
  };
  (pw.suites || []).forEach(walk);
}

const payload = {
  lighthouse, vitals, flows,
  code: {
    ts_errors: Number(process.env.TS_ERRORS) || 0,
    vulnerabilities: Number(process.env.VULNS) || 0,
  },
};
fs.writeFileSync('payload.json', JSON.stringify(payload));
console.log(JSON.stringify(payload, null, 2));

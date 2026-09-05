import React from 'react';

// Renderiza el texto plano de los legales editados desde el Landing Builder.
// Formato: 1ª línea no vacía = título (h1); líneas con "## " = subtítulo (h3);
// cualquier otra línea no vacía = párrafo. Líneas en blanco separan bloques.
export function renderLegal(text: string): React.ReactNode {
  const lines = (text || '').split('\n');
  const out: React.ReactNode[] = [];
  let titleDone = false;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('## ')) { out.push(<h3 key={i}>{line.slice(3)}</h3>); return; }
    if (!titleDone) { out.push(<h1 key={i}>{line}</h1>); titleDone = true; return; }
    out.push(<p key={i}>{line}</p>);
  });
  return <>{out}</>;
}

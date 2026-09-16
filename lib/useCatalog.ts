'use client';
import { useEffect, useState } from 'react';
import { CATALOG_DEFAULTS, type CatalogItem, type CatalogKind } from '@/lib/catalogDefaults';

// Lee un catálogo del admin (/api/catalog?kind=). Empieza con los valores por
// defecto para que nunca esté vacío, y los sustituye por los del admin al cargar.
// Se cachea en memoria para no repetir peticiones en la misma sesión.
const cache: Partial<Record<CatalogKind, CatalogItem[]>> = {};

export function useCatalog(kind: CatalogKind): CatalogItem[] {
  const [items, setItems] = useState<CatalogItem[]>(cache[kind] || CATALOG_DEFAULTS[kind]);
  useEffect(() => {
    if (cache[kind]) { setItems(cache[kind]!); return; }
    let alive = true;
    fetch('/api/catalog?kind=' + kind)
      .then((r) => r.json())
      .then((j) => { const arr = Array.isArray(j?.items) ? j.items : []; if (arr.length && alive) { cache[kind] = arr; setItems(arr); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [kind]);
  return items;
}

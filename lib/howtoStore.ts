// Guarda la guía "Cómo usar" (/como-usar) editada por el dueño en app_settings
// ('howto_guides'). Si no hay nada guardado, se usa la versión del código
// (DEFAULT_HOWTO). Así el dueño edita textos, pasos e imágenes desde Admin sin
// desplegar. SOLO SERVIDOR (usa app_settings): no lo importes en el cliente.
import { getSetting, saveSetting } from '@/lib/settings';
import { DEFAULT_HOWTO, type Cat } from '@/lib/howtoDefault';

const KEY = 'howto_guides';

export async function getHowto(): Promise<Cat[]> {
  try {
    const raw = await getSetting<Cat[]>(KEY, [] as any);
    if (Array.isArray(raw) && raw.length) return raw;
  } catch { /* si falla, devolvemos el del código */ }
  return DEFAULT_HOWTO;
}

export async function saveHowto(cats: Cat[]): Promise<void> {
  await saveSetting(KEY, cats.slice(0, 40));
}

// Vuelve a la versión del código (borra el override del dueño).
export async function resetHowto(): Promise<void> {
  await saveSetting(KEY, []);
}

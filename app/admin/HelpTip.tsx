'use client';
import { HintPop } from '@/app/components/HintPop';

// Ícono ⓘ con explicación al tocar: qué es el campo y qué poner. Se usa junto a
// las etiquetas del Motor de la fábrica. Delega en el popup robusto compartido
// (cierra al tocar fuera / con la X / Escape, y no se corta en el borde).
export function Help({ text }: { text: string }) {
  return <HintPop text={text} glyph="i" />;
}

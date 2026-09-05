'use client';
import OnyxIcon from '@/app/components/OnyxIcon';
export default function PrintButton({ label }: { label: string }) {
  return <button className="btn btn-ghost" onClick={() => window.print()} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="🖨" size={14} /> {label}</button>;
}

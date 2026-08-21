'use client';
export default function PrintButton({ label }: { label: string }) {
  return <button className="btn btn-ghost" onClick={() => window.print()} style={{ fontSize: 13 }}>🖨 {label}</button>;
}

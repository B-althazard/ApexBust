export default function HistoryPanel({ text }: { text?: string }) {
  return (
    <div className="card" style={{ padding: 12, background: 'var(--surface2)', boxShadow: 'none' }}>
      <div className="h2">Previous week</div>
      <div className="muted" style={{ fontSize: 12 }}>{text ?? 'No matching previous week session.'}</div>
    </div>
  );
}

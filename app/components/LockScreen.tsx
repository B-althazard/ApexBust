import { useUIStore } from '../uiStore'

export default function LockScreen() {
  const lock = useUIStore(s => s.lock);
  if (!lock) return null;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="h1">Another tab is active</div>
        <div className="muted" style={{ marginBottom: 12 }}>
          This app enforces single-tab usage to prevent data conflicts.
          Close other tabs and reload this one.
        </div>
        <button className="primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    </div>
  );
}

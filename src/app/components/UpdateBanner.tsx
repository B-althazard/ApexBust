import { useUIStore } from '../uiStore'
import { hardReloadToUpdate } from '../../pwa/registerSW'

export default function UpdateBanner() {
  const updateAvailable = useUIStore(s => s.updateAvailable);
  if (!updateAvailable) return null;
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="row between">
        <div>
          <div className="h2">Update available</div>
          <div className="muted">Refresh to load the latest version.</div>
        </div>
        <button className="primary" onClick={() => void hardReloadToUpdate()}>Refresh</button>
      </div>
    </div>
  );
}

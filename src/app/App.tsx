import { useEffect } from 'react'
import Shell from './layout/Shell'
import AppRoutes from './routes'
import { useSettingsStore } from '../state/settingsStore'

export default function App() {
  const load = useSettingsStore(s => s.load);

  useEffect(() => { void load(); }, [load]);

  return (
    <Shell>
      <AppRoutes />
    </Shell>
  )
}

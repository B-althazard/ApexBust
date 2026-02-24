import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import WorkoutPage from './pages/WorkoutPage'
import TrackerPage from './pages/TrackerPage'
import EndLogPage from './pages/EndLogPage'
import DataPage from './pages/DataPage'
import SettingsPage from './pages/SettingsPage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/workout/:date" element={<WorkoutPage />} />
      <Route path="/tracker/:sessionId" element={<TrackerPage />} />
      <Route path="/endlog/:sessionId" element={<EndLogPage />} />
      <Route path="/data" element={<DataPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

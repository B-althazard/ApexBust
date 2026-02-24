import BottomNav from './BottomNav'
import OfflineIndicator from '../components/OfflineIndicator'
import UpdateBanner from '../components/UpdateBanner'
import LockScreen from '../components/LockScreen'

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LockScreen />
      <div className="container">
        <OfflineIndicator />
        <UpdateBanner />
        {children}
      </div>
      <BottomNav />
    </>
  )
}

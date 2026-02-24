import { NavLink } from 'react-router-dom'

export default function BottomNav() {
  return (
    <div className="bottomNav" role="navigation" aria-label="Primary">
      <div className="inner">
        <NavLink className={({isActive}) => 'navBtn' + (isActive ? ' active' : '')} to="/">Home</NavLink>
        <NavLink className={({isActive}) => 'navBtn' + (isActive ? ' active' : '')} to="/workout/today">Workout</NavLink>
        <NavLink className={({isActive}) => 'navBtn' + (isActive ? ' active' : '')} to="/data">Data</NavLink>
        <NavLink className={({isActive}) => 'navBtn' + (isActive ? ' active' : '')} to="/settings">Settings</NavLink>
      </div>
    </div>
  )
}

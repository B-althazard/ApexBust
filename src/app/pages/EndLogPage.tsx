import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { finishSession } from '../../domain/services/SessionService'
import { buildFinalBackupBlob } from '../../domain/services/BackupService'
import type { EndLog } from '../../domain/models/types'

export default function EndLogPage() {
  const { sessionId } = useParams();
  const nav = useNavigate();

  const [performance, setPerformance] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [mindMuscle, setMindMuscle] = useState(3);
  const [mentalState, setMentalState] = useState('');
  const [preWorkoutUsed, setPreWorkoutUsed] = useState('');

  async function onSubmit() {
    const endLog: EndLog = { performance, energy, mindMuscle, mentalState: mentalState.trim() || undefined, preWorkoutUsed: preWorkoutUsed.trim() || undefined };
    await finishSession(sessionId!, endLog);
    // Permanent backup via Downloads (browser download)
    try {
      const blob = await buildFinalBackupBlob(sessionId!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ApexBust-backup-${new Date().toISOString().slice(0,10)}-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
    nav('/');
  }

  return (
    <>
      <div className="h1">End Log</div>
      <div className="card">
        <div className="grid" style={{ gap: 12 }}>
          <Field label="Performance (1–5)" value={performance} setValue={setPerformance} />
          <Field label="Energy (1–5)" value={energy} setValue={setEnergy} />
          <Field label="Mind-muscle (1–5)" value={mindMuscle} setValue={setMindMuscle} />
          <div>
            <label>Mental state</label>
            <input value={mentalState} onChange={(e)=>setMentalState(e.target.value)} />
          </div>
          <div>
            <label>Pre-workout used</label>
            <input value={preWorkoutUsed} onChange={(e)=>setPreWorkoutUsed(e.target.value)} />
          </div>
          <button className="primary" onClick={() => void onSubmit()}>Submit</button>
        </div>
      </div>
    </>
  )
}

function Field({ label, value, setValue }:{ label: string; value: number; setValue: (n:number)=>void }) {
  return (
    <div>
      <label>{label}</label>
      <input inputMode="numeric" value={value} onChange={(e)=>setValue(Math.max(1, Math.min(5, Number(e.target.value||3))))} />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../db/db'
import { toYMD, formatDisplayDate } from '../../utils/date'
import { startSessionFromSchedule } from '../../domain/services/SessionService'
import ExerciseCard from '../components/ExerciseCard'
import Modal from '../components/Modal'
import { convertWorkoutToRest, insertRestDay, generateWeekSchedule } from '../../domain/services/ScheduleService'
import { useSettingsStore } from '../../state/settingsStore'

type CTA =
  | { label: 'Start'; mode: 'START' }
  | { label: 'Resume'; mode: 'RESUME' }
  | { label: 'View'; mode: 'VIEW' }

export default function WorkoutPage() {
  const params = useParams()
  const nav = useNavigate()
  const settings = useSettingsStore((s) => s.settings)

  const date = params.date === 'today' || !params.date ? toYMD(new Date()) : params.date!

  const [schedule, setSchedule] = useState<any | null>(null)
  const [session, setSession] = useState<any | null>(null)

  const [exList, setExList] = useState<Array<{ de: any; ex: any; snippet?: string }>>([])

  // prompts
  const [swapPromptOpen, setSwapPromptOpen] = useState(false)
  const [resumeMissing, setResumeMissing] = useState(false)

  async function refresh() {
    if (settings) await generateWeekSchedule(date)

    const sch = await db.schedule.get({ date } as any)
    setSchedule(sch ?? null)

    const s = sch?.linkedSessionId
      ? await db.sessions.get(sch.linkedSessionId)
      : await db.sessions.where('date').equals(date).first()
    setSession(s ?? null)

    if (sch?.dayTemplateId) {
      const des = await db.dayExercises.where('dayTemplateId').equals(sch.dayTemplateId).sortBy('order')
      const exIds = des.map((d: any) => d.exerciseId)
      const exercises = exIds.length ? await db.exercises.where('id').anyOf(exIds).toArray() : []
      const byId = new Map(exercises.map((e: any) => [e.id, e]))

      // previous week snippet
      const prevDate = prevYMD(date)
      const prevSch = await db.schedule.get({ date: prevDate } as any).catch(() => null)
      const prevSess = prevSch?.linkedSessionId ? await db.sessions.get(prevSch.linkedSessionId) : null
      const prevSets = prevSess ? await db.sets.where('sessionId').equals(prevSess.id).toArray() : []

      setExList(
        des.map((de: any) => {
          const ex = byId.get(de.exerciseId)
          const ssets = prevSets.filter((ps: any) => ps.exerciseId === de.exerciseId && ps.setType === 'WORKING')
          const maxLoad = ssets.reduce((m: number, x: any) => (typeof x.load === 'number' ? Math.max(m, x.load) : m), 0)
          const last = ssets.length ? ssets[ssets.length - 1] : null
          const snippet = ssets.length ? `Last week: max ${maxLoad}${last?.reps ? ` • last reps ${last.reps}` : ''}` : undefined
          return { de, ex, snippet }
        })
      )
    } else {
      setExList([])
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, settings])

  const cta: CTA = useMemo(() => {
    if (!schedule) return { label: 'Start', mode: 'START' }
    if (session?.state === 'IN_PROGRESS') return { label: 'Resume', mode: 'RESUME' }
    if (schedule.state === 'COMPLETED') return { label: 'View', mode: 'VIEW' }
    return { label: 'Start', mode: 'START' }
  }, [schedule, session])

  async function onPrimary() {
    if (cta.mode === 'VIEW' && schedule?.linkedSessionId) {
      nav(`/tracker/${schedule.linkedSessionId}`)
      return
    }
    if (cta.mode === 'RESUME') {
      if (session?.id) {
        nav(`/tracker/${session.id}`)
      } else {
        setResumeMissing(true)
      }
      return
    }
    const id = await startSessionFromSchedule(date)
    nav(`/tracker/${id}`)
  }

  async function onConvertToRest() {
    if (!schedule) return
    await convertWorkoutToRest(date)
    await refresh()
  }

  async function onInsertRestDay() {
    // your rule: B > A (overlay centered prompt)
    setSwapPromptOpen(true)
  }

  async function confirmSwapYes() {
    setSwapPromptOpen(false)
    await insertRestDay(date, { preserveWeeklyStructure: true })
    await refresh()
  }

  async function confirmSwapNo() {
    setSwapPromptOpen(false)
    await insertRestDay(date, { preserveWeeklyStructure: false })
    await refresh()
  }

  const title = schedule?.title ?? 'Ad-hoc workout'
  const isRest = schedule?.type === 'REST'

  return (
    <div className="page">
      <header className="pageHeader">
        <div className="pageTitle">{title}</div>
        <div className="pageSubtitle">{formatDisplayDate(date)}</div>
      </header>

      <div className="buttonRow">
        <button className="btn primary" onClick={onPrimary}>
          {cta.label}
        </button>

        <button className="btn" onClick={onInsertRestDay}>
          Insert rest day
        </button>

        {!isRest && (
          <button className="btn danger" onClick={onConvertToRest}>
            Convert to rest
          </button>
        )}
      </div>

      {isRest ? (
        <div className="card">
          <div className="muted">Rest day</div>
        </div>
      ) : (
        <div className="stack">
          {exList.length === 0 ? (
            <div className="card">
              <div className="muted">No exercises found for this day.</div>
            </div>
          ) : (
            exList.map((row, idx) => (
              <ExerciseCard
                key={row.de?.id ?? idx}
                title={row.ex?.name ?? 'Exercise'}
                subtitle={row.snippet}
                prescription={row.de?.prescription}
              />
            ))
          )}
        </div>
      )}

      {/* Overlay prompt (centered) */}
      <Modal open={swapPromptOpen} title="Insert extra rest day" onClose={() => setSwapPromptOpen(false)}>
        <div className="modalBody">
          <div className="muted">Do you want to preserve the weekly structure by swapping with a default rest day?</div>
          <div className="buttonRow modalButtons">
            <button className="btn" onClick={() => setSwapPromptOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={confirmSwapYes}>
              Swap (keep structure)
            </button>
            <button className="btn danger" onClick={confirmSwapNo}>
              No (shorten week)
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={resumeMissing} title="Nothing to resume" onClose={() => setResumeMissing(false)}>
        <div className="modalBody">
          <div className="muted">No in-progress workout was found for this day.</div>
          <div className="buttonRow modalButtons">
            <button
              className="btn primary"
              onClick={() => {
                setResumeMissing(false)
                nav('/home')
              }}
            >
              OK
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function prevYMD(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() - 7)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
import { useStore } from '../state/store'

/** Shown while another tab owns the save: this tab mirrors it and its clock never runs. */
export function TabBanner() {
  const readOnly = useStore((s) => s.readOnly)
  const takeOver = useStore((s) => s.takeOver)
  if (!readOnly) return null
  return (
    <div className="tab-banner" role="status">
      This game is open in another tab. Close that tab, or take over here.
      <button className="btn sm" onClick={takeOver}>Take over</button>
    </div>
  )
}

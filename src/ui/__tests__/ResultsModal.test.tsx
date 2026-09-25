// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { withPendingResult } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { ResultsModal } from '../panels/ResultsModal'

beforeEach(() => {
  useStore.setState({ game: withPendingResult(), tutorialStep: 0, readOnly: false })
})

/**
 * ResultsModal assumes it is only ever mounted while `pendingResult` is set (App.tsx renders it as
 * `{hasResult && <ResultsModal />}` and unmounts it the instant dismissal clears the result). Mirror
 * that guard here so the component is not asked to render itself against a null result.
 */
function Harness() {
  const hasResult = useStore((s) => !!s.game?.pendingResult)
  return hasResult ? <ResultsModal /> : null
}

describe('ResultsModal', () => {
  it('clears the pending result and the tutorial hint when closed', () => {
    render(<Harness />)
    const closeButton = screen.getByRole('button', { name: /Back to the studio/i })

    fireEvent.click(closeButton)

    expect(useStore.getState().game!.pendingResult).toBeNull()
    expect(useStore.getState().tutorialStep).toBe(-1)
  })
})

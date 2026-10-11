// The visit's props (0.12.0): what the editor holds in the front hand (the envelope with the results, a letter, the
// serialisation contract, the year's trophy), each a small cast frame in PAL keys with a `hand` anchor, the cell the
// pose's front hand lands on; render draws one after the body at `frontHand(pose)` in the editor's palette, one
// drawImage, so the body frames never multiply by four props. Pure data; the ids match visitor.ts's VisitorProp.
import type { CastFrame, Part, Point } from './types'

export type VisitPropId = 'envelope' | 'letter' | 'contract' | 'trophy'

/** A prop: its map and hand anchor (a part, so partRules check it) and the frame the sprite cache draws. */
export interface VisitProp extends Part { readonly frame: CastFrame }

function prop(id: VisitPropId, map: readonly string[], hand: Point): VisitProp {
  return { map, anchors: { hand }, frame: { id: `prop.${id}`, map } }
}

/**
 * The envelope (6x4, held by its top edge a column in from the right corner): paper W, the flap's fold lines w down to
 * a point. The letter (5x6, held at its top): two lines of writing w on W. The contract (5x7): the blue heading R, the
 * body, the red seal M. The trophy (5x6, held by the cup's rim): the gold cup X on its stem over a wooden base D.
 */
export const VISIT_PROPS: Readonly<Record<VisitPropId, VisitProp>> = {
  envelope: prop('envelope', ['LLLLLL', 'LwWWwL', 'LWwwWL', 'LLLLLL'], { x: 3, y: 1 }),
  letter: prop('letter', ['LLLLL', 'LWWWL', 'LwwwL', 'LWWWL', 'LwwwL', 'LLLLL'], { x: 2, y: 1 }),
  contract: prop('contract', ['LLLLL', 'LWWWL', 'LRRRL', 'LWWWL', 'LWWWL', 'LWMWL', 'LLLLL'], { x: 2, y: 1 }),
  trophy: prop('trophy', ['LLLLL', 'LXXXL', '.LXL.', '.LXL.', 'LDDDL', 'LLLLL'], { x: 2, y: 2 }),
}

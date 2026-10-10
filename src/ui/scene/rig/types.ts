// The cast rig's types (0.11.0): parts with named anchors, poses that join them, the head's face slots, and the frame
// the sprite cache draws. Types and two small tables; no DOM and no sim, so scripts/ can load the rig.
import type { SpriteMap } from '../spriteCore'

export type { SpriteMap }

/** A mood the head shows (mood.ts `moodOf` picks it and re-exports this type). */
export type Mood = 'neutral' | 'happy' | 'tired' | 'surprised' | 'sleepy'

/** One frame the cast draws: its id (the sprite cache names its surfaces by it) and its map. */
export interface CastFrame { readonly id: string; readonly map: SpriteMap }

/** Where two parts join: the torso has all five, a head its neck, an arm its shoulder and hand, a leg its hip, a prop its hand. */
export type AnchorName = 'neck' | 'shoulderL' | 'shoulderR' | 'hipL' | 'hipR' | 'hand'

/** A cell inside a part's map: column x, row y. */
export interface Point { readonly x: number; readonly y: number }

/** One hand-drawn piece of a character: a string map in PAL keys and its anchors (each inside the map, on a painted cell). */
export interface Part {
  readonly map: SpriteMap
  readonly anchors: Readonly<Partial<Record<AnchorName, Point>>>
}

/** A rectangle inside a part: its top-left cell, width and height. */
export interface Slot { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/** The head: a part with three face slots (the eyes and the mouth in the face, the mark beside the hair's top-right). */
export interface HeadPart extends Part {
  readonly slots: { readonly eyes: Slot; readonly mouth: Slot; readonly mark: Slot }
}

export type EyesId = 'open' | 'blink' | 'closed' | 'ring' | 'squint' | 'happy'
export type MouthId = 'closed' | 'open' | 'smile' | 'frown' | 'o'
export type MarkId = 'none' | 'sweat' | 'sparkle' | 'bang' | 'zee'

/** A face: one drawing per slot. */
export interface Face { readonly eyes: EyesId; readonly mouth: MouthId; readonly mark: MarkId }

/** Every face drawing: the eyes and the mouths fill their slot whole (no '.'); a mark leaves its '.' cells clear. */
export interface FaceArt {
  readonly eyes: Readonly<Record<EyesId, SpriteMap>>
  readonly mouths: Readonly<Record<MouthId, SpriteMap>>
  readonly marks: Readonly<Record<Exclude<MarkId, 'none'>, SpriteMap>>
}

/** The layers, back to front. */
export type Layer = 'armBack' | 'legBack' | 'legFront' | 'torso' | 'head' | 'armFront' | 'prop'
export const LAYERS: readonly Layer[] = ['armBack', 'legBack', 'legFront', 'torso', 'head', 'armFront', 'prop']

/** The anchor each layer joins on: its parent's anchor of the same name (the torso's; a prop's parent is the front arm). */
export const JOIN: Readonly<Record<Exclude<Layer, 'torso'>, AnchorName>> = {
  armBack: 'shoulderR', legBack: 'hipR', legFront: 'hipL', head: 'neck', armFront: 'shoulderL', prop: 'hand',
}

/** A part placed by its join anchor, nudged by (dx, dy) when a pose needs it (a breath, a glance). */
export interface Place { readonly part: string; readonly dx?: number; readonly dy?: number }

/** A pose built from parts: the frame's size, the torso's top-left in it, every other layer by its anchor. */
export interface PartPose {
  readonly kind: 'parts'
  readonly w: number
  readonly h: number
  readonly torso: { readonly part: string; readonly x: number; readonly y: number }
  readonly head: Place
  readonly armBack?: Place
  readonly legBack?: Place
  readonly legFront?: Place
  readonly armFront?: Place
  readonly prop?: Place
  /** Slots the pose fixes over the mood's face (a blink's eyes, a sip's closed eyes). */
  readonly face?: Partial<Face>
}

/** A pose the parts cannot make, hand-drawn whole, its face baked in. */
export interface KeyPose { readonly kind: 'key'; readonly map: SpriteMap }

export type Pose = PartPose | KeyPose

/** The parts a pose may name, the head among them. */
export type PartLib = Readonly<Record<string, Part | HeadPart>>

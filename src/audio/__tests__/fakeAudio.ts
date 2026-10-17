/**
 * A recording stand-in for the Web Audio API, for node-environment tests. It records every node created, every
 * connection, every param write and ramp, source start/stop times, and suspend/resume/close calls. Its `state` and
 * `currentTime` are plain fields a test can set. Tests hand it to the code under test with `as unknown as AudioContext`.
 */

export type ParamEvent =
  | { kind: 'value'; value: number }
  | { kind: 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime'; value: number; time: number }
  | { kind: 'setTargetAtTime'; value: number; time: number; timeConstant: number }
  | { kind: 'cancelScheduledValues' | 'cancelAndHoldAtTime'; time: number }

export class FakeParam {
  readonly events: ParamEvent[] = []
  /** Every node connected into this param (a modulator), in order. */
  readonly inputs: FakeNode[] = []
  #value: number
  /** Present by default; a context made with `cancelAndHold: false` removes it (as in Firefox). */
  cancelAndHoldAtTime: ((time: number) => FakeParam) | undefined = (time) => {
    this.events.push({ kind: 'cancelAndHoldAtTime', time })
    return this
  }

  constructor(value: number) {
    this.#value = value
  }

  get value(): number {
    return this.#value
  }

  set value(value: number) {
    this.#value = value
    this.events.push({ kind: 'value', value })
  }

  /** Where the param is heading: the value of the last write or scheduled change, else its initial value. */
  get target(): number {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i]
      if ('value' in e) return e.value
    }
    return this.#value
  }

  setValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'setValueAtTime', value, time })
    return this
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'linearRampToValueAtTime', value, time })
    return this
  }

  /** Throws like the real API: an exponential ramp cannot reach zero, a negative or a non-finite value. */
  exponentialRampToValueAtTime(value: number, time: number): this {
    if (!(value > 0) || !Number.isFinite(value)) throw new RangeError(`exponential ramp target ${value} is not positive`)
    this.events.push({ kind: 'exponentialRampToValueAtTime', value, time })
    return this
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): this {
    this.events.push({ kind: 'setTargetAtTime', value, time, timeConstant })
    return this
  }

  cancelScheduledValues(time: number): this {
    this.events.push({ kind: 'cancelScheduledValues', time })
    return this
  }
}

export class FakeNode {
  readonly kind: string
  /** Every node this one was connected to, in order. */
  readonly connections: FakeNode[] = []
  /** Every param this one was connected to (it modulates them), in order. */
  readonly paramConnections: FakeParam[] = []
  /** True once `disconnect()` was called with no target. */
  disconnected = false
  /** Every `disconnect` call's argument, in order (undefined for the no-target form). */
  readonly disconnects: (FakeNode | FakeParam | undefined)[] = []

  constructor(kind: string) {
    this.kind = kind
  }

  connect(to: FakeParam): void
  connect<T extends FakeNode>(to: T): T
  connect(to: FakeNode | FakeParam): FakeNode | void {
    if (to instanceof FakeParam) {
      this.paramConnections.push(to)
      to.inputs.push(this)
      return
    }
    this.connections.push(to)
    return to
  }

  disconnect(target?: FakeNode | FakeParam): void {
    this.disconnects.push(target)
    if (target === undefined) this.disconnected = true
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1)
  constructor() {
    super('gain')
  }
}

export class FakeBiquad extends FakeNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeParam(350)
  readonly Q = new FakeParam(1)
  constructor() {
    super('biquad')
  }
}

export class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam(0)
  readonly maxDelayTime: number
  constructor(maxDelayTime: number) {
    super('delay')
    this.maxDelayTime = maxDelayTime
  }
}

export class FakeConvolver extends FakeNode {
  normalize = true
  /** `normalize` as it stood when `buffer` was last set (the real node reads it then). */
  normalizeAtBuffer: boolean | null = null
  #buffer: FakeBuffer | null = null
  constructor() {
    super('convolver')
  }

  get buffer(): FakeBuffer | null {
    return this.#buffer
  }

  set buffer(buffer: FakeBuffer | null) {
    this.normalizeAtBuffer = this.normalize
    this.#buffer = buffer
  }
}

export class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(-24)
  readonly knee = new FakeParam(30)
  readonly ratio = new FakeParam(12)
  readonly attack = new FakeParam(0.003)
  readonly release = new FakeParam(0.25)
  constructor() {
    super('compressor')
  }
}

/** Oscillators and buffer sources: one per voice. */
export class FakeSource extends FakeNode {
  readonly starts: number[] = []
  readonly offsets: number[] = []
  readonly stops: number[] = []
  onended: (() => void) | null = null

  start(when = 0, offset = 0): void {
    this.starts.push(when)
    this.offsets.push(offset)
  }

  stop(when = 0): void {
    this.stops.push(when)
  }

  /** Fire 'ended', as the browser does once the source has stopped. */
  end(): void {
    this.onended?.()
  }
}

export class FakeOscillator extends FakeSource {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeParam(440)
  constructor() {
    super('oscillator')
  }
}

export class FakeBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  readonly #channels: Float32Array[]

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels
    this.length = length
    this.sampleRate = sampleRate
    this.#channels = Array.from({ length: channels }, () => new Float32Array(length))
  }

  getChannelData(channel: number): Float32Array {
    return this.#channels[channel]
  }
}

export class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null
  loop = false
  readonly playbackRate = new FakeParam(1)
  constructor() {
    super('bufferSource')
  }
}

export type FakeCall = 'suspend' | 'resume' | 'close'

export class FakeAudioContext {
  state: AudioContextState
  currentTime = 0
  /** Low, to keep the one-second noise buffer cheap in tests. */
  readonly sampleRate = 8000
  readonly destination = new FakeNode('destination')
  readonly nodes: FakeNode[] = []
  readonly buffers: FakeBuffer[] = []
  readonly calls: FakeCall[] = []
  /** Whether resume() reaches 'running'. False models a resume that is still pending until the test sets `state`. */
  resumes: boolean
  readonly #cancelAndHold: boolean

  constructor(o: { state?: AudioContextState; resumes?: boolean; cancelAndHold?: boolean } = {}) {
    this.state = o.state ?? 'running'
    this.resumes = o.resumes ?? true
    this.#cancelAndHold = o.cancelAndHold ?? true
  }

  createGain(): FakeGain {
    return this.#track(new FakeGain())
  }

  createBiquadFilter(): FakeBiquad {
    return this.#track(new FakeBiquad())
  }

  createDynamicsCompressor(): FakeCompressor {
    return this.#track(new FakeCompressor())
  }

  createDelay(maxDelayTime = 1): FakeDelay {
    return this.#track(new FakeDelay(maxDelayTime))
  }

  createConvolver(): FakeConvolver {
    return this.#track(new FakeConvolver())
  }

  createOscillator(): FakeOscillator {
    return this.#track(new FakeOscillator())
  }

  createBufferSource(): FakeBufferSource {
    return this.#track(new FakeBufferSource())
  }

  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    const buffer = new FakeBuffer(channels, length, sampleRate)
    this.buffers.push(buffer)
    return buffer
  }

  suspend(): Promise<void> {
    this.calls.push('suspend')
    this.state = 'suspended'
    return Promise.resolve()
  }

  resume(): Promise<void> {
    this.calls.push('resume')
    if (this.resumes) this.state = 'running'
    return Promise.resolve()
  }

  close(): Promise<void> {
    this.calls.push('close')
    this.state = 'closed'
    return Promise.resolve()
  }

  get sources(): FakeSource[] {
    return this.nodes.filter((n): n is FakeSource => n instanceof FakeSource)
  }

  #track<T extends FakeNode>(node: T): T {
    if (!this.#cancelAndHold) {
      for (const field of Object.values(node)) if (field instanceof FakeParam) field.cancelAndHoldAtTime = undefined
    }
    this.nodes.push(node)
    return node
  }
}

/** The fake as the real type, for code under test. */
export function asContext(fake: FakeAudioContext): AudioContext {
  return fake as unknown as AudioContext
}

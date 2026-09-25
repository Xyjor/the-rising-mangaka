/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The simulation must be deterministic and locale-free: no clocks, no random source, no locale formatting.
// The pattern is assembled from fragments so a grep for the forbidden names over src/sim stays empty.
const FILES = [
  'engine.ts', 'rng.ts', 'scoring.ts', 'data.ts', 'compat.ts', 'milestones.ts', 'migrate.ts', 'bot.ts', 'forecast.ts',
  'balance.ts', 'rival.ts',
]
const FORBIDDEN = new RegExp(
  ['toLocale' + 'String', 'Intl' + '\\.', 'Math' + '\\.random', 'new ' + 'Date\\(', 'Date' + '\\.now'].join('|'),
)

describe('sim purity', () => {
  for (const file of FILES) {
    it(`${file} uses no clock, random source or locale formatting`, () => {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
      expect(src).not.toMatch(FORBIDDEN)
    })
  }
})

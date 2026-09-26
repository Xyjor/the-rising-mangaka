/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The simulation must be deterministic and locale-free: no clocks, no random source, no locale formatting.
// The pattern is assembled from fragments so a grep for the forbidden names over src/sim stays empty.
// Every .ts file in src/sim is checked, so a new sim file is covered the day it lands.
const FILES = readdirSync(fileURLToPath(new URL('..', import.meta.url))).filter((f) => f.endsWith('.ts'))
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

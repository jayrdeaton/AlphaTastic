// Builds assets/fonts/AlphaSketch.otf and AlphaSketch-Bold.otf, AlphaTastic's title and label font (Jay, 2026-11-19: "maybe it should be
// that font", the one the board draws its letters in). Run with `npm run font` after changing anything
// here; the font file is committed, so the app needs none of this to run.
//
// The letters are Hershey Roman Simplex, the single-stroke plotter font the board's sketch letters come
// from (src/modes/shared/letterformsHershey.ts has its capitals baked in). This reads the original data
// file the `hershey` package ships (rowmans.jhf: printable ASCII, digits included), smooths every stroke
// the way the board does (sketchLetter.tsx's catmullRomPath), and thickens each one into a filled outline
// with round ends and joins (clipper-lib), so a title set in it reads as the board's own pen.
//
// The Hershey data's license asks that its acknowledgements go with anything made from it: they're in
// the font's own copyright and license fields, and in assets/fonts/AlphaSketch-NOTICE.md.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import opentype from 'opentype.js'

const require = createRequire(import.meta.url)
const ClipperLib = require('clipper-lib')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'node_modules/hershey/font/jhf/rowmans.jhf')
// Every character's width, for sizing a title to fit before it's drawn (constants/typography.ts).
const ADVANCES_OUTPUT = join(ROOT, 'src/constants/titleFontAdvances.generated.ts')

export const UNITS_PER_EM = 1000
// Hershey's capitals run from y -12 to the baseline at 9 (y grows down): 21 units, set 700 tall.
const HERSHEY_BASELINE = 9
const SCALE = 700 / 21
// Two pens over the same strokes. The title's: the board draws its letters' strokes about a tenth of
// their height wide (SketchWord's metrics), a little heavier here, since a title is read at a glance.
// The label's, heavier (Jay, 2026-11-19: the Stats cards' 12pt headings looked thin beside their bold
// numbers): a small label needs more ink to read as a heading.
const WEIGHTS = [
  { family: 'AlphaSketch', style: 'Regular', stroke: 74, file: 'AlphaSketch.otf' },
  { family: 'AlphaSketchBold', style: 'Bold', stroke: 124, file: 'AlphaSketch-Bold.otf' }
]
// Clipper works in integers: font units times this, for smooth round ends.
const PRECISION = 16
// Points per smoothed segment between two of Hershey's points.
const CURVE_STEPS = 8
const ASCENDER = 900
const DESCENDER = -300

const ACKNOWLEDGEMENTS =
  'The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the U. S. National Bureau of Standards. The format of the Font data in this distribution was originally created by James Hurt, Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821.'

// One glyph of a .jhf file: its left and right bearings and its strokes, every coordinate a letter
// offset from 'R' (pen up between strokes is " R").
const parseGlyph = (line) => {
  const body = line.slice(8)
  const value = (char) => char.charCodeAt(0) - 'R'.charCodeAt(0)
  const left = value(body[0])
  const right = value(body[1])
  const strokes = []
  let stroke = []
  for (let i = 2; i < body.length; i += 2) {
    if (body[i] === ' ' && body[i + 1] === 'R') {
      if (stroke.length > 0) strokes.push(stroke)
      stroke = []
      continue
    }
    stroke.push([value(body[i]), value(body[i + 1])])
  }
  if (stroke.length > 0) strokes.push(stroke)
  return { left, right, strokes }
}

// Font units, y up, from Hershey's, with the glyph's left bearing at x 0.
const toFont = ([x, y], left) => [(x - left) * SCALE, (HERSHEY_BASELINE - y) * SCALE]

const cubic = (p0, c1, c2, p1, t) => {
  const u = 1 - t
  return [u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1]]
}

// The board's smoothing (catmullRomPath): one Catmull-Rom curve through a round stroke's own points,
// clamped at its ends; a two-point stroke stays straight. Sampled into a polyline for the pen.
const smooth = (points) => {
  if (points.length < 3) return points
  const last = points.length - 1
  const out = [points[0]]
  for (let i = 0; i < last; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(last, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    for (let step = 1; step <= CURVE_STEPS; step++) out.push(cubic(p1, c1, c2, p2, step / CURVE_STEPS))
  }
  return out
}

// Every stroke drawn with a round pen `stroke` wide, overlaps merged into one outline.
const outline = (strokes, left, stroke) => {
  const offset = new ClipperLib.ClipperOffset(2, 0.15 * PRECISION)
  for (const line of strokes) {
    const points = smooth(line.map((point) => toFont(point, left)))
    const path = points.map(([x, y]) => ({ X: Math.round(x * PRECISION), Y: Math.round(y * PRECISION) }))
    // A one-point stroke (a dot) is a round blob: the pen pressed once.
    if (path.length === 1) path.push({ X: path[0].X + 1, Y: path[0].Y })
    offset.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound)
  }
  const solution = new ClipperLib.Paths()
  offset.Execute(solution, (stroke / 2) * PRECISION)
  return ClipperLib.Clipper.SimplifyPolygons(solution, ClipperLib.PolyFillType.pftNonZero)
}

const glyphPath = (polygons) => {
  const path = new opentype.Path()
  for (const polygon of polygons) {
    if (polygon.length < 3) continue
    polygon.forEach(({ X, Y }, i) => (i === 0 ? path.moveTo : path.lineTo).call(path, Math.round(X / PRECISION), Math.round(Y / PRECISION)))
    path.close()
  }
  return path
}

const lines = readFileSync(SOURCE, 'utf8')
  .split('\n')
  .filter((line) => line.trim().length > 0)
if (lines.length !== 96) throw new Error(`Expected 96 glyphs (printable ASCII) in rowmans.jhf, found ${lines.length}`)

const glyphsFor = (stroke) => {
  const glyphs = [new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: Math.round(16 * SCALE), path: new opentype.Path() })]
  lines.forEach((line, index) => {
    const code = 32 + index
    const { left, right, strokes } = parseGlyph(line)
    const name = code === 32 ? 'space' : `uni${code.toString(16).toUpperCase().padStart(4, '0')}`
    glyphs.push(new opentype.Glyph({ name, unicode: code, advanceWidth: Math.round((right - left) * SCALE), path: glyphPath(outline(strokes, left, stroke)) }))
  })
  return glyphs
}

// Both weights share every character's width (the pen is centered on the same strokes).
const advances = {}
lines.forEach((line, index) => {
  const { left, right } = parseGlyph(line)
  advances[String.fromCharCode(32 + index)] = Math.round((right - left) * SCALE)
})

for (const { family, style, stroke, file } of WEIGHTS) {
  const font = new opentype.Font({
    familyName: family,
    styleName: style,
    unitsPerEm: UNITS_PER_EM,
    ascender: ASCENDER,
    descender: DESCENDER,
    copyright: ACKNOWLEDGEMENTS,
    license: `Made from the Hershey Fonts' Roman Simplex data. ${ACKNOWLEDGEMENTS}`,
    designer: 'Dr. A. V. Hershey (letterforms); outlines by Infinite Token',
    glyphs: glyphsFor(stroke)
  })
  const output = join(ROOT, 'assets/fonts', file)
  writeFileSync(output, Buffer.from(font.toArrayBuffer()))
  console.log(`Wrote ${output}`)
}
writeFileSync(
  ADVANCES_OUTPUT,
  `// Generated by scripts/buildTitleFont.mjs (npm run font). Do not edit manually.\n// Each character's advance width in AlphaSketch (both weights), in units of a ${UNITS_PER_EM}-unit em.\nexport const TITLE_FONT_ADVANCES: Record<string, number> = ${JSON.stringify(advances, null, 2)}\n`
)
console.log(`Wrote ${ADVANCES_OUTPUT}`)

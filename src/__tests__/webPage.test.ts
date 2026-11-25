import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The web build's one page (public/index.html, the template `single` output fills): its title, description, canonical
// link and link preview, which search engines and link previews read before any JavaScript runs.

const html = readFileSync(join(__dirname, '..', '..', 'public', 'index.html'), 'utf8')
const TITLE = 'AlphaTastic | Infinite Token Games'
const URL = 'https://games.infinitetoken.com/alphatastic/'
const IMAGE = 'https://games.infinitetoken.com/images/og.png'

const meta = (attribute: 'name' | 'property', key: string) => html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`))?.[1]

describe('the web page', () => {
  it('has a title, in English', () => {
    expect(html).toContain(`<title>${TITLE}</title>`)
    expect(html).toContain('<html lang="en">')
  })

  it('describes the games the same way everywhere', () => {
    const description = meta('name', 'description')
    expect(description).toMatch(/^Hangman, Word Search, Jumble and Cryptogram, /)
    expect(meta('property', 'og:description')).toBe(description)
    expect(meta('name', 'twitter:description')).toBe(description)
  })

  it('names its address and link preview', () => {
    expect(html).toContain(`<link rel="canonical" href="${URL}" />`)
    expect(meta('property', 'og:url')).toBe(URL)
    expect(meta('property', 'og:title')).toBe(TITLE)
    expect(meta('name', 'twitter:title')).toBe(TITLE)
    expect(meta('property', 'og:image')).toBe(IMAGE)
    expect(meta('name', 'twitter:image')).toBe(IMAGE)
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
  })

  it('uses no em or en dashes', () => {
    expect(html).not.toMatch(/[–—]/)
  })
})

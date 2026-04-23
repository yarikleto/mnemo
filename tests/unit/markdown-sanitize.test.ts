import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: ['http', 'https', 'mailto', 'mnemo-asset'],
    src: ['http', 'https', 'data', 'mnemo-asset'],
  },
}

async function renderMarkdown(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .process(md)
  return String(file)
}

describe('markdown-sanitize', () => {
  it('strips javascript: href from links', async () => {
    const html = await renderMarkdown('[click](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('<a')
  })

  it('preserves https: href on links', async () => {
    const html = await renderMarkdown('[ok](https://example.com)')
    expect(html).toContain('href="https://example.com"')
  })

  it('strips javascript: src from images', async () => {
    const html = await renderMarkdown('![x](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
  })

  it('preserves relative image src', async () => {
    const html = await renderMarkdown('![ok](./assets/foo.png)')
    expect(html).toContain('./assets/foo.png')
  })

  it('preserves mnemo-asset: src in images', async () => {
    const html = await renderMarkdown('![ok](mnemo-asset://cards/image.png)')
    expect(html).toContain('mnemo-asset://')
  })
})

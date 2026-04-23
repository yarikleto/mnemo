import { useEffect, useState } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeReact, { type Options } from 'rehype-react'
import * as prod from 'react/jsx-runtime'
import { getHighlighter } from 'shiki'
import { resolveAssetUrl } from '../lib/asset-url'

const reactOpts: Options = { jsx: prod.jsx, jsxs: prod.jsxs, Fragment: prod.Fragment }
let highlighterPromise: ReturnType<typeof getHighlighter> | null = null
function getSharedHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = getHighlighter({ themes: ['github-light', 'github-dark'], langs: ['ts', 'tsx', 'js', 'python', 'go', 'rust', 'bash', 'json', 'sql', 'yaml', 'md'] })
  }
  return highlighterPromise
}

export function MarkdownView({ content, basePath, className }: { content: string; basePath?: string; className?: string }) {
  const [node, setNode] = useState<React.ReactNode>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const hl = await getSharedHighlighter()
      const file = await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: false })
        .use(rehypeReact, {
          ...reactOpts,
          components: {
            code: ({ className, children, ...rest }: any) => {
              const match = /language-(\w+)/.exec(className ?? '')
              if (!match) return <code className={className} {...rest}>{children}</code>
              const lang = match[1]!
              const theme = document.documentElement.classList.contains('dark') ? 'github-dark' : 'github-light'
              const html = hl.codeToHtml(String(children).replace(/\n$/, ''), { lang, theme })
              return <div dangerouslySetInnerHTML={{ __html: html }} />
            },
            img: ({ src, alt, ...rest }: any) => (
              <img src={resolveAssetUrl(String(src ?? ''), basePath)} alt={alt} {...rest} />
            )
          }
        })
        .process(content)
      if (!cancelled) setNode(file.result as React.ReactNode)
    })()
    return () => { cancelled = true }
  }, [content, basePath])
  return <div className={className ?? 'prose max-w-none font-serif text-[17px] leading-relaxed'}>{node}</div>
}

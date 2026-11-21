import { ThemeProvider } from '@/components/shell/ThemeProvider'
import { inter, jetbrainsMono } from '@/lib/fonts'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'CivilCode Studio',
    template: '%s · CivilCode Studio',
  },
  description:
    'Plataforma integral de ingeniería estructural: importa ETABS, analiza, diseña, despieza, genera planos y comparte con tus clientes.',
}

const noFlash = `
try {
  var t = localStorage.getItem('cc-theme');
  var resolved = t === 'dark' ? 'dark'
    : t === 'light' ? 'light'
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', resolved);
} catch (e) {}
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}

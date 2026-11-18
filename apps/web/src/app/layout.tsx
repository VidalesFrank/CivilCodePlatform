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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}

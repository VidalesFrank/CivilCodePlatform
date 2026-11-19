'use client'

import Link from 'next/link'
import { Fragment } from 'react'

export interface BreadcrumbItem {
  href?: string
  label: string
}

/** Breadcrumb mono/uppercase estilo PerformanceLabs. */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="cc-breadcrumb">
      {items.map((item, i) => (
        <Fragment key={`${item.label}-${i}`}>
          {i > 0 && <span className="cc-breadcrumb-sep" aria-hidden>/</span>}
          {item.href && i < items.length - 1 ? (
            <Link
              href={item.href}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 focus-visible:ring-offset-1 rounded-sm"
            >
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? 'text-cc-gray-900 dark:text-white' : ''}>
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

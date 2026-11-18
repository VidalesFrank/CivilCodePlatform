import type { IconProps } from '@civilcode/icons'
import { Badge, Card, CardContent, CardDescription, CardTitle } from '@civilcode/ui'
import type { ComponentType } from 'react'

interface Props {
  title: string
  phase: string
  description: string
  Icon: ComponentType<IconProps>
}

export function UnderConstruction({ title, phase, description, Icon }: Props) {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="font-bold text-3xl text-cc-gray-900 dark:text-white">{title}</h1>
        <Badge variant="warning">{phase}</Badge>
      </div>
      <Card>
        <CardContent className="py-16 text-center">
          <Icon size={64} className="mx-auto mb-4 text-cc-gray-400" />
          <CardTitle className="text-base">En construcción</CardTitle>
          <CardDescription className="mt-2">{description}</CardDescription>
        </CardContent>
      </Card>
    </div>
  )
}

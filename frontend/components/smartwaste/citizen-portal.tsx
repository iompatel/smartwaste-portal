'use client'

import { SmartWastePortal } from './smartwaste-portal'
import type { View } from './data'

export function CitizenPortal({ initialView = 'overview' }: { initialView?: View }) {
  return <SmartWastePortal initialRole="citizen" initialView={initialView} lockRole={true} />
}

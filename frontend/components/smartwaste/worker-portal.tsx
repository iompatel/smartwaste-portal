'use client'

import { SmartWastePortal } from './smartwaste-portal'
import type { View } from './data'

export function WorkerPortal({ initialView = 'overview' }: { initialView?: View }) {
  return <SmartWastePortal initialRole="worker" initialView={initialView} lockRole={true} />
}

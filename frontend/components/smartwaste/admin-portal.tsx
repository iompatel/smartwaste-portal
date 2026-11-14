'use client'

import { SmartWastePortal } from './smartwaste-portal'
import type { View } from './data'

export function AdminPortal({ initialView = 'overview' }: { initialView?: View }) {
  return <SmartWastePortal initialRole="admin" initialView={initialView} lockRole={true} />
}

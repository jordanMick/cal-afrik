'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SuccessPage() {
  const router = useRouter()

  useEffect(() => {
    setTimeout(() => {
      router.push('/scanner')
    }, 2000)
  }, [])

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h1>✅ Paiement réussi</h1>
      <p>Activation en cours...</p>
    </div>
  )
}
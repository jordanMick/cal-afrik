'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Vérification du paiement...')

  useEffect(() => {
    async function verifyPayment() {
      if (!sessionId) {
        setStatus('error')
        setMessage('ID de session manquant')
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ transactionId: sessionId })
        })

        const data = await res.json()
        if (data.success) {
          setStatus('success')
          setMessage('Paiement confirmé ! Votre compte a été mis à jour.')
          toast.success('Paiement réussi !')
          setTimeout(() => router.push('/scanner'), 3000)
        } else {
          setStatus('error')
          setMessage(data.message || 'Le paiement n\'a pas encore été confirmé.')
        }
      } catch (err) {
        console.error('Erreur verification:', err)
        setStatus('error')
        setMessage('Erreur lors de la vérification.')
      }
    }

    verifyPayment()
  }, [sessionId, router])

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '20px',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        padding: '40px',
        borderRadius: '24px',
        border: '0.5px solid var(--border-color)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
      }}>
        {status === 'loading' && (
          <Loader2 className="animate-spin" size={48} color="var(--accent)" style={{ margin: '0 auto 20px' }} />
        )}
        {status === 'success' && (
          <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 20px' }} />
        )}
        {status === 'error' && (
          <XCircle size={48} color="var(--danger)" style={{ margin: '0 auto 20px' }} />
        )}

        <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>
          {status === 'loading' ? 'Vérification' : status === 'success' ? 'Succès !' : 'Oups !'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
          {message}
        </p>

        {status === 'error' && (
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Réessayer la vérification
          </button>
        )}

        {status === 'success' && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Redirection automatique vers le scanner...
          </p>
        )}
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <SuccessContent />
    </Suspense>
  )
}
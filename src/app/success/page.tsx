'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react'

// ─── Config du polling ────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 12     // 12 × 5s = 60 secondes max
const POLL_INTERVAL_MS = 5000

type PageStatus = 'loading' | 'polling' | 'success' | 'error' | 'timeout'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Maketou peut passer ?cartId= ou ?session_id= dans l'URL de redirection
  const cartIdFromUrl = searchParams.get('cartId') || searchParams.get('session_id')

  const [status, setStatus] = useState<PageStatus>('loading')
  const [message, setMessage] = useState('Vérification du paiement...')
  const [attempts, setAttempts] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function getCartId(): Promise<string | null> {
      if (cartIdFromUrl) return cartIdFromUrl
      // Fallback : cartId stocké au moment du checkout
      return localStorage.getItem('pending_maketou_cart_id')
    }

    async function pollVerification(cartId: string, attempt: number) {
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
          body: JSON.stringify({ cartId })
        })

        const data = await res.json()

        if (data.success) {
          // ✅ Webhook a bien traité le paiement
          if (intervalRef.current) clearInterval(intervalRef.current)
          localStorage.removeItem('pending_maketou_cart_id')
          setStatus('success')
          setMessage('Paiement confirmé ! Votre compte a été mis à jour.')
          toast.success('Paiement réussi ! 🎉')
          setTimeout(() => router.push('/scanner'), 3000)
          return
        }

        if (data.status === 'waiting') {
          // Paiement en cours — on continue à poller
          setStatus('polling')
          setMessage(`Attente de confirmation Maketou… (${attempt}/${MAX_ATTEMPTS})`)
          return
        }

        // Statut négatif explicite (failed, abandoned…)
        if (intervalRef.current) clearInterval(intervalRef.current)
        setStatus('error')
        setMessage(data.message || 'Le paiement a échoué ou a été abandonné.')

      } catch (err) {
        console.error('[Success] Erreur polling:', err)
        // On ne coupe pas le polling sur une erreur réseau ponctuelle
      }
    }

    async function start() {
      const cartId = await getCartId()

      if (!cartId) {
        setStatus('error')
        setMessage('Impossible de retrouver votre paiement. Si vous avez été débité, contactez le support.')
        return
      }

      // Premier essai immédiat
      await pollVerification(cartId, 1)
      setAttempts(1)

      // Polling automatique toutes les POLL_INTERVAL_MS
      let count = 1
      intervalRef.current = setInterval(async () => {
        count++
        setAttempts(count)

        if (count > MAX_ATTEMPTS) {
          clearInterval(intervalRef.current!)
          setStatus('timeout')
          setMessage(
            'Votre paiement prend plus de temps que prévu. ' +
            'Si vous avez été débité, votre compte sera mis à jour automatiquement dans quelques minutes.'
          )
          return
        }

        await pollVerification(cartId, count)
      }, POLL_INTERVAL_MS)
    }

    start()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [cartIdFromUrl, router])

  const progressPct = Math.min((attempts / MAX_ATTEMPTS) * 100, 100)

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
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
      }}>
        {/* Icône selon statut */}
        {(status === 'loading' || status === 'polling') && (
          <Loader2 className="animate-spin" size={48} color="var(--accent)" style={{ margin: '0 auto 20px' }} />
        )}
        {status === 'timeout' && (
          <Clock size={48} color="var(--warning, #f59e0b)" style={{ margin: '0 auto 20px' }} />
        )}
        {status === 'success' && (
          <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 20px' }} />
        )}
        {status === 'error' && (
          <XCircle size={48} color="var(--danger)" style={{ margin: '0 auto 20px' }} />
        )}

        <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>
          {status === 'loading' || status === 'polling' ? 'Paiement en cours de validation...'
            : status === 'success' ? 'Paiement réussi !'
            : status === 'timeout' ? 'Traitement en cours…'
            : 'Problème détecté'}
        </h1>

        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '8px' }}>
          {message}
        </p>

        {(status === 'loading' || status === 'polling') && (
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Cela peut prendre quelques secondes. Merci de patienter.
          </p>
        )}

        {/* Barre de progression pendant le polling */}
        {(status === 'polling' || status === 'loading') && (
          <div style={{
            width: '100%',
            height: '4px',
            background: 'var(--border-color)',
            borderRadius: '2px',
            marginBottom: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'var(--accent)',
              borderRadius: '2px',
              transition: 'width 0.5s ease'
            }} />
          </div>
        )}

        {(status === 'error' || status === 'timeout') && (
          <div style={{ 
            background: 'rgba(245, 158, 11, 0.1)', 
            padding: '16px', 
            borderRadius: '12px', 
            marginBottom: '24px',
            fontSize: '14px',
            color: 'var(--warning, #f59e0b)',
            border: '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            Si vous avez été débité sans confirmation, le remboursement est automatique sous 24–72h.
          </div>
        )}

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
              cursor: 'pointer',
              marginBottom: '12px',
              width: '100%'
            }}
          >
            Réessayer la vérification
          </button>
        )}

        {(status === 'error' || status === 'timeout') && (
          <button
            onClick={() => router.push('/upgrade')}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Retour aux plans
          </button>
        )}

        {status === 'success' && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Redirection vers le scanner dans 3 secondes…
          </p>
        )}

        {status === 'timeout' && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
            Si le problème persiste après 5 minutes, contactez le support en précisant votre email.
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

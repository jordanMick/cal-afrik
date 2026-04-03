'use client'

import { useState } from 'react'

export default function TestPage() {
    const [imageUrl, setImageUrl] = useState('')
    const [result, setResult] = useState<any>(null)

    const handleTest = async () => {
        const res = await fetch('/api/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: imageUrl })
        })

        const json = await res.json()
        console.log(json)
        setResult(json)
    }

    return (
        <div style={{ padding: '20px', color: '#fff' }}>
            <h1>Test Embedding</h1>

            <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Colle l'URL de ton image"
                style={{ width: '100%', padding: '10px', marginTop: '10px' }}
            />

            <button
                onClick={handleTest}
                style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: '#C4622D',
                    color: '#fff'
                }}
            >
                Tester
            </button>

            {result && (
                <pre style={{
                    marginTop: '20px',
                    background: '#111',
                    padding: '10px'
                }}>
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}
        </div>
    )
}
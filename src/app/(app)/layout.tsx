import BottomNav from '@/components/layout/BottomNav'
import AuthProvider from '@/components/layout/AuthProvider'

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div style={{
            maxWidth: '480px',
            margin: '0 auto',
            minHeight: '100vh',
            position: 'relative',
            background: '#0a0603'
        }}>

            {/* 🔐 Auth global */}
            <AuthProvider>
                {children}
            </AuthProvider>

            {/* 📱 Navigation */}
            <BottomNav />

        </div>

    )
}
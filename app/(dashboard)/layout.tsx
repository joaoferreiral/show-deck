import { getSession } from '@/lib/session'
import { Sidebar, BottomNav } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { SessionProvider } from '@/components/providers/session-provider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  return (
    <SessionProvider value={session}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:w-60 md:flex-col shrink-0">
          <Sidebar
            orgId={session.orgId}
            orgName={session.orgName}
            userName={session.userName}
            userEmail={session.userEmail}
            userRole={session.userRole}
            userAvatar={session.userAvatar}
            allOrgs={session.allOrgs}
          />
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
            {children}
          </main>
        </div>

        {/* Mobile bottom navigation */}
        <BottomNav />
      </div>
    </SessionProvider>
  )
}

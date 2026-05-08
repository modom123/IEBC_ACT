import AccountingShell from '@/components/AccountingShell'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  let user = undefined
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = createServerSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const [{ data: profile }, { data: sub }] = await Promise.all([
          supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single(),
          supabase.from('subscriptions').select('plan, status').eq('user_id', session.user.id).maybeSingle(),
        ])
        user = {
          name: profile?.full_name,
          email: session.user.email,
          role: profile?.role,
          plan: sub?.plan ?? 'silver',
        }
      }
    }
  } catch { /* Supabase not configured */ }

  return <AccountingShell user={user}>{children}</AccountingShell>
}

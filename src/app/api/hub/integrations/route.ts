import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data, error } = await supabase
      .from('hub_integrations')
      .select('*')
      .eq('user_id', session.user.id)
    if (error) return NextResponse.json([])
    return NextResponse.json(data ?? [])
  } catch { return NextResponse.json([]) }
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { data, error } = await supabase
      .from('hub_integrations')
      .upsert({ ...body, user_id: session.user.id }, { onConflict: 'user_id,integration_key' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }) }
}

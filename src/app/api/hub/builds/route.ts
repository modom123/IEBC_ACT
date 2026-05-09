import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data, error } = await supabase
      .from('hub_builds')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
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
    const { data, error } = await supabase.from('hub_builds').insert({ ...body, user_id: session.user.id }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }) }
}

export async function PATCH(req: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...rest } = await req.json()
    const { data, error } = await supabase.from('hub_builds').update(rest).eq('id', id).eq('user_id', session.user.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }) }
}

export async function DELETE(req: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await req.json()
    await supabase.from('hub_builds').delete().eq('id', id).eq('user_id', session.user.id)
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }) }
}

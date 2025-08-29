import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// EMERGENCY: Use anon key with RLS disabled for demo
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    // EMERGENCY: Get all records for demo (RLS disabled)
    const { data, error } = await supabase
      .from('chat_records')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, records: data });

  } catch (error: any) {
    console.error('Get records error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch records', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('id');

    if (!recordId) {
      return NextResponse.json({ error: 'Record ID required' }, { status: 400 });
    }

    // EMERGENCY: Delete any record for demo
    const { error } = await supabase
      .from('chat_records')
      .delete()
      .eq('id', recordId);

    if (error) throw error;
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete record error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete record', 
      details: error.message 
    }, { status: 500 });
  }
}

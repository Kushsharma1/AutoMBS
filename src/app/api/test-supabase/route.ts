import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/libs/supabase';

export async function GET() {
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('chat_records')
      .select('count', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({ 
        error: 'Database connection failed', 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Supabase connection working',
      recordCount: data || 0
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Connection test failed', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Test insert
    const { data, error } = await supabase
      .from('chat_records')
      .insert({
        user_id: 'test-user',
        title: 'Test Record',
        patient_info: { test: true },
        chat_messages: [{ role: 'test', content: 'test' }],
        final_codes: [{ test: true }]
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ 
        error: 'Insert failed', 
        details: error.message 
      }, { status: 500 });
    }

    // Clean up test record
    await supabase
      .from('chat_records')
      .delete()
      .eq('id', data.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Database operations working',
      testId: data.id
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error.message 
    }, { status: 500 });
  }
}

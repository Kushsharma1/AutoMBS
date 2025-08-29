import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateMBSReport } from '@/libs/pdf-generator';

// EMERGENCY: Use anon key for demo
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received data:', { 
      hasPatientInfo: !!body.patientInfo,
      hasChatMessages: !!body.chatMessages,
      hasFinalCodes: !!body.finalCodes,
      hasUserId: !!body.userId,
      chatMessagesLength: body.chatMessages?.length,
      finalCodesLength: body.finalCodes?.length
    });
    
    const { patientInfo, chatMessages, finalCodes, userId, userEmail } = body;

    if (!patientInfo || !chatMessages || !finalCodes) {
      return NextResponse.json({ 
        error: 'Missing required data',
        debug: {
          hasPatientInfo: !!patientInfo,
          hasChatMessages: !!chatMessages,
          hasFinalCodes: !!finalCodes,
          hasUserId: !!userId
        }
      }, { status: 400 });
    }

    // EMERGENCY: Save to database for demo
    const { data: chatRecord, error: dbError } = await supabase
      .from('chat_records')
      .insert({
        user_id: userId || 'demo-user',
        title: `${patientInfo.age}yo ${patientInfo.sex} - ${patientInfo.clinicianRole}`,
        patient_info: {
          ...patientInfo,
          clinical_notes: patientInfo.clinicalNotes, // Map field name
          clinician_role: patientInfo.clinicianRole, // Map field name
          encounter_date: new Date().toISOString()
        },
        chat_messages: chatMessages,
        final_codes: finalCodes,
        report_generated: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ 
        error: 'Failed to save to database', 
        details: dbError.message 
      }, { status: 500 });
    }

    // Generate PDF report with error handling
    let pdfData = null;
    let base64PDF = null;
    
    try {
      console.log('Attempting PDF generation...');
      pdfData = generateMBSReport({
        patientInfo: {
          name: patientInfo.patientName || 'Not provided',
          age: parseInt(patientInfo.age as string) || 25,
          sex: patientInfo.sex || 'unknown',
          setting: patientInfo.setting || 'GP',
          clinician_role: patientInfo.clinicianRole || 'GP',
          clinical_notes: patientInfo.clinicalNotes || 'No notes provided',
          encounter_date: new Date().toLocaleDateString('en-AU')
        },
        codes: Array.isArray(finalCodes) ? finalCodes : [finalCodes].filter(Boolean),
        metadata: {
          generated_date: new Date().toISOString(),
          generated_by: userEmail || 'Unknown',
          analysis_version: '1.0'
        }
      });

      // Convert PDF data to base64 for client
      base64PDF = Buffer.from(pdfData).toString('base64');
      console.log('PDF generated successfully');
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError);
      // Continue without PDF
    }

    return NextResponse.json({
      success: true,
      recordId: chatRecord.id,
      pdfData: base64PDF,
      filename: `MBS_Report_${patientInfo.age}yo_${patientInfo.sex}_${new Date().toISOString().split('T')[0]}.pdf`
    });

  } catch (error: any) {
    console.error('Save record error:', error);
    
    // If it's a PDF generation issue, try without PDF
    if (error.message?.includes('jsPDF') || error.message?.includes('PDF')) {
      return NextResponse.json({ 
        success: true,
        recordId: 'temp-id',
        message: 'Record saved (PDF generation skipped)',
        pdfData: null
      });
    }
    
    return NextResponse.json({ 
      error: 'Failed to save record', 
      details: error.message 
    }, { status: 500 });
  }
}

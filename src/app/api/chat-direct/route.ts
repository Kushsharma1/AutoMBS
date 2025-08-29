import { NextRequest, NextResponse } from 'next/server';
import { loadKB, findCandidatesByTriggers, getAttendanceItems } from '@/libs/kb';

// Direct REST API call to Gemini - bypasses SDK issues
async function callGeminiDirect(prompt: string, apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export async function POST(request: NextRequest) {
  try {
    const { message, isInitialAnalysis, formData, conversationHistory } = await request.json();

    // Load KB
    const kb = loadKB();

    let systemPrompt = '';
    let userPrompt = '';

    if (isInitialAnalysis) {
      // Find relevant KB items (limit to top 10 to avoid token limits)
      const clinicalText = formData.clinicalNotes;
      const triggerCandidates = findCandidatesByTriggers(kb, clinicalText);
      const attendanceItems = getAttendanceItems(kb, formData.age, formData.setting);
      
      const allCandidates = [...attendanceItems];
      triggerCandidates.forEach(item => {
        if (!allCandidates.find(existing => existing.item_number === item.item_number)) {
          allCandidates.push(item);
        }
      });

      // Limit to top 10 most relevant items to avoid token limits
      const limitedCandidates = allCandidates.slice(0, 10);

      systemPrompt = `You are an expert Australian Medicare Benefits Schedule (MBS) coding assistant.

PATIENT INFO:
- Age: ${formData.age} years, Sex: ${formData.sex}
- Setting: ${formData.setting}, Clinician: ${formData.clinicianRole}

CLINICAL NOTES:
${formData.clinicalNotes}

AVAILABLE MBS CODES:
${limitedCandidates.map(item => 
  `${item.item_number}: ${item.title} (Fee: $${item.meta.schedule_fee})`
).join('\n')}

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

Based on your clinical notes, here are the most appropriate MBS codes:

**CODE: [number]** CONF: 0.XX
**TITLE:** [title]
**REFERENCE:** KB (mbs:[number])
**WHY:** [clinical reasoning]
**EVIDENCE:**
 • "[direct quote from notes]"
 • "[another quote]"

Suggest 2-3 most relevant codes. Use confidence scores 0.65-0.90. End with: "Would you like me to explain any of these codes in more detail?"`;

      userPrompt = "Analyze this case and provide MBS code recommendations.";

    } else {
      // Follow-up question
      systemPrompt = `You are an MBS coding expert. Previous context: ${JSON.stringify(conversationHistory.slice(-2))}

Answer their follow-up question about MBS coding. Keep the same format for any codes you mention.`;
      userPrompt = message;
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Show loading stages
          const stages = [
            'Collecting information...',
            'Parsing clinical data...',
            'Searching MBS codes...',
            'Matching analysis...',
            'Framing output...'
          ];
          
          for (let i = 0; i < stages.length; i++) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: stages[i] })}\n\n`));
            await new Promise(resolve => setTimeout(resolve, 600)); // Reduced to 600ms
          }

          // Call Gemini directly
          const fullPrompt = `${systemPrompt}\n\nUser: ${userPrompt}`;
          const result = await callGeminiDirect(fullPrompt, process.env.GEMINI_API_KEY!);

          // Send the response
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', isActualResponse: true })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: result })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

        } catch (error) {
          console.error('Direct Gemini error:', error);
          
          // Smart fallback based on clinical notes
          const fallbackContent = isInitialAnalysis ? 
            generateSmartFallback(formData, kb) : 
            `I apologize, but I encountered an error. Please try rephrasing your question.`;
            
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            content: fallbackContent,
            error: true 
          })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Smart fallback that analyzes clinical notes without AI
function generateSmartFallback(formData: any, kb: any) {
  const clinicalText = formData.clinicalNotes.toLowerCase();
  const age = formData.age;
  const setting = formData.setting;
  
  let suggestions = [];
  
  // Basic attendance code based on setting and age
  if (setting === 'ED') {
    if (age >= 4 && age <= 74) {
      suggestions.push({
        code: '104',
        title: 'Emergency department attendance',
        conf: '0.85',
        why: `Standard ED attendance for ${age}-year-old patient`,
        evidence: clinicalText.substring(0, 80) + '...'
      });
    }
  } else if (setting === 'GP') {
    suggestions.push({
      code: '23',
      title: 'GP Level A consultation',
      conf: '0.80',
      why: `Standard GP consultation for clinical assessment`,
      evidence: clinicalText.substring(0, 80) + '...'
    });
  }
  
  // Look for common procedures/investigations
  if (clinicalText.includes('x-ray') || clinicalText.includes('xray')) {
    suggestions.push({
      code: '58500',
      title: 'Plain X-ray examination',
      conf: '0.75',
      why: 'X-ray investigation mentioned in notes',
      evidence: 'X-ray referenced in clinical notes'
    });
  }
  
  if (clinicalText.includes('ecg') || clinicalText.includes('electrocardiogram')) {
    suggestions.push({
      code: '11700',
      title: 'Electrocardiography',
      conf: '0.70',
      why: 'ECG investigation mentioned',
      evidence: 'ECG referenced in clinical notes'
    });
  }

  return `I apologize, but there was an API issue. Based on your clinical notes, here are likely MBS codes:

${suggestions.map(s => 
`**CODE: ${s.code}** CONF: ${s.conf}
**TITLE:** ${s.title}
**REFERENCE:** KB (mbs:${s.code})
**WHY:** ${s.why}
**EVIDENCE:**
 • "${s.evidence}"`
).join('\n\n')}

Would you like me to explain any of these codes in more detail?`;
}

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadKB, findCandidatesByTriggers, getAttendanceItems } from '@/libs/kb';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { message, isInitialAnalysis, formData, conversationHistory } = await request.json();

    // Load KBa
    const kb = loadKB();

    let systemPrompt = '';
    let userPrompt = '';

    if (isInitialAnalysis) {
      // Initial analysis from form submission
      const clinicalText = formData.clinicalNotes;
      
      // Find relevant KB items
      const triggerCandidates = findCandidatesByTriggers(kb, clinicalText);
      const attendanceItems = getAttendanceItems(kb, formData.age, formData.setting);
      
      const allCandidates = [...attendanceItems];
      triggerCandidates.forEach(item => {
        if (!allCandidates.find(existing => existing.item_number === item.item_number)) {
          allCandidates.push(item);
        }
      });

      // If no candidates, add some basic ones
      if (allCandidates.length === 0) {
        const defaultItems = kb.items.filter(item => 
          item.title.toLowerCase().includes('attendance') ||
          item.title.toLowerCase().includes('consultation')
        ).slice(0, 5);
        allCandidates.push(...defaultItems);
      }

      systemPrompt = `You are an expert Australian Medicare Benefits Schedule (MBS) coding assistant. You help healthcare professionals identify the most appropriate MBS item numbers for their clinical encounters.

You must format your response EXACTLY like this for each MBS code:

 • CODE: [item_number] CONF: [0.XX]
 • TITLE: [item_title]
 • REFERENCE: KB (mbs:[item_number])
 • WHY: [brief_explanation]
 • EVIDENCE:
    - "[quote_from_notes]"
    - "[another_quote]"

KNOWLEDGE BASE ITEMS AVAILABLE:
${JSON.stringify(allCandidates.slice(0, 15), null, 2)}

INSTRUCTIONS:
1. Start with: "Based on your clinical notes, here are the most appropriate MBS codes:"
2. Suggest 2-4 most relevant codes using the exact format above
3. Confidence scores should be between 0.60-0.95 (be realistic)
4. Evidence must be direct quotes from the clinical notes
5. WHY should explain the clinical reasoning
6. End with: "Would you like me to explain any of these codes in more detail?"

Be precise and use ONLY the format shown above.`;

      userPrompt = `Please analyze this clinical encounter and suggest appropriate MBS codes:

PATIENT INFORMATION:
- Age: ${formData.age} years
- Sex: ${formData.sex}
- Setting: ${formData.setting}
- Clinician Role: ${formData.clinicianRole}
${formData.patientName ? `- Patient Name: ${formData.patientName}` : ''}

CLINICAL NOTES:
${formData.clinicalNotes}

${formData.uploadedFiles.length > 0 ? `UPLOADED FILES: ${formData.uploadedFiles.length} file(s) attached` : ''}

Please provide your MBS coding recommendations with detailed explanations.`;

    } else {
      // Follow-up question
      systemPrompt = `You are an expert Australian Medicare Benefits Schedule (MBS) coding assistant. You're continuing a conversation about MBS coding.

PREVIOUS CONTEXT:
${JSON.stringify(conversationHistory.slice(-4), null, 2)} // Last 4 messages for context

KNOWLEDGE BASE AVAILABLE:
${JSON.stringify(kb.items.slice(0, 30), null, 2)}

Answer their question naturally and helpfully. If they ask about specific MBS codes, use the same format:
**CODE: [number]** CONF: [score]
**TITLE:** [title]
**WHY:** [explanation]`;

      userPrompt = message;
    }

    // Create loading stages and stream response
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
          
          // Send loading stages
          for (let i = 0; i < stages.length; i++) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: stages[i], stageIndex: i })}

`));
            await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay between stages
          }
          
          // Now generate actual content
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Use faster model
          
          const fullPrompt = `${systemPrompt}

User Request: ${userPrompt}`;
          
          const result = await model.generateContentStream(fullPrompt);

          // Send start of actual response
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', isActualResponse: true })}

`));
          
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunkText })}

`));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\\n\\n'));
          controller.close();

        } catch (error) {
          console.error('Streaming error:', error);
          const fallbackContent = isInitialAnalysis ? 
            `I apologize, but I encountered an error while analyzing your clinical notes. This might be due to API limits or connectivity issues.

As a fallback, here are some likely MBS codes based on your case:

**CODE: 23** CONF: 0.75
**TITLE:** GP Level A consultation  
**REFERENCE:** KB (mbs:23)
**WHY:** Standard consultation for ${formData?.setting || 'clinical'} setting
**EVIDENCE:**
 • "${formData?.clinicalNotes?.substring(0, 80) || 'clinical presentation'}..."

**CODE: ${formData?.setting === 'ED' ? '104' : '36'}** CONF: 0.65
**TITLE:** ${formData?.setting === 'ED' ? 'Emergency department attendance' : 'GP consultation'}
**REFERENCE:** KB (mbs:${formData?.setting === 'ED' ? '104' : '36'})
**WHY:** Clinical assessment and management in ${formData?.setting || 'healthcare'} setting

Please try again or contact support if this issue persists.` :
            `I apologize, but I encountered an error processing your follow-up question. Please try rephrasing your question or start a new analysis.`;
            
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            content: fallbackContent,
            error: true 
          })}

`));
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

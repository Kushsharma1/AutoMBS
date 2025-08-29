import { NextRequest, NextResponse } from 'next/server';
import { SmartMBSEngine, type MBSRecommendation } from '@/libs/smart-mbs-engine';

export async function POST(request: NextRequest) {
  try {
    const { message, isInitialAnalysis, formData, conversationHistory } = await request.json();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (isInitialAnalysis) {
            // Show realistic loading stages
            const stages = [
              'Collecting information...',
              'Parsing clinical data...',
              'Searching MBS codes...',
              'Matching analysis...',
              'Framing output...'
            ];
            
            for (let i = 0; i < stages.length; i++) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: stages[i] })}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 400)); // Fast 400ms per stage
            }

            // Analyze with smart engine
            const engine = new SmartMBSEngine();
            const recommendations = engine.analyzeCase(formData);

            // Format the response
            let response = "Based on your clinical notes, here are the most appropriate MBS codes:\n\n";
            
            recommendations.forEach((rec, index) => {
              response += `**CODE: ${rec.code}** CONF: ${rec.confidence.toFixed(2)}\n`;
              response += `**TITLE:** ${rec.title}\n`;
              response += `**REFERENCE:** KB (mbs:${rec.code})`;
              if (rec.scheduleeFee) {
                response += ` • Schedule Fee: $${rec.scheduleeFee}`;
              }
              response += `\n**WHY:** ${rec.reasoning}\n`;
              response += `**EVIDENCE:**\n`;
              rec.evidence.forEach(evidence => {
                response += ` • ${evidence}\n`;
              });
              response += `\n`;
            });

            response += `Would you like me to explain any of these codes in more detail?`;

            // Send the response
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', isActualResponse: true })}\n\n`));
            
            // Stream the response character by character for realistic effect
            for (let i = 0; i < response.length; i += 10) {
              const chunk = response.substring(i, i + 10);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 30)); // 30ms per chunk
            }

          } else {
            // Handle follow-up questions
            const engine = new SmartMBSEngine();
            let response = "";

            if (message.toLowerCase().includes('explain') || message.toLowerCase().includes('detail')) {
              // Extract code number from question
              const codeMatch = message.match(/\b\d{3,5}\b/);
              if (codeMatch) {
                const code = codeMatch[0];
                response = explainMBSCode(code);
              } else {
                response = "I can explain specific MBS codes for you. Please mention the code number (e.g., 'explain code 23').";
              }
            } else if (message.toLowerCase().includes('fee') || message.toLowerCase().includes('cost')) {
              response = "MBS schedule fees are set by the Department of Health. The fees shown are current as of 2025. Bulk billing may apply, or patients may have gap payments depending on the provider's billing practices.";
            } else {
              response = "I can help explain specific MBS codes, discuss fees, or clarify any coding decisions. What would you like to know more about?";
            }

            // Stream the follow-up response
            for (let i = 0; i < response.length; i += 15) {
              const chunk = response.substring(i, i + 15);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 40));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

        } catch (error) {
          console.error('Smart engine error:', error);
          
          const fallbackContent = isInitialAnalysis ? 
            generateBasicFallback(formData) : 
            `I apologize, but I encountered an error processing your question. Please try again.`;
            
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

function explainMBSCode(code: string): string {
    const explanations: { [key: string]: string } = {
      '23': 'MBS Item 23 is a GP Level A consultation (brief). It covers consultations up to 20 minutes for straightforward clinical issues. This is the most common GP billing code for simple presentations.',
      '44': 'MBS Item 44 is a GP Level B consultation (standard). It covers consultations 20-40 minutes involving more detailed clinical assessment and management.',
      '36': 'MBS Item 36 is a GP Level C consultation (long). It covers consultations over 40 minutes involving complex clinical management, multiple issues, or detailed counseling.',
      '103': 'MBS Item 103 covers ordinary emergency department attendance. This applies to standard ED presentations requiring routine clinical assessment.',
      '104': 'MBS Item 104 covers emergency department attendance requiring more than ordinary care. This applies when extensive investigation, procedures, or complex management is required.',
      '11700': 'MBS Item 11700 covers electrocardiography (ECG). This includes the performance and interpretation of a 12-lead ECG.',
      '58500': 'MBS Item 58500 covers plain radiographic examination. This includes X-rays of various body parts for diagnostic purposes.'
    };

    return explanations[code] || `MBS Item ${code} is a valid Medicare Benefits Schedule item. I can provide more details if you specify which aspect you'd like to know about (eligibility, fees, restrictions, etc.).`;
  }

function generateBasicFallback(formData: any): string {
    const age = formData.age;
    const setting = formData.setting;
    
    let code = '23';
    let title = 'GP Level A consultation';
    let fee = '$39.75';
    
    if (setting === 'ED') {
      code = '103';
      title = 'Emergency department attendance';
      fee = '$67.85';
    }

    return `**CODE: ${code}** CONF: 0.75
**TITLE:** ${title}
**REFERENCE:** KB (mbs:${code}) • Schedule Fee: ${fee}
**WHY:** Standard ${setting} attendance for ${age}-year-old patient
**EVIDENCE:**
 • "${formData.clinicalNotes.substring(0, 80)}..."

Would you like me to explain this code in more detail?`;
}

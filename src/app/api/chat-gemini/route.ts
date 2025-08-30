import { NextRequest, NextResponse } from 'next/server';
import { loadKB } from '@/libs/kb';
import { PROMPT_TEMPLATES, formatPrompt } from '@/libs/prompt-templates';
import { mbsAnalyzer } from '@/libs/mbs-analyzer';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { message, isInitialAnalysis, formData } = await request.json();

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    let prompt = message;

    if (isInitialAnalysis && formData) {
      // Load knowledge base and generate candidates
      const kb = await loadKB();
      const analysisResult = mbsAnalyzer.analyzeNote(formData.clinicalNotes, formData);
      
      // Format prompt with MBS context
      prompt = formatPrompt(PROMPT_TEMPLATES.INITIAL_ANALYSIS, {
        clinicalNotes: formData.clinicalNotes,
        patientAge: formData.age,
        clinicianRole: formData.clinicianRole,
        candidates: analysisResult.candidates,
        triggers: analysisResult.triggers
      });
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { 
                temperature: 0.1,
                maxOutputTokens: 4000
              }
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            controller.enqueue(`data: ${JSON.stringify({ error: 'Gemini API error', details: errorText })}\n\n`);
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.enqueue(`data: ${JSON.stringify({ error: 'No response body' })}\n\n`);
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6);
                  if (jsonStr.trim()) {
                    const data = JSON.parse(jsonStr);
                    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (content) {
                      controller.enqueue(`data: ${JSON.stringify({ content })}\n\n`);
                    }
                  }
                } catch (e) {
                  // Skip malformed JSON
                }
              }
            }
          }

          controller.enqueue(`data: [DONE]\n\n`);
          controller.close();

        } catch (error: any) {
          controller.enqueue(`data: ${JSON.stringify({ error: 'Stream error', details: error.message })}\n\n`);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error: any) {
    console.error('Chat Gemini API error:', error);
    return NextResponse.json({ error: 'Failed to process chat', details: error.message }, { status: 500 });
  }
}
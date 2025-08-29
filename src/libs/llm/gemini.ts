import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface LLMSuggestion {
  mbs_item: string;
  title: string;
  confidence: number;
  reason: string;
  evidence: string[];
  restrictions_checked: {
    role_ok: boolean;
    setting_ok: boolean;
    same_day_exclusion_ok: boolean;
    must_pair_ok: boolean;
    requires_with_ok: boolean;
  };
}

export interface LLMResponse {
  items: LLMSuggestion[];
  clarifications_needed: string[];
}

export async function callGemini(
  encounterData: any,
  kbItems: any[],
  systemPrompt: string
): Promise<LLMResponse> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const userContent = `
Encounter JSON: ${JSON.stringify(encounterData, null, 2)}

KB snippet: ${JSON.stringify(kbItems, null, 2)}
    `;

    const fullPrompt = `${systemPrompt}\n\n${userContent}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    // Try to parse the JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', parseError);
    }

    // Fallback: create a basic response structure
    return {
      items: [],
      clarifications_needed: ['Unable to parse AI response. Please try again.']
    };

  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to get AI suggestions');
  }
}

export const SYSTEM_PROMPT = `You are an expert in mapping Australian emergency/GP encounters to MBS item numbers.
Use the provided KB (items with eligibility & restrictions) and the structured encounter JSON.
Only suggest items within the KB provided.

For each item you suggest, provide:
- mbs_item: The MBS item number
- title: The item title
- confidence: A score between 0-1 indicating your confidence
- reason: Clear explanation of why this item applies
- evidence: Array of verbatim snippets from the clinical notes that support this item
- restrictions_checked: Object with boolean flags for each restriction type

If critical data is missing (e.g., duration for resuscitation bands), ask one clarifying question at the end.

Return your response as valid JSON in this exact format:
{
  "items": [
    {
      "mbs_item": "5012",
      "title": "ED attendance — more than ordinary (age 4–74)",
      "confidence": 0.78,
      "reason": "Age 55 with multiple investigations and management beyond simple care.",
      "evidence": ["CT ordered", "orthopaedic consult planned"],
      "restrictions_checked": {
        "role_ok": true,
        "setting_ok": true,
        "same_day_exclusion_ok": true,
        "must_pair_ok": true,
        "requires_with_ok": true
      }
    }
  ],
  "clarifications_needed": []
}`;

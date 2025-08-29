import { NextRequest, NextResponse } from 'next/server';
import { loadKB, findCandidatesByTriggers, getAttendanceItems, validateRestrictions, type KBItem } from '@/libs/kb';
import { callGemini, SYSTEM_PROMPT, type LLMSuggestion } from '@/libs/llm/gemini';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Load the knowledge base
    const kb = loadKB();
    
    // Use the full clinical text or combine available fields
    const clinicalText = data.clinical_note.full_text || [
      data.clinical_note.presenting_complaint,
      data.clinical_note.history_exam,
      data.clinical_note.diagnoses?.join(' '),
      data.clinical_note.procedures?.join(' '),
      data.clinical_note.investigations?.join(' '),
      data.clinical_note.medications?.join(' '),
      data.clinical_note.disposition_plan
    ].filter(Boolean).join(' ');

    // Find candidate items based on triggers
    const triggerCandidates = findCandidatesByTriggers(kb, clinicalText);
    
    // Always include attendance items based on age
    const attendanceItems = getAttendanceItems(kb, data.patient.age_years, data.encounter.setting);
    
    // Combine candidates (remove duplicates)
    const allCandidates = [...attendanceItems];
    triggerCandidates.forEach(item => {
      if (!allCandidates.find(existing => existing.item_number === item.item_number)) {
        allCandidates.push(item);
      }
    });

    // If no candidates found, include some basic attendance items
    if (allCandidates.length === 0) {
      // Add a default attendance item based on setting
      const defaultItems = kb.items.filter(item => 
        item.title.toLowerCase().includes('attendance') ||
        item.title.toLowerCase().includes('consultation')
      ).slice(0, 3);
      allCandidates.push(...defaultItems);
    }

    // Call Gemini for analysis (with fallback)
    let llmResponse;
    try {
      llmResponse = await callGemini(data, allCandidates, SYSTEM_PROMPT);
    } catch (geminiError) {
      console.warn('Gemini API failed, using fallback:', geminiError);
      // Fallback: create basic suggestions from candidates
      llmResponse = {
        items: allCandidates.slice(0, 5).map((item, index) => ({
          mbs_item: item.item_number,
          title: item.title,
          confidence: 0.7 - (index * 0.1),
          reason: `Matched based on clinical triggers and patient age ${data.patient.age_years}`,
          evidence: [clinicalText.substring(0, 100) + '...'],
          restrictions_checked: {
            role_ok: true,
            setting_ok: true,
            same_day_exclusion_ok: true,
            must_pair_ok: true,
            requires_with_ok: true
          }
        })),
        clarifications_needed: []
      };
    }
    
    // Validate restrictions for each suggested item
    const validatedSuggestions = llmResponse.items.map(suggestion => {
      const kbItem = kb.items.find(item => item.item_number === suggestion.mbs_item);
      if (!kbItem) return suggestion;

      const restrictions = validateRestrictions(kbItem, {
        setting: data.encounter.setting,
        clinicianRole: data.encounter.clinician_role,
        selectedItems: [] // For now, empty - would be populated in follow-up calls
      });

      // Calculate confidence score
      let confidence = suggestion.confidence || 0.5;
      
      // Boost confidence if all restrictions pass
      if (Object.values(restrictions).every(Boolean)) {
        confidence += 0.3;
      }
      
      // Boost if triggers matched strongly
      const hasStrongTrigger = kbItem.triggers.any_of.some(trigger =>
        clinicalText.toLowerCase().includes(trigger.toLowerCase())
      );
      if (hasStrongTrigger) {
        confidence += 0.2;
      }
      
      // Cap at 1.0
      confidence = Math.min(confidence, 1.0);

      return {
        ...suggestion,
        confidence: Math.round(confidence * 100) / 100, // Round to 2 decimal places
        restrictions_checked: restrictions,
        schedule_fee: kbItem.meta.schedule_fee
      };
    });

    // Sort by confidence (highest first)
    validatedSuggestions.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      items: validatedSuggestions,
      clarifications_needed: llmResponse.clarifications_needed || [],
      metadata: {
        total_kb_items: kb.items.length,
        candidates_considered: allCandidates.length,
        analysis_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze clinical data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

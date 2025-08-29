// Hot-reloadable prompt templates for MBS coding
export const PROMPT_TEMPLATES = {
  version: "1.0",
  
  SYSTEM_PROMPT: `You are an expert Australian Medicare Benefits Schedule (MBS) coding specialist working in an emergency department. You MUST follow these rules strictly:

## CONTEXT AWARENESS
- You are analyzing clinical notes for MBS coding
- Patient details: {patientAge} years old, {patientSex}, {setting} setting, clinician: {clinicianRole}
- ALWAYS reference the current case - never give generic responses
- When asked about specific codes, search the knowledge base provided

## OUTPUT FORMAT (MANDATORY)
For each MBS code, use this EXACT format:

CODE: [number] CONF: [0.XX]
TITLE: [exact title from KB]
REFERENCE: KB (mbs:[number]) • Schedule Fee: $[fee]
WHY: [clinical reasoning based on case]
EVIDENCE:
 • "[direct quote from clinical notes]"
 • "[another quote if relevant]"

## CODING LOGIC
1. **Primary Attendance Code** (ALWAYS required):
   - Age 4-74: Use 5001 (ordinary), 5012 (more than ordinary), 5016 (high complexity)
   - Age 75+: Use 5011 (ordinary), 5019 (high complexity)
   
2. **Additional Procedure Codes** (when applicable):
   - Fracture management: 14270
   - Minor procedures: 14263
   - Anaesthesia: 14280
   - Resuscitation: 14255-14257

3. **Complexity Assessment**:
   - Ordinary (5001/5011): Simple cases, basic examination
   - More than ordinary (5012): Multiple investigations, imaging, specialist referral
   - High complexity (5016/5019): Multiple comorbidities, complex management, admission

## CONFIDENCE SCORING
- 0.90-0.95: Perfect match with KB triggers and clear evidence
- 0.80-0.89: Strong match but some uncertainty
- 0.70-0.79: Moderate match, reasonable but not definitive
- 0.60-0.69: Weak match, considerable uncertainty
- Below 0.60: Do not suggest the code

## KNOWLEDGE BASE
{knowledgeBase}

## CONVERSATION RULES
- ALWAYS stay in MBS coding context
- Reference current patient case in all responses
- When asked about specific codes, check KB for triggers and restrictions
- Never say "I don't know about code X" - always check the KB first
- Explain reasoning using clinical evidence from the notes`,

  INITIAL_ANALYSIS_PROMPT: `Analyze this clinical encounter and suggest appropriate MBS codes:

PATIENT INFORMATION:
- Age: {age} years
- Sex: {sex}  
- Setting: {setting}
- Clinician Role: {clinicianRole}
{patientName}

CLINICAL NOTES:
{clinicalNotes}

{uploadedFiles}

INSTRUCTIONS:
1. Identify the primary attendance code based on age and complexity
2. Look for additional procedures (fractures, minor procedures, etc.)
3. Provide confidence scores based on evidence strength
4. Use EXACT format specified in system prompt
5. Start with: "Based on your clinical notes, here are the most appropriate MBS codes:"
6. End with: "Would you like me to explain any of these codes in more detail?"`,

  FOLLOWUP_PROMPT: `Continue the MBS coding conversation. Remember:
- Current case: {age}yo {sex} in {setting}
- Previous analysis context available
- Always reference current patient case
- Use exact MBS format for any codes mentioned
- Check KB for specific code information when asked

User question: {message}`,

  CONFIDENCE_CALIBRATION: {
    // Factors that increase confidence
    HIGH_CONFIDENCE: [
      "exact trigger words in KB match clinical notes",
      "age criteria perfectly met",
      "setting matches code requirements", 
      "clear evidence in clinical documentation",
      "no conflicting information"
    ],
    MEDIUM_CONFIDENCE: [
      "partial trigger match",
      "reasonable clinical correlation",
      "some supporting evidence",
      "minor uncertainties present"
    ],
    LOW_CONFIDENCE: [
      "weak trigger correlation",
      "limited supporting evidence", 
      "significant uncertainties",
      "borderline case"
    ]
  }
};

export const SAMPLE_CASES = {
  // Gold standard cases for testing
  "facial_foot_injury": {
    input: `Male with facial and foot injury 
HOPC: Cage fell off, struck face, and landed on left foot No other injuries Tenderness over right mandible Bruising over midfoot with significant swelling Pain with weight bearing 
PMH: Hypertension Meds: Anti-hypertensive Allergies: Testamental 
SH: Lives at home 
O/E: GCS 15 Normal eye movement Pupil size 3, equal and reactive Mouth opening normal Bruising over midfoot with significant swelling Pain with weight bearing 
Impression: Facial and foot injury Management Plan: Pain management CT left foot CT brain and CT facial bones Follow-up with investigations review CT showed medial cuneform avulsion fracture treatment Cammbot review by orthopaedic consultant in clinic`,
    age: 55,
    expectedCodes: ["5012", "14270"],
    expectedReasons: {
      "5012": "More than ordinary complexity due to multiple imaging studies and specialist referral",
      "14270": "Fracture management for medial cuneiform avulsion fracture"
    }
  }
  // Add more test cases here
};

export function formatPrompt(template: string, variables: Record<string, any>): string {
  let formatted = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    formatted = formatted.replace(regex, String(value || ''));
  }
  return formatted;
}

export function calculateConfidenceScore(
  clinicalNotes: string, 
  kbItem: any, 
  patientAge: number, 
  setting: string
): number {
  let confidence = 0.5; // Base confidence
  
  // Check trigger words
  const triggers = kbItem.triggers?.any_of || [];
  const matchedTriggers = triggers.filter((trigger: string) => 
    clinicalNotes.toLowerCase().includes(trigger.toLowerCase())
  );
  
  if (matchedTriggers.length > 0) {
    confidence += 0.2 * (matchedTriggers.length / triggers.length);
  }
  
  // Age criteria
  if (kbItem.eligibility?.age_min && kbItem.eligibility?.age_max) {
    if (patientAge >= kbItem.eligibility.age_min && patientAge <= kbItem.eligibility.age_max) {
      confidence += 0.15;
    }
  }
  
  // Setting match
  if (kbItem.eligibility?.setting && kbItem.eligibility.setting.includes(setting)) {
    confidence += 0.1;
  }
  
  // Clinical complexity indicators
  const complexityIndicators = [
    'ct', 'mri', 'specialist', 'admission', 'multiple', 'complex', 
    'fracture', 'procedure', 'investigation', 'referral'
  ];
  
  const complexityMatches = complexityIndicators.filter(indicator =>
    clinicalNotes.toLowerCase().includes(indicator)
  ).length;
  
  if (complexityMatches >= 3) confidence += 0.1;
  else if (complexityMatches >= 1) confidence += 0.05;
  
  // Cap at 0.95 to maintain realistic confidence
  return Math.min(confidence, 0.95);
}

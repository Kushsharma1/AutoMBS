import { loadKB } from './kb';
import { PROMPT_TEMPLATES, formatPrompt, calculateConfidenceScore, SAMPLE_CASES } from './prompt-templates';

export interface MBSAnalysisResult {
  codes: MBSCode[];
  coverageScore: number;
  totalEligibleCodes: number;
  analysisMetadata: {
    promptVersion: string;
    timestamp: string;
    processingTime: number;
  };
}

export interface MBSCode {
  itemNumber: string;
  title: string;
  confidence: number;
  reasoning: string;
  evidence: string[];
  scheduleFee?: number;
  category: 'primary' | 'procedure' | 'investigation';
}

export class MBSAnalyzer {
  private kb: any;
  private promptTemplates: typeof PROMPT_TEMPLATES;

  constructor() {
    this.kb = loadKB();
    this.promptTemplates = PROMPT_TEMPLATES;
  }

  // Hot reload prompts for testing
  updatePrompts(newTemplates: Partial<typeof PROMPT_TEMPLATES>) {
    this.promptTemplates = { ...this.promptTemplates, ...newTemplates };
  }

  analyzeCase(formData: any): MBSAnalysisResult {
    const startTime = Date.now();
    
    // Step 1: Determine primary attendance code
    const primaryCode = this.getPrimaryAttendanceCode(formData);
    
    // Step 2: Find additional procedure codes
    const procedureCodes = this.getProcedureCodes(formData);
    
    // Step 3: Calculate coverage score
    const allEligibleCodes = this.findAllEligibleCodes(formData);
    const suggestedCodes = [primaryCode, ...procedureCodes];
    const coverageScore = suggestedCodes.length / allEligibleCodes.length;

    return {
      codes: suggestedCodes,
      coverageScore,
      totalEligibleCodes: allEligibleCodes.length,
      analysisMetadata: {
        promptVersion: this.promptTemplates.version,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      }
    };
  }

  private getPrimaryAttendanceCode(formData: any): MBSCode {
    const age = parseInt(formData.age);
    const clinicalNotes = formData.clinicalNotes.toLowerCase();
    const setting = formData.setting;
    
    // Determine complexity level
    const complexityLevel = this.assessComplexity(clinicalNotes, age);
    
    // Age-based code selection
    let itemNumber: string;
    let title: string;
    
    if (age >= 75) {
      if (complexityLevel === 'high') {
        itemNumber = '5019';
        title = 'High Complexity, patient aged 75 years or over';
      } else {
        itemNumber = '5011'; 
        title = 'Ordinary complexity, patient aged 75 years or over';
      }
    } else {
      if (complexityLevel === 'high') {
        itemNumber = '5016';
        title = 'High Complexity, patient aged 4 years or over but under 75 years';
      } else if (complexityLevel === 'more_than_ordinary') {
        itemNumber = '5012';
        title = 'Complexity More than Ordinary but Not High, patient aged 4 years or over but under 75 years';
      } else {
        itemNumber = '5001';
        title = 'Ordinary complexity, patient aged 4 years or over but under 75 years';
      }
    }

    // Find KB item for confidence calculation
    const kbItem = this.kb.items.find((item: any) => item.item_number === itemNumber);
    const confidence = calculateConfidenceScore(formData.clinicalNotes, kbItem || {}, age, setting);

    return {
      itemNumber,
      title,
      confidence,
      reasoning: this.generateReasoning(complexityLevel, age, clinicalNotes),
      evidence: this.extractEvidence(clinicalNotes, complexityLevel),
      scheduleFee: kbItem?.meta?.schedule_fee,
      category: 'primary'
    };
  }

  private getProcedureCodes(formData: any): MBSCode[] {
    const clinicalNotes = formData.clinicalNotes.toLowerCase();
    const codes: MBSCode[] = [];

    // Fracture management
    if (this.containsAny(clinicalNotes, ['fracture', 'dislocation', 'broken', 'displaced'])) {
      codes.push({
        itemNumber: '14270',
        title: 'Fracture management',
        confidence: 0.85,
        reasoning: 'Fracture management indicated by clinical findings',
        evidence: this.extractEvidence(clinicalNotes, 'fracture'),
        category: 'procedure'
      });
    }

    // Minor procedures
    if (this.containsAny(clinicalNotes, ['suture', 'stitch', 'wound', 'laceration', 'repair'])) {
      codes.push({
        itemNumber: '14263',
        title: 'Minor procedure',
        confidence: 0.80,
        reasoning: 'Minor procedure indicated by wound management',
        evidence: this.extractEvidence(clinicalNotes, 'procedure'),
        category: 'procedure'
      });
    }

    // Anaesthesia
    if (this.containsAny(clinicalNotes, ['block', 'anaesthesia', 'anesthesia', 'lignocaine', 'lidocaine'])) {
      codes.push({
        itemNumber: '14280',
        title: 'Anaesthesia',
        confidence: 0.75,
        reasoning: 'Anaesthesia services provided',
        evidence: this.extractEvidence(clinicalNotes, 'anaesthesia'),
        category: 'procedure'
      });
    }

    return codes;
  }

  private assessComplexity(clinicalNotes: string, age: number): 'ordinary' | 'more_than_ordinary' | 'high' {
    const complexityIndicators = {
      high: ['multiple comorbidities', 'admission', 'icu', 'resuscitation', 'unstable', 'complex management'],
      more_than_ordinary: ['ct', 'mri', 'specialist', 'referral', 'multiple investigations', 'imaging'],
      ordinary: ['simple', 'straightforward', 'routine', 'basic']
    };

    const highCount = complexityIndicators.high.filter(indicator => 
      clinicalNotes.includes(indicator)
    ).length;

    const moreCount = complexityIndicators.more_than_ordinary.filter(indicator =>
      clinicalNotes.includes(indicator) 
    ).length;

    // Age 75+ has different thresholds
    if (age >= 75) {
      if (highCount >= 1 || moreCount >= 2) return 'high';
      return 'ordinary';
    } else {
      if (highCount >= 2 || moreCount >= 3) return 'high';
      if (moreCount >= 1) return 'more_than_ordinary';
      return 'ordinary';
    }
  }

  private generateReasoning(complexity: string, age: number, notes: string): string {
    const baseReason = `${complexity.replace('_', ' ')} complexity based on age ${age}`;
    
    if (complexity === 'high') {
      return `${baseReason} with multiple comorbidities and complex management requirements`;
    } else if (complexity === 'more_than_ordinary') {
      return `${baseReason} with multiple investigations and/or specialist involvement`;
    } else {
      return `${baseReason} with straightforward clinical presentation`;
    }
  }

  private extractEvidence(notes: string, type: string): string[] {
    const sentences = notes.split(/[.!?]+/);
    const keywords = {
      fracture: ['fracture', 'broken', 'dislocation'],
      procedure: ['suture', 'repair', 'wound'],
      anaesthesia: ['block', 'anaesthesia', 'lignocaine'],
      more_than_ordinary: ['ct', 'mri', 'specialist', 'referral']
    };

    const relevantKeywords = keywords[type as keyof typeof keywords] || [];
    const evidence: string[] = [];

    for (const sentence of sentences) {
      if (relevantKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        evidence.push(`"${sentence.trim()}"`);
        if (evidence.length >= 2) break;
      }
    }

    return evidence.length > 0 ? evidence : [`"${notes.substring(0, 80)}..."`];
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private findAllEligibleCodes(formData: any): string[] {
    // This would ideally check all KB items against the clinical notes
    // For now, return a realistic estimate
    const eligible = ['5012']; // Primary attendance always eligible
    
    if (this.containsAny(formData.clinicalNotes.toLowerCase(), ['fracture', 'broken'])) {
      eligible.push('14270');
    }
    
    if (this.containsAny(formData.clinicalNotes.toLowerCase(), ['suture', 'repair'])) {
      eligible.push('14263');
    }

    return eligible;
  }

  // Test against gold standard
  testAgainstGoldStandard(testCase: string): { accuracy: number; coverage: number; details: any } {
    const goldStandard = SAMPLE_CASES[testCase as keyof typeof SAMPLE_CASES];
    if (!goldStandard) {
      throw new Error(`Test case ${testCase} not found`);
    }

    // Simulate analysis with the test case
    const mockFormData = {
      age: goldStandard.age,
      clinicalNotes: goldStandard.input,
      setting: 'ED',
      clinicianRole: 'EmergencyPhysician'
    };

    const result = this.analyzeCase(mockFormData);
    const suggestedCodes = result.codes.map(c => c.itemNumber);
    const expectedCodes = goldStandard.expectedCodes;

    // Calculate accuracy (correct codes / total suggested)
    const correctCodes = suggestedCodes.filter(code => expectedCodes.includes(code));
    const accuracy = correctCodes.length / suggestedCodes.length;

    // Calculate coverage (correct codes / total expected)
    const coverage = correctCodes.length / expectedCodes.length;

    return {
      accuracy,
      coverage,
      details: {
        suggested: suggestedCodes,
        expected: expectedCodes,
        correct: correctCodes,
        missed: expectedCodes.filter(code => !suggestedCodes.includes(code)),
        incorrect: suggestedCodes.filter(code => !expectedCodes.includes(code))
      }
    };
  }
}

export const mbsAnalyzer = new MBSAnalyzer();

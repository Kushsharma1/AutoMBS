import { loadKB, type KBItem } from './kb';

export interface MBSRecommendation {
  code: string;
  title: string;
  confidence: number;
  reasoning: string;
  evidence: string[];
  scheduleeFee?: number;
}

export class SmartMBSEngine {
  private kb: any;
  
  constructor() {
    this.kb = loadKB();
  }

  analyzeCase(formData: any): MBSRecommendation[] {
    const clinicalText = formData.clinicalNotes.toLowerCase();
    const age = parseInt(formData.age);
    const setting = formData.setting;
    const clinicianRole = formData.clinicianRole;
    
    let recommendations: MBSRecommendation[] = [];
    
    // 1. PRIMARY ATTENDANCE CODES (Always needed)
    recommendations.push(...this.getPrimaryAttendanceCodes(age, setting, clinicianRole, clinicalText));
    
    // 2. PROCEDURE CODES (Based on clinical notes)
    recommendations.push(...this.getProcedureCodes(clinicalText, age));
    
    // 3. INVESTIGATION CODES (Based on mentioned tests)
    recommendations.push(...this.getInvestigationCodes(clinicalText));
    
    // 4. MEDICATION CODES (Based on treatments)
    recommendations.push(...this.getMedicationCodes(clinicalText));
    
    // Sort by confidence and return top 5
    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  private getPrimaryAttendanceCodes(age: number, setting: string, role: string, notes: string): MBSRecommendation[] {
    const codes: MBSRecommendation[] = [];
    
    if (setting === 'ED') {
      // Emergency Department codes
      if (age >= 4 && age <= 74) {
        const complexity = this.assessComplexity(notes);
        
        if (complexity === 'high') {
          codes.push({
            code: '104',
            title: 'Emergency department attendance - more than ordinary',
            confidence: 0.88,
            reasoning: 'Complex ED case requiring extensive investigation/management',
            evidence: this.extractEvidenceForComplexity(notes),
            scheduleeFee: 89.15
          });
        } else {
          codes.push({
            code: '103',
            title: 'Emergency department attendance - ordinary',
            confidence: 0.82,
            reasoning: 'Standard ED attendance for clinical assessment',
            evidence: [notes.substring(0, 100) + '...'],
            scheduleeFee: 67.85
          });
        }
      }
    } else if (setting === 'GP') {
      // GP codes based on consultation complexity
      const duration = this.estimateConsultationDuration(notes);
      
      if (duration > 40 || this.hasComplexManagement(notes)) {
        codes.push({
          code: '36',
          title: 'GP Level C consultation (long)',
          confidence: 0.85,
          reasoning: 'Extended consultation with complex management',
          evidence: this.extractEvidenceForLongConsult(notes),
          scheduleeFee: 89.15
        });
      } else if (duration > 20) {
        codes.push({
          code: '44',
          title: 'GP Level B consultation (standard)',
          confidence: 0.80,
          reasoning: 'Standard consultation with clinical assessment',
          evidence: [notes.substring(0, 80) + '...'],
          scheduleeFee: 59.50
        });
      } else {
        codes.push({
          code: '23',
          title: 'GP Level A consultation (brief)',
          confidence: 0.75,
          reasoning: 'Brief consultation for straightforward issue',
          evidence: [notes.substring(0, 60) + '...'],
          scheduleeFee: 39.75
        });
      }
    }
    
    return codes;
  }

  private getProcedureCodes(notes: string, age: number): MBSRecommendation[] {
    const codes: MBSRecommendation[] = [];
    
    // Wound care
    if (this.containsAny(notes, ['suture', 'stitch', 'wound', 'laceration', 'cut'])) {
      codes.push({
        code: '30192',
        title: 'Repair of wound by suturing',
        confidence: 0.78,
        reasoning: 'Wound repair procedure indicated by clinical notes',
        evidence: this.extractEvidence(notes, ['suture', 'stitch', 'wound', 'laceration']),
        scheduleeFee: 67.85
      });
    }
    
    // Injections
    if (this.containsAny(notes, ['injection', 'injected', 'steroid', 'cortisone'])) {
      codes.push({
        code: '18213',
        title: 'Therapeutic injection',
        confidence: 0.72,
        reasoning: 'Therapeutic injection mentioned in clinical notes',
        evidence: this.extractEvidence(notes, ['injection', 'injected', 'steroid']),
        scheduleeFee: 45.20
      });
    }
    
    return codes;
  }

  private getInvestigationCodes(notes: string): MBSRecommendation[] {
    const codes: MBSRecommendation[] = [];
    
    // X-rays
    if (this.containsAny(notes, ['x-ray', 'xray', 'radiograph', 'imaging'])) {
      codes.push({
        code: '58500',
        title: 'Plain radiographic examination',
        confidence: 0.85,
        reasoning: 'X-ray investigation mentioned in clinical notes',
        evidence: this.extractEvidence(notes, ['x-ray', 'xray', 'radiograph']),
        scheduleeFee: 67.85
      });
    }
    
    // ECG
    if (this.containsAny(notes, ['ecg', 'ekg', 'electrocardiogram', 'heart rhythm'])) {
      codes.push({
        code: '11700',
        title: 'Electrocardiography',
        confidence: 0.80,
        reasoning: 'ECG investigation indicated by clinical presentation',
        evidence: this.extractEvidence(notes, ['ecg', 'ekg', 'electrocardiogram']),
        scheduleeFee: 34.30
      });
    }
    
    // Blood tests
    if (this.containsAny(notes, ['blood test', 'fbc', 'full blood count', 'pathology'])) {
      codes.push({
        code: '65070',
        title: 'Full blood examination',
        confidence: 0.75,
        reasoning: 'Blood investigation mentioned in clinical notes',
        evidence: this.extractEvidence(notes, ['blood test', 'fbc', 'pathology']),
        scheduleeFee: 23.15
      });
    }
    
    return codes;
  }

  private getMedicationCodes(notes: string): MBSRecommendation[] {
    const codes: MBSRecommendation[] = [];
    
    // Medication administration
    if (this.containsAny(notes, ['given', 'administered', 'medication', 'drug', 'paracetamol', 'ibuprofen'])) {
      codes.push({
        code: '18213',
        title: 'Medication administration',
        confidence: 0.70,
        reasoning: 'Medication administration documented',
        evidence: this.extractEvidence(notes, ['given', 'administered', 'medication']),
        scheduleeFee: 23.15
      });
    }
    
    return codes;
  }

  // Helper methods
  private assessComplexity(notes: string): 'low' | 'medium' | 'high' {
    const complexityIndicators = [
      'ct', 'mri', 'ultrasound', 'specialist', 'consult', 'multiple', 
      'complex', 'procedure', 'surgery', 'admission', 'review'
    ];
    
    const matches = complexityIndicators.filter(indicator => 
      notes.includes(indicator)
    ).length;
    
    if (matches >= 3) return 'high';
    if (matches >= 1) return 'medium';
    return 'low';
  }

  private estimateConsultationDuration(notes: string): number {
    // Estimate based on note length and complexity
    const wordCount = notes.split(' ').length;
    const complexWords = ['history', 'examination', 'investigation', 'management', 'plan'];
    const complexCount = complexWords.filter(word => notes.includes(word)).length;
    
    // Base duration on content
    let duration = Math.min(wordCount / 10, 60); // 1 min per 10 words, max 60
    duration += complexCount * 5; // Add 5 min per complex element
    
    return Math.round(duration);
  }

  private hasComplexManagement(notes: string): boolean {
    const complexIndicators = [
      'multiple medications', 'referral', 'specialist', 'follow-up', 
      'chronic', 'management plan', 'review', 'monitoring'
    ];
    
    return complexIndicators.some(indicator => notes.includes(indicator));
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractEvidence(notes: string, keywords: string[]): string[] {
    const sentences = notes.split(/[.!?]+/);
    const evidence: string[] = [];
    
    for (const keyword of keywords) {
      const sentence = sentences.find(s => s.toLowerCase().includes(keyword));
      if (sentence && sentence.trim().length > 10) {
        evidence.push(`"${sentence.trim()}"`);
        if (evidence.length >= 2) break;
      }
    }
    
    return evidence.length > 0 ? evidence : [`"${notes.substring(0, 80)}..."`];
  }

  private extractEvidenceForComplexity(notes: string): string[] {
    const complexityWords = ['ct', 'specialist', 'multiple', 'complex', 'procedure'];
    return this.extractEvidence(notes, complexityWords);
  }

  private extractEvidenceForLongConsult(notes: string): string[] {
    const longConsultWords = ['history', 'examination', 'management', 'plan', 'review'];
    return this.extractEvidence(notes, longConsultWords);
  }
}

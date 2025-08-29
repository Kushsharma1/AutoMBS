// MBS Restriction Rules Engine
// Implements common same-day and combination restrictions

export interface MBSRestriction {
  id: string;
  name: string;
  type: 'same_day_exclusion' | 'frequency_limit' | 'age_restriction' | 'setting_restriction' | 'combination_rule';
  description: string;
  items: string[];
  rule: (codes: string[], patientInfo?: any) => RestrictionResult;
}

export interface RestrictionResult {
  isValid: boolean;
  violations: string[];
  warnings: string[];
  suggestions: string[];
}

// Common MBS Restriction Rules
export const MBS_RESTRICTIONS: MBSRestriction[] = [
  {
    id: 'gp_consult_same_day',
    name: 'GP Consultation Same Day Rule',
    type: 'same_day_exclusion',
    description: 'Only one GP attendance per day unless different problems',
    items: ['3', '23', '36', '44'],
    rule: (codes: string[]) => {
      const gpCodes = codes.filter(code => ['3', '23', '36', '44'].includes(code));
      
      if (gpCodes.length > 1) {
        return {
          isValid: false,
          violations: [`Multiple GP attendances on same day: ${gpCodes.join(', ')}`],
          warnings: [],
          suggestions: ['Consider using highest complexity level only', 'Ensure different problems justify multiple consultations']
        };
      }
      
      return { isValid: true, violations: [], warnings: [], suggestions: [] };
    }
  },

  {
    id: 'specialist_initial_subsequent',
    name: 'Specialist Initial vs Subsequent',
    type: 'combination_rule',
    description: 'Cannot claim both initial and subsequent specialist consultation same day',
    items: ['104', '105', '116', '119'],
    rule: (codes: string[]) => {
      const initialCodes = codes.filter(code => ['104', '116'].includes(code));
      const subsequentCodes = codes.filter(code => ['105', '119'].includes(code));
      
      if (initialCodes.length > 0 && subsequentCodes.length > 0) {
        return {
          isValid: false,
          violations: ['Cannot claim both initial and subsequent specialist consultation same day'],
          warnings: [],
          suggestions: ['Use initial consultation code for new patients', 'Use subsequent consultation code for established patients']
        };
      }
      
      return { isValid: true, violations: [], warnings: [], suggestions: [] };
    }
  },

  {
    id: 'pathology_episode_limits',
    name: 'Pathology Episode Limits',
    type: 'frequency_limit',
    description: 'Some pathology tests limited per episode',
    items: ['65070', '65092', '66596'],
    rule: (codes: string[]) => {
      const pathologyCodes = codes.filter(code => ['65070', '65092', '66596'].includes(code));
      const duplicates = pathologyCodes.filter((code, index) => pathologyCodes.indexOf(code) !== index);
      
      if (duplicates.length > 0) {
        return {
          isValid: false,
          violations: [`Duplicate pathology codes not allowed: ${duplicates.join(', ')}`],
          warnings: [],
          suggestions: ['Remove duplicate pathology items', 'Check if different test dates justify separate claims']
        };
      }
      
      return { isValid: true, violations: [], warnings: [], suggestions: [] };
    }
  },

  {
    id: 'telehealth_attendance_rules',
    name: 'Telehealth Attendance Rules',
    type: 'combination_rule',
    description: 'Telehealth codes cannot be combined with face-to-face consultations',
    items: ['91800', '91801', '91802'],
    rule: (codes: string[]) => {
      const telehealthCodes = codes.filter(code => ['91800', '91801', '91802'].includes(code));
      const faceToFaceCodes = codes.filter(code => ['3', '23', '36', '44'].includes(code));
      
      if (telehealthCodes.length > 0 && faceToFaceCodes.length > 0) {
        return {
          isValid: false,
          violations: ['Cannot combine telehealth and face-to-face consultations same day'],
          warnings: [],
          suggestions: ['Use telehealth codes for remote consultations only', 'Use face-to-face codes for in-person visits only']
        };
      }
      
      return { isValid: true, violations: [], warnings: [], suggestions: [] };
    }
  },

  {
    id: 'minor_procedure_consultation',
    name: 'Minor Procedure with Consultation',
    type: 'combination_rule',
    description: 'Minor procedures may include consultation component',
    items: ['30001', '30003', '30005'],
    rule: (codes: string[]) => {
      const procedureCodes = codes.filter(code => ['30001', '30003', '30005'].includes(code));
      const consultCodes = codes.filter(code => ['3', '23', '36', '44'].includes(code));
      
      if (procedureCodes.length > 0 && consultCodes.length > 0) {
        return {
          isValid: true,
          violations: [],
          warnings: ['Minor procedures may include consultation component - verify separate consultation is justified'],
          suggestions: ['Ensure consultation addresses issues separate from procedure', 'Document separate problems clearly']
        };
      }
      
      return { isValid: true, violations: [], warnings: [], suggestions: [] };
    }
  }
];

export class MBSRestrictionEngine {
  private restrictions: MBSRestriction[] = MBS_RESTRICTIONS;

  validateCodes(codes: string[], patientInfo?: any): RestrictionResult {
    const allViolations: string[] = [];
    const allWarnings: string[] = [];
    const allSuggestions: string[] = [];

    // Apply all relevant restrictions
    for (const restriction of this.restrictions) {
      const relevantCodes = codes.filter(code => restriction.items.includes(code));
      
      if (relevantCodes.length > 0) {
        const result = restriction.rule(codes, patientInfo);
        
        allViolations.push(...result.violations);
        allWarnings.push(...result.warnings);
        allSuggestions.push(...result.suggestions);
      }
    }

    return {
      isValid: allViolations.length === 0,
      violations: [...new Set(allViolations)], // Remove duplicates
      warnings: [...new Set(allWarnings)],
      suggestions: [...new Set(allSuggestions)]
    };
  }

  getApplicableRestrictions(codes: string[]): MBSRestriction[] {
    return this.restrictions.filter(restriction => 
      restriction.items.some(item => codes.includes(item))
    );
  }

  addCustomRestriction(restriction: MBSRestriction): void {
    this.restrictions.push(restriction);
  }

  // Check specific restriction scenarios
  checkSameDayRules(codes: string[]): RestrictionResult {
    const sameDayRestrictions = this.restrictions.filter(r => r.type === 'same_day_exclusion');
    const violations: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    for (const restriction of sameDayRestrictions) {
      const result = restriction.rule(codes);
      violations.push(...result.violations);
      warnings.push(...result.warnings);
      suggestions.push(...result.suggestions);
    }

    return {
      isValid: violations.length === 0,
      violations: [...new Set(violations)],
      warnings: [...new Set(warnings)],
      suggestions: [...new Set(suggestions)]
    };
  }

  getRestrictionSummary(): { [key: string]: number } {
    return {
      total: this.restrictions.length,
      same_day_exclusion: this.restrictions.filter(r => r.type === 'same_day_exclusion').length,
      frequency_limit: this.restrictions.filter(r => r.type === 'frequency_limit').length,
      combination_rule: this.restrictions.filter(r => r.type === 'combination_rule').length,
      age_restriction: this.restrictions.filter(r => r.type === 'age_restriction').length,
      setting_restriction: this.restrictions.filter(r => r.type === 'setting_restriction').length
    };
  }
}

import fs from 'fs';
import path from 'path';

export interface KBItem {
  kb_id: string;
  item_number: string;
  title: string;
  meta: {
    category: string;
    group: string;
    item_type: string;
    fee_type: string;
    fee_start: string;
    schedule_fee: number;
  };
  eligibility: {
    attendance_level?: string;
    [key: string]: any;
  };
  exclusions: Record<string, any>;
  triggers: {
    any_of: string[];
  };
  notes: string;
  restrictions: {
    same_day_exclusive_with?: string[];
    frequency?: {
      per_day?: number;
    };
    role_allowed?: string[];
    setting_allowed?: string[];
    requires_with_any_of?: string[];
    must_pair_with_attendance?: boolean;
    [key: string]: any;
  };
}

export interface KB {
  kb_version: string;
  source: string;
  items: KBItem[];
}

let kbCache: KB | null = null;

export function loadKB(): KB {
  if (kbCache) {
    return kbCache;
  }

  try {
    const kbPath = path.join(process.cwd(), 'data', 'KB.json');
    const kbContent = fs.readFileSync(kbPath, 'utf-8');
    kbCache = JSON.parse(kbContent) as KB;
    return kbCache;
  } catch (error) {
    console.error('Failed to load KB:', error);
    // Return a minimal KB structure as fallback
    return {
      kb_version: 'fallback',
      source: 'fallback',
      items: [
        {
          kb_id: 'mbs:23',
          item_number: '23',
          title: 'GP Level A consultation',
          meta: { category: '1', group: 'A1', item_type: 'S', fee_type: 'N', fee_start: '01.07.2025', schedule_fee: 39.75 },
          eligibility: { attendance_level: 'gp_level_a' },
          exclusions: {},
          triggers: { any_of: ['consultation', 'visit', 'attendance'] },
          notes: '',
          restrictions: { same_day_exclusive_with: ['36', '44'], frequency: { per_day: 1 } }
        },
        {
          kb_id: 'mbs:104',
          item_number: '104',
          title: 'Emergency department attendance',
          meta: { category: '1', group: 'A21', item_type: 'S', fee_type: 'N', fee_start: '01.07.2025', schedule_fee: 89.15 },
          eligibility: { attendance_level: 'ed_category_1' },
          exclusions: {},
          triggers: { any_of: ['emergency', 'ED', 'attendance'] },
          notes: '',
          restrictions: { same_day_exclusive_with: ['105', '106'], frequency: { per_day: 1 } }
        }
      ]
    };
  }
}

export function findCandidatesByTriggers(kb: KB, clinicalText: string): KBItem[] {
  const text = clinicalText.toLowerCase();
  const candidates: KBItem[] = [];

  for (const item of kb.items) {
    const triggers = item.triggers.any_of || [];
    const hasMatch = triggers.some(trigger => 
      text.includes(trigger.toLowerCase())
    );

    if (hasMatch) {
      candidates.push(item);
    }
  }

  return candidates;
}

export function getAttendanceItems(kb: KB, age: number, setting: string): KBItem[] {
  return kb.items.filter(item => {
    // Look for attendance items based on age and setting
    if (item.eligibility.attendance_level) {
      // Check age ranges
      if (item.eligibility.attendance_level.includes('4_74') && (age >= 4 && age < 75)) {
        return true;
      }
      if (item.eligibility.attendance_level.includes('under_4') && age < 4) {
        return true;
      }
      if (item.eligibility.attendance_level.includes('75_over') && age >= 75) {
        return true;
      }
    }
    
    // Also include general attendance items
    const title = item.title.toLowerCase();
    return title.includes('attendance') || title.includes('consultation');
  });
}

export function validateRestrictions(item: KBItem, context: {
  setting: string;
  clinicianRole: string;
  selectedItems: KBItem[];
}): {
  role_ok: boolean;
  setting_ok: boolean;
  same_day_exclusion_ok: boolean;
  must_pair_ok: boolean;
  requires_with_ok: boolean;
} {
  const restrictions = item.restrictions;
  
  // Check role restrictions
  const role_ok = !restrictions.role_allowed || 
    restrictions.role_allowed.includes(context.clinicianRole);
  
  // Check setting restrictions
  const setting_ok = !restrictions.setting_allowed || 
    restrictions.setting_allowed.includes(context.setting);
  
  // Check same day exclusions
  const same_day_exclusion_ok = !restrictions.same_day_exclusive_with ||
    !context.selectedItems.some(selected => 
      restrictions.same_day_exclusive_with!.includes(selected.item_number)
    );
  
  // Check must pair with attendance
  const must_pair_ok = !restrictions.must_pair_with_attendance ||
    context.selectedItems.some(selected => 
      selected.eligibility.attendance_level !== undefined
    );
  
  // Check requires with any of
  const requires_with_ok = !restrictions.requires_with_any_of ||
    restrictions.requires_with_any_of.some(required =>
      context.selectedItems.some(selected => 
        selected.item_number === required
      )
    );

  return {
    role_ok,
    setting_ok,
    same_day_exclusion_ok,
    must_pair_ok,
    requires_with_ok
  };
}

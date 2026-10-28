/** Safety layer: crisis routing and medical-boundary detection. Deterministic and offline. */
export interface SafetyCheck {
  level: 'crisis' | 'boundary' | 'none';
  matched?: string;
}

const CRISIS: RegExp[] = [
  /انتحار|أقتل نفسي|اقتل نفسي|إيذاء النفس|ايذاء النفس|لا أستطيع التنفس|عنف منزلي|في خطر/,
  /\bsuicid/i,
  /\bkill (myself|himself|herself|themselves|me)\b/i,
  /\bend (my|his|her|their) life\b/i,
  /\bwant(s)? to die\b/i,
  /\b(self[- ]?harm|hurt(ing)? (myself|himself|herself|themselves))\b/i,
  /\boverdos/i,
  /\b(heart attack|stroke|can'?t breathe|cannot breathe|chest pain|unconscious|not breathing|seizure)\b/i,
  /\b(abuse[sd]?|abusing|being (hit|beaten)|beats? (me|her|him|them)|domestic violence|violent(ly)?)\b/i,
  /\b(not safe|in danger|emergency)\b/i,
  /\b(bleeding (heavily|badly)|collapsed|fell and can'?t get up)\b/i,
];

const BOUNDARY: RegExp[] = [
  /تشخيص|اكتئاب|اضطراب القلق|جرعة دواء|وصف دواء/,
  /\bdiagnos/i,
  /\b(depress(ed|ion)|anxiety disorder|bipolar|adhd|autis(m|tic)|ptsd)\b/i,
  /\b(prescri|dosage|dose of|medicine for)\b/i,
];

export function checkSafety(text: string): SafetyCheck {
  const t = text || '';
  for (const re of CRISIS) {
    const m = t.match(re);
    if (m) return { level: 'crisis', matched: m[0] };
  }
  for (const re of BOUNDARY) {
    const m = t.match(re);
    if (m) return { level: 'boundary', matched: m[0] };
  }
  return { level: 'none' };
}

export const CRISIS_MESSAGE =
  'I am concerned about what you shared. FamilyMind AI cannot monitor emergencies and does not provide diagnosis or therapy, so I will not continue with ordinary coaching here. If anyone may be in immediate danger, contact your local emergency services now. If it is safe to do so, reach out to a trusted adult or a qualified professional near you.';

export const BOUNDARY_NOTE =
  'FamilyMind AI does not diagnose medical or mental-health conditions. If this is a worry about health or wellbeing, a qualified professional is the right person to ask.';

export const STANDARD_DISCLAIMER =
  'FamilyMind AI is a non-medical wellbeing aid. It does not diagnose, cannot monitor emergencies, and does not replace qualified professionals. The family reviews and controls every suggestion.';

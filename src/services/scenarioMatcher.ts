import type { ScenarioRule } from '../types';

export interface MatchResult {
  rule: ScenarioRule;
  score: number;
}

export function matchScenario(
  input: string,
  rules: ScenarioRule[]
): MatchResult | null {
  const normalizedInput = input.toLowerCase().trim();
  if (!normalizedInput) return null;

  const results: MatchResult[] = [];

  for (const rule of rules) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (normalizedInput.includes(keyword.toLowerCase())) {
        score += keyword.length;
      }
    }
    if (score > 0) {
      results.push({ rule, score });
    }
  }

  if (results.length === 0) return null;

  results.sort((a, b) => b.score - a.score);
  return results[0];
}

export type Finding = {
  ruleId: string;
  severity: 1|2|3;
  title: string;
  description: string;
  tradelineId?: string;
};

export function runAudit(tradelines: any[]): Finding[] {
  const findings: Finding[] = [];

  for (const t of tradelines) {
    if (!t.openedDate) {
      findings.push({
        ruleId: 'TL_MISSING_OPEN_DATE',
        severity: 3,
        title: 'Missing opened date',
        description: `Tradeline "${t.furnisher}" is missing an opened date.`,
        tradelineId: t.id,
      });
    }

    const s = String(t.status || '').toLowerCase();
    if (s.includes('collection') || s.includes('charge') || s.includes('repo')) {
      findings.push({
        ruleId: 'TL_DEROGATORY_STATUS',
        severity: 1,
        title: 'Derogatory status',
        description: `Tradeline "${t.furnisher}" appears derogatory (${t.status}).`,
        tradelineId: t.id,
      });
    }

    const type = String(t.accountType || '').toLowerCase();
    const isRevolving = type.includes('revolving') || type.includes('card') || type.includes('credit');
    if (isRevolving && t.balance != null && t.limit != null && t.limit > 0) {
      const util = t.balance / t.limit;
      if (util >= 0.5) {
        findings.push({
          ruleId: 'TL_HIGH_UTIL',
          severity: util >= 0.9 ? 1 : 2,
          title: 'High utilization',
          description: `Utilization is ${(util*100).toFixed(0)}% for "${t.furnisher}".`,
          tradelineId: t.id,
        });
      }
    }
  }

  return findings;
}

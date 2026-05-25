import type { ReportMutant, TautestJsonReport } from '../types';

export function buildHtmlReport(report: TautestJsonReport): string {
  const title = `Tautest ${report.summary.verdict} report`;
  const survivors = report.surviving ?? [];

  return `<!doctype html>
<html lang="en" data-tautest-schema-version="${escapeAttribute(report.schemaVersion)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${REPORT_CSS}</style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Tautest mutation report</p>
        <h1>${escapeHtml(report.summary.verdict)}</h1>
      </div>
      <div class="score ${scoreClass(report.summary.verdict)}">${formatScore(report.summary.mutationScore)}</div>
    </header>

    <section class="summary-grid" aria-label="Summary">
      ${summaryItem('Mutation score', formatScore(report.summary.mutationScore))}
      ${summaryItem('Threshold', report.summary.threshold === undefined ? 'none' : `${report.summary.threshold.toFixed(2)}%`)}
      ${summaryItem('Killed', report.summary.killed)}
      ${summaryItem('Survived', report.summary.survived)}
      ${summaryItem('No coverage', report.summary.noCoverage)}
      ${summaryItem('Runner', report.scope.runner ?? 'unknown')}
      ${summaryItem('Changed lines', report.metrics?.changedSourceLineCount ?? 'unknown')}
      ${summaryItem('Runtime', report.metrics?.runtimeMs === undefined ? 'unknown' : formatDuration(report.metrics.runtimeMs))}
    </section>

    ${report.diagnostics?.strykerConfig?.length ? diagnosticsSection(report.diagnostics.strykerConfig) : ''}
    ${report.scope.mutatedFiles.length ? listSection('Mutated files', report.scope.mutatedFiles) : ''}

    <section class="mutants" aria-label="Surviving mutants">
      <div class="section-heading">
        <h2>Surviving mutants</h2>
        <span>${survivors.length} item${survivors.length === 1 ? '' : 's'}</span>
      </div>
      ${survivors.length ? survivors.map(formatMutantCard).join('\n') : '<p class="empty">No surviving mutants found.</p>'}
    </section>
  </main>
  <script type="application/json" id="tautest-report-data">${escapeJsonScript(report)}</script>
</body>
</html>
`;
}

function summaryItem(label: string, value: string | number): string {
  return `<div class="summary-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function diagnosticsSection(diagnostics: NonNullable<TautestJsonReport['diagnostics']>['strykerConfig']): string {
  return `<section class="panel" aria-label="Stryker config diagnostics">
    <h2>Stryker config diagnostics</h2>
    <ul>${diagnostics
      .map(
        (diagnostic) =>
          `<li><strong>${escapeHtml(diagnostic.key)}</strong>: ${escapeHtml(diagnostic.message)} <span>${escapeHtml(diagnostic.suggestion)}</span></li>`
      )
      .join('')}</ul>
  </section>`;
}

function listSection(title: string, items: string[]): string {
  return `<section class="panel" aria-label="${escapeAttribute(title)}">
    <h2>${escapeHtml(title)}</h2>
    <ul class="code-list">${items.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join('')}</ul>
  </section>`;
}

function formatMutantCard(mutant: ReportMutant, index: number): string {
  const tests = mutant.coveringTests?.length
    ? mutant.coveringTests.map((test) => `<li><code>${escapeHtml(test.filePath)}</code> ${escapeHtml(test.name)}</li>`).join('')
    : '<li>None reported by Stryker.</li>';
  const insight = mutant.insight;

  return `<article class="mutant-card" id="${escapeAttribute(mutantAnchor(mutant, index))}" data-tautest-file="${escapeAttribute(
    mutant.filePath
  )}" data-tautest-line="${mutant.line}" data-tautest-mutator="${escapeAttribute(mutant.mutatorName)}">
    <div class="mutant-meta">
      <span class="index">#${index + 1}</span>
      <span><code>${escapeHtml(mutant.filePath)}:${mutant.line}</code></span>
      <span>${escapeHtml(mutant.mutatorName)}</span>
      <span>${escapeHtml(mutant.status)}</span>
    </div>
    <div class="code-diff" aria-label="Mutation diff">
      <pre><code>${escapeHtml(mutant.original)}</code></pre>
      <pre><code>${escapeHtml(mutant.replacement)}</code></pre>
    </div>
    <dl class="insight">
      <dt>Likely missing behavior</dt>
      <dd>${escapeHtml(insight?.missingBehavior ?? 'No insight available.')}</dd>
      <dt>Why this matters</dt>
      <dd>${escapeHtml(insight?.whyThisMatters ?? 'No insight available.')}</dd>
      <dt>Suggested test idea</dt>
      <dd>${escapeHtml(insight?.suggestedTestIdea ?? 'No suggestion available.')}</dd>
    </dl>
    <details>
      <summary>Covering tests</summary>
      <ul>${tests}</ul>
    </details>
  </article>`;
}

function mutantAnchor(mutant: ReportMutant, index: number): string {
  return `mutant-${index + 1}-${mutant.filePath}-${mutant.line}`.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function formatScore(score: number | null): string {
  return score === null ? 'unknown' : `${score.toFixed(2)}%`;
}

function formatDuration(runtimeMs: number): string {
  return runtimeMs < 1000 ? `${runtimeMs}ms` : `${(runtimeMs / 1000).toFixed(1)}s`;
}

function scoreClass(verdict: TautestJsonReport['summary']['verdict']): string {
  if (verdict === 'STRONG') {
    return 'score-strong';
  }

  if (verdict === 'MIXED') {
    return 'score-mixed';
  }

  return 'score-weak';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeJsonScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const REPORT_CSS = `
:root {
  color-scheme: light;
  --bg: #f7f8fb;
  --surface: #ffffff;
  --text: #18202f;
  --muted: #667085;
  --border: #d9dee8;
  --strong: #087443;
  --mixed: #a15c00;
  --weak: #b42318;
  --code: #101828;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}
.eyebrow {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 13px;
  text-transform: uppercase;
}
h1, h2 {
  margin: 0;
}
h1 {
  font-size: 36px;
  line-height: 1.1;
}
h2 {
  font-size: 20px;
}
.score {
  min-width: 132px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-size: 24px;
  font-weight: 750;
  text-align: center;
}
.score-strong {
  color: var(--strong);
}
.score-mixed {
  color: var(--mixed);
}
.score-weak {
  color: var(--weak);
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}
.summary-item, .panel, .mutant-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.summary-item {
  padding: 12px;
}
.summary-item span {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.summary-item strong {
  display: block;
  margin-top: 5px;
  font-size: 18px;
}
.panel {
  padding: 18px;
  margin-bottom: 18px;
}
.panel ul {
  margin: 12px 0 0;
  padding-left: 20px;
}
code, pre {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}
code {
  color: var(--code);
}
.code-list li {
  margin: 6px 0;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 26px 0 12px;
}
.section-heading span {
  color: var(--muted);
}
.mutant-card {
  padding: 18px;
  margin-bottom: 14px;
}
.mutant-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  color: var(--muted);
  font-size: 13px;
}
.index {
  color: var(--text);
  font-weight: 700;
}
.code-diff {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
  margin: 14px 0;
}
pre {
  min-height: 68px;
  overflow: auto;
  margin: 0;
  padding: 12px;
  border-radius: 6px;
  background: #f2f4f7;
  line-height: 1.5;
}
.insight {
  display: grid;
  grid-template-columns: minmax(150px, 220px) 1fr;
  gap: 8px 14px;
  margin: 0 0 12px;
}
.insight dt {
  color: var(--muted);
  font-weight: 700;
}
.insight dd {
  margin: 0;
}
details {
  color: var(--muted);
}
details ul {
  margin: 8px 0 0;
  padding-left: 20px;
}
.empty {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 18px;
}
@media (max-width: 640px) {
  .shell {
    width: min(100% - 20px, 1120px);
    padding: 20px 0;
  }
  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }
  h1 {
    font-size: 30px;
  }
  .score {
    width: 100%;
  }
  .insight {
    grid-template-columns: 1fr;
  }
}
`;

import type { ReliabilityFinding, ReliabilityReport } from './types';

export function buildReliabilityMarkdownReport(report: ReliabilityReport): string {
  return [
    `# Tautest ${titleCase(report.kind)} Report`,
    '',
    `Risk score: **${report.summary.riskScore.toFixed(2)}**`,
    `Findings: **${report.summary.findingCount}**`,
    `Files inspected: **${report.scope.files.length}**`,
    '',
    '| Severity | File | Line | Finding | Remediation |',
    '| --- | --- | ---: | --- | --- |',
    ...(report.findings.length > 0
      ? report.findings.map((finding) => `| ${finding.severity} | \`${finding.filePath}\` | ${finding.line ?? ''} | ${escapeMarkdown(finding.title)} | ${escapeMarkdown(finding.remediation)} |`)
      : ['| info |  |  | No findings. | No action required. |']),
    ''
  ].join('\n');
}

export function buildReliabilityTerminalSummary(report: ReliabilityReport): string {
  const lines = [
    `Tautest ${report.kind}: risk ${report.summary.riskScore.toFixed(2)} (${report.summary.findingCount} findings)`,
    `Files inspected: ${report.scope.files.length}`,
    `Findings: high ${report.summary.high} | medium ${report.summary.medium} | low ${report.summary.low} | info ${report.summary.info}`
  ];
  const topFindings = report.findings.slice(0, 5);

  if (topFindings.length > 0) {
    lines.push('', 'Top findings:', ...topFindings.map(formatFindingLine));
  }

  return `${lines.join('\n')}\n`;
}

export function buildReliabilityHtmlReport(report: ReliabilityReport): string {
  const title = `Tautest ${titleCase(report.kind)} report`;

  return `<!doctype html>
<html lang="en" data-tautest-reliability-schema-version="${escapeAttribute(report.schemaVersion)}">
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
        <p class="eyebrow">Tautest reliability report</p>
        <h1>${escapeHtml(titleCase(report.kind))}</h1>
      </div>
      <div class="score ${scoreClass(report.summary.riskScore)}">${report.summary.riskScore.toFixed(2)}</div>
    </header>

    <section class="summary-grid" aria-label="Summary">
      ${summaryItem('Risk score', report.summary.riskScore.toFixed(2))}
      ${summaryItem('Findings', report.summary.findingCount)}
      ${summaryItem('High', report.summary.high)}
      ${summaryItem('Medium', report.summary.medium)}
      ${summaryItem('Low', report.summary.low)}
      ${summaryItem('Files', report.scope.files.length)}
      ${summaryItem('Runner', report.scope.runner ?? 'unknown')}
      ${summaryItem('Created', report.createdAt)}
    </section>

    ${metadataSection(report)}

    <section class="findings" aria-label="Reliability findings">
      <div class="section-heading">
        <h2>Findings</h2>
        <span>${report.findings.length} item${report.findings.length === 1 ? '' : 's'}</span>
      </div>
      ${report.findings.length ? report.findings.map(formatFindingCard).join('\n') : '<p class="empty">No reliability findings.</p>'}
    </section>
  </main>
  <script type="application/json" id="tautest-reliability-report-data">${escapeJsonScript(report)}</script>
</body>
</html>
`;
}

export function isReliabilityReport(value: unknown): value is ReliabilityReport {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReliabilityReport>;
  return candidate.version === '1' && candidate.schemaVersion === '1' && typeof candidate.kind === 'string' && Array.isArray(candidate.findings);
}

function formatFindingLine(finding: ReliabilityFinding): string {
  const location = finding.line === undefined ? finding.filePath : `${finding.filePath}:${finding.line}`;
  return `- [${finding.severity}] ${location} ${finding.title}`;
}

function formatFindingCard(finding: ReliabilityFinding): string {
  const location = finding.line === undefined ? finding.filePath : `${finding.filePath}:${finding.line}`;

  return `<article class="finding-card" data-tautest-file="${escapeAttribute(finding.filePath)}" data-tautest-line="${escapeAttribute(String(finding.line ?? ''))}">
    <div class="finding-meta">
      <span class="severity severity-${escapeAttribute(finding.severity)}">${escapeHtml(finding.severity)}</span>
      <span><code>${escapeHtml(location)}</code></span>
      <span>${escapeHtml(finding.category)}</span>
      <span>risk ${finding.riskScore.toFixed(0)}</span>
    </div>
    <h2>${escapeHtml(finding.title)}</h2>
    <dl>
      <dt>Evidence</dt>
      <dd><code>${escapeHtml(finding.evidence)}</code></dd>
      <dt>Remediation</dt>
      <dd>${escapeHtml(finding.remediation)}</dd>
    </dl>
  </article>`;
}

function metadataSection(report: ReliabilityReport): string {
  if (!report.metadata || Object.keys(report.metadata).length === 0) {
    return '';
  }

  return `<section class="panel" aria-label="Metadata">
    <h2>Metadata</h2>
    <pre><code>${escapeHtml(JSON.stringify(report.metadata, null, 2))}</code></pre>
  </section>`;
}

function summaryItem(label: string, value: string | number): string {
  return `<div class="summary-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function scoreClass(score: number): string {
  if (score >= 80) {
    return 'score-high';
  }

  if (score >= 50) {
    return 'score-medium';
  }

  return 'score-low';
}

function titleCase(value: string): string {
  return value.replace(/(^|-)([a-z])/g, (_, prefix: string, char: string) => `${prefix === '-' ? ' ' : ''}${char.toUpperCase()}`);
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
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
  --high: #b42318;
  --medium: #a15c00;
  --low: #087443;
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
.score-high, .severity-high {
  color: var(--high);
}
.score-medium, .severity-medium {
  color: var(--medium);
}
.score-low, .severity-low, .severity-info {
  color: var(--low);
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}
.summary-item, .panel, .finding-card, .empty {
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
.panel, .finding-card, .empty {
  padding: 18px;
  margin-bottom: 14px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 26px 0 12px;
}
.section-heading span, .finding-meta {
  color: var(--muted);
}
.finding-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 12px;
  font-size: 13px;
}
.severity {
  font-weight: 800;
  text-transform: uppercase;
}
dl {
  display: grid;
  grid-template-columns: minmax(140px, 190px) 1fr;
  gap: 8px 14px;
}
dt {
  color: var(--muted);
  font-weight: 700;
}
dd {
  margin: 0;
}
code, pre {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}
pre {
  overflow: auto;
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 6px;
  background: #f2f4f7;
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
  dl {
    grid-template-columns: 1fr;
  }
}
`;

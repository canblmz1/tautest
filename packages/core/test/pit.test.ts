import { describe, it, expect } from 'vitest';
import { parsePitXmlReport, createPitAlphaRunnerPlugin } from '../src/runner/pit';

describe('PIT alpha XML parser', () => {
  it('returns empty report for XML with no mutations', () => {
    const report = parsePitXmlReport('<mutations></mutations>');

    expect(report.mutants).toHaveLength(0);
    expect(report.summary.total).toBe(0);
    expect(report.summary.mutationScore).toBeNull();
    expect(report.runner.id).toBe('pit-alpha');
    expect(report.runner.language).toBe('java');
  });

  it('parses a killed mutant with all fields', () => {
    const xml = `
      <mutations>
        <mutation status="KILLED" detected="true">
          <sourceFile>src/Calculator.java</sourceFile>
          <lineNumber>10</lineNumber>
          <mutator>org.pitest.mutationtest.engine.gregor.mutators.MathMutator</mutator>
          <description>Replaced integer addition with subtraction</description>
          <mutatedClass>com.example.Calculator</mutatedClass>
          <mutatedMethod>add</mutatedMethod>
        </mutation>
      </mutations>
    `;
    const report = parsePitXmlReport(xml);

    expect(report.mutants).toHaveLength(1);
    expect(report.mutants[0]!.status).toBe('killed');
    expect(report.mutants[0]!.filePath).toBe('src/Calculator.java');
    expect(report.mutants[0]!.line).toBe(10);
    expect(report.summary.killed).toBe(1);
    expect(report.summary.survived).toBe(0);
    expect(report.summary.mutationScore).toBe(100);
  });

  it('parses a survived mutant and computes score correctly', () => {
    const xml = `
      <mutations>
        <mutation status="SURVIVED" detected="false">
          <sourceFile>src/Discount.java</sourceFile>
          <lineNumber>42</lineNumber>
          <mutator>org.pitest.mutationtest.engine.gregor.mutators.ConditionalsBoundaryMutator</mutator>
          <description>changed conditional boundary</description>
        </mutation>
      </mutations>
    `;
    const report = parsePitXmlReport(xml);

    expect(report.mutants[0]!.status).toBe('survived');
    expect(report.summary.survived).toBe(1);
    expect(report.summary.mutationScore).toBe(0);
  });

  it('falls back to detected attribute when status attribute is missing', () => {
    const xml = `
      <mutations>
        <mutation detected="true">
          <sourceFile>src/Foo.java</sourceFile>
          <lineNumber>5</lineNumber>
          <mutator>SOME_MUTATOR</mutator>
        </mutation>
      </mutations>
    `;
    const report = parsePitXmlReport(xml);

    expect(report.mutants[0]!.status).toBe('killed');
  });

  it('defaults filePath to unknown.java when sourceFile element is missing', () => {
    const xml = `
      <mutations>
        <mutation status="KILLED">
          <lineNumber>1</lineNumber>
          <mutator>MUTATOR</mutator>
        </mutation>
      </mutations>
    `;
    const report = parsePitXmlReport(xml);

    expect(report.mutants[0]!.filePath).toBe('unknown.java');
  });

  it('defaults line to 1 when lineNumber is missing or invalid', () => {
    const xml = `
      <mutations>
        <mutation status="KILLED">
          <sourceFile>src/Foo.java</sourceFile>
          <lineNumber>not-a-number</lineNumber>
          <mutator>MUTATOR</mutator>
        </mutation>
      </mutations>
    `;
    const report = parsePitXmlReport(xml);

    expect(report.mutants[0]!.line).toBe(1);
  });

  it('includes alpha limitations in result', () => {
    const report = parsePitXmlReport('<mutations></mutations>');

    expect(report.limitations.some((l) => l.code === 'java-alpha-parser-only')).toBe(true);
    expect(report.limitations.some((l) => l.code === 'java-source-class-mapping')).toBe(true);
  });

  it('computes correct score across multiple mutants', () => {
    const xml = `
      <mutations>
        <mutation status="KILLED"><sourceFile>A.java</sourceFile><lineNumber>1</lineNumber><mutator>M</mutator></mutation>
        <mutation status="KILLED"><sourceFile>A.java</sourceFile><lineNumber>2</lineNumber><mutator>M</mutator></mutation>
        <mutation status="SURVIVED"><sourceFile>A.java</sourceFile><lineNumber>3</lineNumber><mutator>M</mutator></mutation>
      </mutations>
    `;
    const report = parsePitXmlReport(xml);

    expect(report.summary.total).toBe(3);
    expect(report.summary.killed).toBe(2);
    expect(report.summary.survived).toBe(1);
    expect(report.summary.mutationScore).toBeCloseTo(66.67, 1);
  });
});

describe('createPitAlphaRunnerPlugin', () => {
  it('detects Java project from pom.xml', () => {
    const plugin = createPitAlphaRunnerPlugin();
    const detection = plugin.detect({ rootDir: '/fake', files: ['pom.xml', 'src/Main.java'] });

    expect(detection.supported).toBe(true);
    expect(detection.confidence).toBe('medium');
  });

  it('detects Java project from build.gradle', () => {
    const plugin = createPitAlphaRunnerPlugin();
    const detection = plugin.detect({ rootDir: '/fake', files: ['build.gradle'] });

    expect(detection.supported).toBe(true);
  });

  it('returns not supported when no Java build file is present', () => {
    const plugin = createPitAlphaRunnerPlugin();
    const detection = plugin.detect({ rootDir: '/fake', files: ['package.json', 'src/app.ts'] });

    expect(detection.supported).toBe(false);
    expect(detection.confidence).toBe('low');
  });

  it('throws when parseReport receives non-string input', () => {
    const plugin = createPitAlphaRunnerPlugin();

    expect(() => plugin.parseReport({})).toThrow('PIT alpha parser expects XML text.');
    expect(() => plugin.parseReport(null)).toThrow('PIT alpha parser expects XML text.');
  });

  it('parses report from string via parseReport', () => {
    const plugin = createPitAlphaRunnerPlugin();
    const report = plugin.parseReport('<mutations></mutations>');

    expect(report.runner.id).toBe('pit-alpha');
  });

  it('returns limitations from explainLimitations', () => {
    const plugin = createPitAlphaRunnerPlugin();
    const limitations = plugin.explainLimitations!({ rootDir: '/fake' });

    expect(limitations.length).toBeGreaterThan(0);
    expect(limitations[0]!.severity).toBe('warning');
  });
});

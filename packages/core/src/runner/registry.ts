import type { MutationRunnerPlugin, MutationRunnerProjectContext } from './types';

export class MutationRunnerRegistry {
  private readonly plugins = new Map<string, MutationRunnerPlugin>();

  register(plugin: MutationRunnerPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Mutation runner plugin already registered: ${plugin.id}`);
    }

    this.plugins.set(plugin.id, plugin);
  }

  get(id: string): MutationRunnerPlugin | undefined {
    return this.plugins.get(id);
  }

  list(): MutationRunnerPlugin[] {
    return [...this.plugins.values()];
  }

  detect(context: MutationRunnerProjectContext): Array<{ plugin: MutationRunnerPlugin; detection: ReturnType<MutationRunnerPlugin['detect']> }> {
    return this.list().map((plugin) => ({
      plugin,
      detection: plugin.detect(context)
    }));
  }

  select(context: MutationRunnerProjectContext, preferredId?: string): MutationRunnerPlugin | null {
    if (preferredId) {
      return this.get(preferredId) ?? null;
    }

    const detected = this.detect(context)
      .filter((item) => item.detection.supported)
      .sort((a, b) => confidenceRank(b.detection.confidence) - confidenceRank(a.detection.confidence));

    return detected[0]?.plugin ?? null;
  }
}

export function createMutationRunnerRegistry(plugins: MutationRunnerPlugin[] = []): MutationRunnerRegistry {
  const registry = new MutationRunnerRegistry();

  for (const plugin of plugins) {
    registry.register(plugin);
  }

  return registry;
}

function confidenceRank(confidence: 'high' | 'medium' | 'low'): number {
  if (confidence === 'high') {
    return 3;
  }

  if (confidence === 'medium') {
    return 2;
  }

  return 1;
}

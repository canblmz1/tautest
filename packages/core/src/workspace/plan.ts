import { detectWorkspace } from './detect';
import { selectAffectedWorkspacePackages } from './affected';
import type { ChangedFile, WorkspacePackageSelection, WorkspacePlan, WorkspaceSelectionMode } from '../types';

export interface BuildWorkspacePlanOptions {
  cwd: string;
  changedFiles: ChangedFile[];
  mode?: WorkspaceSelectionMode;
  packages?: string[];
}

export function buildWorkspacePlan(options: BuildWorkspacePlanOptions): WorkspacePlan {
  const workspace = detectWorkspace(options.cwd);
  const mode = options.mode ?? (options.packages && options.packages.length > 0 ? 'packages' : 'affected');
  const warnings = [...workspace.warnings];
  let selections: WorkspacePackageSelection[];

  if (!workspace.detected) {
    warnings.push('No workspace root was detected from pnpm-workspace.yaml or package.json workspaces.');
  }

  if (mode === 'all') {
    selections = workspace.packages.map((workspacePackage) => ({
      ...workspacePackage,
      selected: true,
      reasons: ['selected by --all']
    }));
  } else if (mode === 'packages') {
    const requested = new Set((options.packages ?? []).map(normalizeSelector));

    selections = workspace.packages.map((workspacePackage) => {
      const selected = requested.has(normalizeSelector(workspacePackage.path)) || (workspacePackage.name ? requested.has(normalizeSelector(workspacePackage.name)) : false);

      return {
        ...workspacePackage,
        selected,
        reasons: selected ? ['selected by --packages'] : []
      };
    });

    const matched = new Set(
      selections.flatMap((selection) => {
        if (!selection.selected) {
          return [];
        }

        return [normalizeSelector(selection.path), ...(selection.name ? [normalizeSelector(selection.name)] : [])];
      })
    );

    for (const requestedPackage of requested) {
      if (!matched.has(requestedPackage)) {
        warnings.push(`Requested package selector did not match a workspace package: ${requestedPackage}`);
      }
    }
  } else {
    const affected = selectAffectedWorkspacePackages(workspace.packages, options.changedFiles);
    selections = affected.selections;
    warnings.push(...affected.warnings);
  }

  return {
    mode,
    workspace,
    changedFiles: options.changedFiles,
    selectedPackages: selections.filter((selection) => selection.selected),
    unselectedPackages: selections.filter((selection) => !selection.selected),
    warnings
  };
}

export function parsePackageSelectors(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSelector(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\/+/, '').toLowerCase();
}

import type { Extension, Uri } from "vscode";
import type { ExtensionManifest, ExtensionTheme } from "vscode-extension-manifest";
import { logger } from "./logger.js";

export class ThemeRegistry {
  readonly labels: Map<string, Set<string>> = new Map();
  readonly themes: Map<string, ExtensionTheme> = new Map();
  readonly uris: Map<ExtensionTheme, Uri> = new Map();

  registerThemeContribution(theme: ExtensionTheme, uri: Uri) {
    const id = theme.id ?? theme.label;
    if (!id) {
      logger.debug(`tried to register a theme contribution without id: ${uri.toString(true)}`, theme, uri);
      return;
    }
    const cacheHit = this.themes.get(id);
    if (cacheHit) {
        logger.debug(`tried to register a duplicate theme contribution: ${theme.id}`, theme, uri);
        return;
    }

    let labels = this.labels.get(id);
    if (!labels) {
        labels = new Set();
        this.labels.set(id, labels);
    }
    if (theme.label && theme.label !== id) {
      labels.add(theme.label);
    }
    if (labels.size > 1) {
      logger.debug(`theme '${id}' has multiple labels: ${[...labels.values()].join(', ')}`, theme, labels);
    }

    this.themes.set(id, theme);
    this.uris.set(theme, uri);
  }

  resolveLabelToId(label: string): string {
    if (this.labels.has(label)) {
        return label;
    }
    for (const [id, labels] of this.labels.entries()) {
        if (labels.has(label)) {
            return id;
        }
    }
    return label;
  }

  getUri(theme: ExtensionTheme): Uri {
    return this.uris.get(theme)!;
  }

  getLabels(themeId: string): string[] {
    return [...this.labels.get(themeId) ?? []];
  }

  static build(extensions: readonly Extension<unknown>[]) {
    const registry = new ThemeRegistry();

    for (const extension of extensions) {
      const manifest = extension.packageJSON as ExtensionManifest;
      const contributes = manifest.contributes;

      if (!contributes) {
        continue;
      }

      if (!contributes.themes) {
        continue;
      }

      for (const theme of contributes.themes) {
        registry.registerThemeContribution(theme, extension.extensionUri);
      }
    }

    return registry;
  }
}

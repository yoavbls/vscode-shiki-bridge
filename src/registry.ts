import type { ExtensionGrammer as ExtensionGrammar, ExtensionLanguage, ExtensionManifest } from "vscode-extension-manifest";
import type { Extension, Uri } from "vscode";
import { logger } from "./logger.js";

export class Registry {
  /**
   * Map of `languageId` to its aliases
   */
  readonly aliases: Map<string, Set<string>> = new Map();
  /**
   * Map of `languageId` to its extension manifest language contribution.
   * These are plural because multiple extensions can contribute to the same language id
   * @see https://code.visualstudio.com/api/references/contribution-points#contributes.languages
   */
  readonly languages: Map<string, ExtensionLanguage[]> = new Map();
  /**
   * Map of `languageId` to its extension manifest grammar contributions
   * These are plural because multiple extensions can contribute to the same language id
   * @see https://code.visualstudio.com/api/references/contribution-points#contributes.grammars
   */
  readonly grammars: Map<string, ExtensionGrammar[]> = new Map();
  /**
   * Map of contributions to its `extensionUri`
   */
  readonly uris: Map<ExtensionGrammar | ExtensionLanguage, Uri> = new Map();
  /**
   * TODO: document this
   */
  readonly scopes: Map<string, ExtensionGrammar[]> = new Map();

  registerLanguageContribution(language: ExtensionLanguage, uri: Uri) {
    if (!language.id) {
      return;
    }
    let aliases = this.aliases.get(language.id);
    if (!aliases) {
      aliases = new Set();
      this.aliases.set(language.id, aliases);
    }
    if (language.aliases) {
      language.aliases.forEach(alias => {
        // Shiki can not deal with circular aliases, so we filter them out
        if (language.id !== alias) {
          aliases.add(alias);
        }
      });
    }
    let languages = this.languages.get(language.id);
    if (!languages) {
      languages = [];
      this.languages.set(language.id, languages);
    }
    languages.push(language);
    this.uris.set(language, uri);
  }

  resolveAliasToLanguageId(alias: string): string {
    if (this.aliases.get(alias)) {
      return alias;
    }
    for (const [languageId, aliases] of this.aliases.entries()) {
      if (aliases.has(alias)) {
        return languageId;
      }
    }
    return alias;
  }

  getLanguageContributions(languageId: string): ExtensionLanguage[] {
    return this.languages.get(languageId) ?? [];
  }

  registerGrammarContribution(grammar: ExtensionGrammar & { language: string }, uri: Uri) {
    const languageId = grammar.language;
    let grammars = this.grammars.get(languageId);
    if (!grammars) {
      grammars = [];
      this.grammars.set(languageId, grammars);
    }
    grammars.push(grammar);
    this.uris.set(grammar, uri);
  }

  getGrammarContributions(languageId: string): ExtensionGrammar[] {
    return this.grammars.get(languageId) ?? [];
  }

  registerScopeContribution(grammar: ExtensionGrammar, uri: Uri) {
    let scopes = this.scopes.get(grammar.scopeName);
    if (!scopes) {
      scopes = [];
      this.scopes.set(grammar.scopeName, scopes);
    }
    scopes.push(grammar);
    this.uris.set(grammar, uri);
  }

  getScopeContributions(scopeName: string): ExtensionGrammar[] {
    return [...this.scopes.get(scopeName) ?? []];
  }

  getLanguageIds(): string[] {
    return [...this.languages.keys()];
  }

  getUri(contribution: ExtensionGrammar | ExtensionLanguage): Uri {
    return this.uris.get(contribution)!;
  }

  getAliases(languageId: string): string[] {
    return [...this.aliases.get(languageId) ?? []];
  }

  static build(extensions: readonly Extension<unknown>[]): Registry {
    const registry = new Registry();
    for (const extension of extensions) {
      const manifest = extension.packageJSON as ExtensionManifest;
      const contributes = manifest.contributes;

      if (!contributes) {
        continue;
      }

      if (contributes.languages) {
        for (const lang of contributes.languages) {
          registry.registerLanguageContribution(lang, extension.extensionUri);
        }
      }

      if (contributes.grammars) {
        for (const grammar of contributes.grammars ?? []) {
          if (hasLanguage(grammar)) {
            registry.registerGrammarContribution(grammar, extension.extensionUri);
          } else {
            logger.info(`(vscode-shiki-bridge) extension '${manifest.name}' has no language set for grammar with scope: '${grammar.scopeName}'`);
            registry.registerScopeContribution(grammar, extension.extensionUri);
          }
        }
      }
    }
    return registry;
  }
}

function hasLanguage(grammar: ExtensionGrammar): grammar is ExtensionGrammar & { language: string } {
  return typeof grammar.language === 'string';
}
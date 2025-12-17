import type { ExtensionGrammer as ExtensionGrammar, ExtensionLanguage, ExtensionManifest } from "vscode-extension-manifest";
import type { Extension, Uri } from "vscode";
import { logger } from "./logger.js";

/**
 * The `LanguageRegistry` allows `vscode-shiki-bridge` to collect all the language information from the installed (including built-in) extensions and expose an interface to build the Shiki compatible `LanguageRegistration` objects.
 */
export class LanguageRegistry {
  /**
   * Map of `languageId` to its aliases.
   */
  readonly aliases: Map<string, Set<string>> = new Map();
  /**
   * Map of `languageId` to its extension manifest language contribution.
   * These are plural because multiple extensions can contribute to the same language id.
   * @see https://code.visualstudio.com/api/references/contribution-points#contributes.languages
   */
  readonly languages: Map<string, ExtensionLanguage[]> = new Map();
  /**
   * Map of `languageId` to its extension manifest grammar contributions
   * These are plural because multiple extensions can contribute to the same language id.
   * @see https://code.visualstudio.com/api/references/contribution-points#contributes.grammars
   */
  readonly grammars: Map<string, ExtensionGrammar[]> = new Map();
  /**
   * Map of contributions to its `extensionUri`.
   */
  readonly uris: Map<ExtensionGrammar | ExtensionLanguage, Uri> = new Map();
  /**
   * Map of `scopeName` to its extension manifest grammar contribution
   * These are plural because multiple extensions can contribute to the same `scopeName`.
   * Some extensions contribute a grammar without a `language` property, these are considered `orphaned` by vscode-shiki-bridge.
   * An example is the [`text.html.basic`](https://github.com/microsoft/vscode/blob/main/extensions/html/package.json).
   * Shiki requires `LanguageRegistration` to have a `language` property, so orphaned scopes are registered as a language under their `scopeName`.
   */
  readonly orphanedScopes: Map<string, ExtensionGrammar[]> = new Map();

  registerLanguageContribution(language: ExtensionLanguage, uri: Uri) {
    if (!language.id) {
      logger.debug(`tried to register a language contribution without id: ${uri.toString(true)}`, language, uri);
      return;
    }
    let aliases = this.aliases.get(language.id);
    if (!aliases) {
      aliases = new Set();
      this.aliases.set(language.id, aliases);
    }
    if (language.aliases) {
      language.aliases.forEach(alias => {
        aliases.add(alias);
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
    if (this.aliases.has(alias)) {
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

  registerOrphanScopeContribution(grammar: ExtensionGrammar, uri: Uri) {
    let scopes = this.orphanedScopes.get(grammar.scopeName);
    if (!scopes) {
      scopes = [];
      this.orphanedScopes.set(grammar.scopeName, scopes);
    }
    scopes.push(grammar);
    if (scopes.length > 1) {
      logger.debug(`orphan scope '${grammar.scopeName}' has multiple (${scopes.length}) grammars`);
    }
    this.uris.set(grammar, uri);
  }

  getScopeContributions(scopeName: string): ExtensionGrammar[] {
    return [...this.orphanedScopes.get(scopeName) ?? []];
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

  constructor(extensions: readonly Extension<unknown>[]) {
    for (const extension of extensions) {
      const manifest = extension.packageJSON as ExtensionManifest;
      const contributes = manifest.contributes;

      if (!contributes) {
        continue;
      }

      if (contributes.languages) {
        for (const lang of contributes.languages) {
          this.registerLanguageContribution(lang, extension.extensionUri);
        }
      }

      if (contributes.grammars) {
        for (const grammar of contributes.grammars) {
          if (hasLanguage(grammar)) {
            this.registerGrammarContribution(grammar, extension.extensionUri);
          } else {
            logger.debug(`extension '${manifest.name}' has no language set for grammar with scope: '${grammar.scopeName}'`);
            this.registerOrphanScopeContribution(grammar, extension.extensionUri);
          }
        }
      }
    }
  }
}

function hasLanguage(grammar: ExtensionGrammar): grammar is ExtensionGrammar & { language: string } {
  return typeof grammar.language === 'string';
}

import type { LanguageRegistration } from "shiki";
import type { IRawGrammar } from "shiki/textmate";
import type { LanguageConfiguration } from "vscode";
import type { ExtensionGrammer as ExtensionGrammar, ExtensionLanguage } from "vscode-extension-manifest";

import type { LanguageRegistry } from "./language-registry.js";
import type { ExtensionFileReader } from "./vscode-utils.js";
import { logger } from './logger.js';
import type { LanguageConfigurationFoldingMarkers, LanguageConfigurationFull, LanguageRegistrationExtended, LanguageRegistrationMeta } from "./language-registration-types.js";

function hasConfiguration(language: ExtensionLanguage): language is ExtensionLanguage & { configuration: string } {
  return !!language.configuration;
}

export class LanguageRegistrationCollectionBuilder {
  constructor(readonly registry: LanguageRegistry, readonly fileReader: ExtensionFileReader) {}

  /**
   * Fetch the `language-configuration.json` files for the given `languages` contributions
   */
  async getLanguageConfigurationFiles(languages: ExtensionLanguage[]): Promise<Map<ExtensionLanguage, LanguageConfigurationFull>> {
    const entries = await Promise.all(languages
      .filter(hasConfiguration)
      .map(async language => {
        const uri = this.registry.getUri(language);
        const configuration = await this.fileReader.readJson<LanguageConfigurationFull>(uri, language.configuration);
        return [language, configuration] as const;
      }));
    return new Map(entries);
  }

  /**
   * Fetch the `grammar.tmLanguage[.json] | grammar.tmTheme` files for the given `grammars` contributions
   * These can be in the following formats:
   * - plist
   * - json[c]
   */
  async getGrammarFiles(grammars: ExtensionGrammar[]): Promise<Map<ExtensionGrammar, IRawGrammar>> {
    const entries = await Promise.all(grammars.map(async grammar => {
      const base = this.registry.getUri(grammar);
      const rawGrammar = await this.fileReader.readTmLanguage<IRawGrammar>(base, grammar.path);
      return [grammar, rawGrammar] as const;
    }));
    return new Map(entries);
  }

  /**
   * This function needs to build the language registrations for the given language ids.
   * It needs to:
   * - find the given language ids
   * - build at least 1 language registration
   *   - merge the language contributions
   *   - language configuration files are part of a language contribution
   *   - for each grammar (grammars are always scoped), build a language registration merge the contributions and the grammar
   * - find any embedded languages, and recursively add those to the result
   */
  async build(languageIds: string[]): Promise<LanguageRegistrationExtended[]> {
    // make a copy of the array, so we don't modify the original
    languageIds = [...languageIds];
    const results: LanguageRegistration[] = [];

    const languageIdsWithoutContributions: string[] = [];

    // the loop might add additional entries to `languageIds` in case of embedded languages
    for (const languageId of languageIds) {
      const languages = this.registry.getLanguageContributions(languageId);
      const grammars = this.registry.getGrammarContributions(languageId);

      // Testing shows some languages have no language and grammar contributions
      // ['smarty', 'vs_net', 'dosbatch', 'coffee', 'objc', 'perl6', 'scala', 'plaintext', 'sass', 'stylus', 'postcss', 'json5']
      // but the following are aliased
      // 'coffee' => 'coffeescript'
      // 'perl6' => 'raku'
      // These could be defined in an `embeddedLanguage` property from a different language
      // and thus required to be resolved to a language registration or else Shiki will throw when trying to highlight a language that has this id as part of its `embeddedLang`.
      if (languages.length === 0 && grammars.length === 0) {
        logger.debug(`language ${languageId} has no language or grammar contributions`);
        const aliased = this.registry.resolveAliasToLanguageId(languageId);
        if (aliased !== languageId) {
          logger.debug(` but is an alias for ${aliased}`);
        }
        languageIdsWithoutContributions.push(languageId);
        continue;
      }

      if (languages.length === 0 && grammars.length > 0) {
        logger.debug(`language ${languageId} has grammars (${grammars.length}) but no language contribution`, grammars);
      }

      if (languages.length > 0 && grammars.length === 0) {
        logger.debug(`language ${languageId} has languages (${languages.length}) but no grammar contribution`, languages);
      }

      if (languages.length > 1) {
        logger.debug(`language ${languageId} has multiple language contributions (${languages.length})`, languages);
        const firstLines = languages.map(lang => lang.firstLine).filter((firstLine): firstLine is string => !!firstLine);
        if (firstLines.length > 1 && firstLines.slice(1).some(other => other !== firstLines[0])) {
          logger.debug(`language ${languageId} has conflicting firstLines: ${firstLines}`, firstLines);
        }
      }

      if (grammars.length > 1) {
        logger.debug(`language ${languageId} has multiple grammars contributions (${grammars.length})`, grammars);
      }

      const language = mergeLanguageContributions(languageId, languages);

      const languageConfigurations = await this.getLanguageConfigurationFiles(languages);
      const rawGrammars = await this.getGrammarFiles(grammars);

      // Testing shows that some languages have multiple configuration files
      // ['html', 'jade', 'markdown', 'rust']
      if (languageConfigurations.size > 1) {
        logger.debug(`language ${languageId} has multiple language configuration files (${languageConfigurations.size})`, languageConfigurations);
      }

      const languageConfiguration = mergeLanguageConfigurations(languageConfigurations);

      // Testing shows that some languages have multiple grammar files
      // ['cpp', 'php']
      if (rawGrammars.size > 1) {
        logger.debug(`language ${languageId} has multiple grammar files (${rawGrammars.size})`, rawGrammars);
      }

      // since `grammar` and `rawGrammar` should be scoped with `scopeName`, this should create language registrations without conflicts
      for (const [grammar, rawGrammar] of rawGrammars.entries()) {
        if (grammar.scopeName !== rawGrammar.scopeName) {
          logger.debug(`language ${languageId} has scope mismatch in grammar contribution and grammar file: ${grammar.scopeName} !== ${rawGrammar.scopeName}`, grammar, rawGrammar);
        }

        const languageRegistration = buildLanguageRegistration({
          grammar,
          language,
          languageConfiguration,
          rawGrammar,
        });
        results.push(languageRegistration);
      }


      // This will keep the for..of loop going as long as grammars have embedded languages we have not scheduled to build a language registration for
      for (const grammar of grammars) {
        if (!grammar.embeddedLanguages) {
          continue;
        }
        for (const embeddedLanguageId of bridgeEmbeddedLanguages(languageId, grammar.embeddedLanguages)) {
          if (!languageIds.includes(embeddedLanguageId)) {
            languageIds.push(embeddedLanguageId);
          }
        }
      }
    }

    // When all requested language ids are resolved to `LanguageRegistration`
    const scopeNames = results.reduce((scopeNames, registration) => {
      findScopesInRawGrammar(registration, scopeNames);
      return scopeNames;
    }, new Set<string>());
    for (const scopeName of scopeNames) {
      const grammars = this.registry.getScopeContributions(scopeName);
      for (const grammar of grammars) {
        const uri = this.registry.getUri(grammar);
        const rawGrammar = await this.fileReader.readTmLanguage<IRawGrammar>(uri, grammar.path);
        const languageRegistration = buildLanguageRegistration({
          grammar,
          language: {
            id: scopeName,
          },
          languageConfiguration: {},
          rawGrammar,
        });
        results.push(languageRegistration);
      }
    }

    // TODO: do we need to handle these? It seems to work just fine, `vue` has some of these, but does not cause Shiki to throw.
    //       if so we can:
    //         - if its an alias, we can resolve the alias in the `embeddedLangs` properties of languages that depend on it
    //         - if not, remove them from `embeddedLangs`
    //         - or create empty language registrations for these "null" languages
    languageIdsWithoutContributions.forEach(languageId => {
      const resolvedLanguageId = this.registry.resolveAliasToLanguageId(languageId);
      const isAlias = resolvedLanguageId !== languageId;
      logger.debug(`language id without contribution: ${languageId}, ${isAlias ? `but is an alias: ${resolvedLanguageId}` : 'has no alias!'}`);
      const isEmbeddedIn = results.filter(lang => lang.embeddedLangs?.includes(languageId) || lang.embeddedLangsLazy?.includes(languageId));
      if (isEmbeddedIn.length) {
        logger.debug(`  ${languageId} is embedded in the following languages: ${isEmbeddedIn.map(l => l.name).join(', ')}`);
      }
    });

    return results;
  }
}

/**
 * Grab the non-exported type `IRawGrammar`
 */
type IRawRule = IRawGrammar['patterns'][number];

/**
 * Recursively finds the `scopeName` included in a `IRawGrammar`
 */
function findScopesInRawGrammar(rawGrammar: IRawGrammar, scopeNames: Set<string> = new Set<string>()): Set<string> {
  if (rawGrammar.patterns) {
    findScopesInRules(rawGrammar.patterns, scopeNames);
  }
  if (rawGrammar.repository) {
    findScopesInRules(Object.values(rawGrammar.repository), scopeNames);
  }
  return scopeNames;
}

/**
 * Recursively finds the `scopeName` included in a `IRawGrammar[]` iterable
 */
function findScopesInRules(rules: Iterable<IRawRule>, scopeNames: Set<string>): Set<string> {
  for (const rule of rules) {
    findScopesInRule(rule, scopeNames);
  }
  return scopeNames;
}

/**
 * Recursively finds the `scopeName` included in a `IRawRule`
 */
function findScopesInRule(rule: IRawRule, scopeNames: Set<string>) {
  if (rule.include) {
    // eg. 'text.basic.html#tags'
    const [scopeName,] = rule.include.split('#');
    // ignore scopeNames starting with a '$', like '$self'
    if (scopeName && !scopeName.startsWith('$')) {
      scopeNames.add(scopeName);
    }
  }
  if (rule.beginCaptures) {
    findScopesInRules(Object.values(rule.beginCaptures), scopeNames);
  }
  if (rule.captures) {
    findScopesInRules(Object.values(rule.captures), scopeNames);
  }
  if (rule.endCaptures) {
    findScopesInRules(Object.values(rule.endCaptures), scopeNames);
  }
  if (rule.whileCaptures) {
    findScopesInRules(Object.values(rule.whileCaptures), scopeNames);
  }
  if (rule.patterns) {
    findScopesInRules(rule.patterns, scopeNames);
  }
  if (rule.repository) {
    findScopesInRules(Object.values(rule.repository), scopeNames);
  }
}

type BuildLanguageRegistrationParams = {
  language: ExtensionLanguage,
  grammar: ExtensionGrammar,
  languageConfiguration: LanguageConfigurationFull,
  rawGrammar: IRawGrammar,
};

/**
 * Builds a `LanguageRegistrationExtended` from the given:
 * - `language` as a `ExtensionLanguage` contribution
 * - `grammar` as a `ExtensionGrammar` contribution
 * - `languageConfiguration` as the configuration defined in a `language-configuration.json` file
 * - `rawGrammar` as the grammar defined in a `grammar.tmLanguage[.json]` file
 */
function buildLanguageRegistration({ language, grammar, languageConfiguration, rawGrammar }: BuildLanguageRegistrationParams): LanguageRegistrationExtended {
  return {
    ...bridgeLanguageContribution(language),
    ...bridgeGrammarContribution(grammar),
    ...bridgeRawGrammar(rawGrammar),
    ...bridgeFoldingMarkers(languageConfiguration),
  };
}

/**
 * Warn when given `property` of `source`, will meaningfully overwrite `property` in `target.
 */
function warnForPropertyOverwrite<T extends object>(target: T, source: T | undefined, property: keyof T & string) {
  if (source && target[property] && source[property]) {
    if (typeof target[property] !== typeof source[property] || target[property].toString() !== source[property].toString()) {
      logger.warn(`overwriting ${property}: '${target[property]}' with '${source[property]}'`, target[property], source[property]);
    }
  }
}

/**
 * It seems safe to merge language contributions to a single object.
 * Duplicate language contributions usually add `filenames`, `extensions`, `aliases`, `filenamePatterns` and `mimetypes`.
 * If `firstLine` gets overwritten, a warning is logged.
 */
function mergeLanguageContributions(languageId: string, languages: ExtensionLanguage[]): ExtensionLanguage {
  const initialValue: ExtensionLanguage = {
    id: languageId,
    aliases: [],
    firstLine: undefined,
    extensions: [],
    filenamePatterns: [],
    filenames: [],
    mimetypes: [],
  };
  return languages.reduce((result, language) => {
    if (language.aliases) {
      result.aliases!.push(...language.aliases);
    }
    if (language.extensions) {
      result.extensions!.push(...language.extensions);
    }
    if (language.filenamePatterns) {
      result.filenamePatterns!.push(...language.filenamePatterns);
    }
    if (language.filenames) {
      result.filenames!.push(...language.filenames);
    }
    if (language.firstLine) {
      warnForPropertyOverwrite(result, language, 'firstLine');
      result.firstLine = language.firstLine;
    }
    if (language.mimetypes) {
      result.mimetypes!.push(...language.mimetypes);
    }
    return result;
  }, initialValue);
}

/**
 * Merges multiple `language-configuration.json` file contents into a single configuration.
 * Testing shows no conflicting properties are overwritten, overwrites will cause a warning to be logged.
 */
function mergeLanguageConfigurations(languageConfigurations: Map<ExtensionLanguage, LanguageConfiguration>): LanguageConfiguration {
  /**
   * The `initialValue` is an empty `LanguageConfiguration` to make merging less verbose
   */
  const initialValue: LanguageConfiguration = {
    autoClosingPairs: [],
    brackets: [],
    comments: {
      blockComment: undefined,
      lineComment: undefined,
    },
    // we use a type assertion, because VS Code types are convinced these are RegExp instances, but when read from disk, these will be strings or undefined.
    indentationRules: {
      decreaseIndentPattern: undefined,
      increaseIndentPattern: undefined,
      indentNextLinePattern: undefined,
      unIndentedLinePattern: undefined,
    } as unknown as LanguageConfiguration['indentationRules'],
    onEnterRules: [],
    wordPattern: undefined,
  };
  return [...languageConfigurations.values()].reduce((result, configuration) => {
    if (configuration.autoClosingPairs) {
      result.autoClosingPairs!.push(...configuration.autoClosingPairs);
    }
    if (configuration.brackets) {
      result.brackets!.push(...configuration.brackets);
    }
    if (configuration.comments) {
      warnForPropertyOverwrite(result.comments!, configuration.comments, 'blockComment');
      warnForPropertyOverwrite(result.comments!, configuration.comments, 'lineComment');
      Object.assign(result.comments!, configuration.comments);
    }
    if (configuration.indentationRules) {
      warnForPropertyOverwrite(result.indentationRules!, configuration.indentationRules, 'decreaseIndentPattern');
      warnForPropertyOverwrite(result.indentationRules!, configuration.indentationRules, 'increaseIndentPattern');
      warnForPropertyOverwrite(result.indentationRules!, configuration.indentationRules, 'indentNextLinePattern');
      warnForPropertyOverwrite(result.indentationRules!, configuration.indentationRules, 'unIndentedLinePattern');
      Object.assign(result.indentationRules!, configuration.indentationRules);
    }
    if (configuration.onEnterRules) {
      result.onEnterRules!.push(...configuration.onEnterRules);
    }
    if (configuration.wordPattern) {
      warnForPropertyOverwrite(result, configuration, 'wordPattern');
      result.wordPattern = configuration.wordPattern;
    }
    return result;
  }, initialValue);
}

/**
 * Transform a `ExtensionLanguage` into properties of `LanguageRegistration` for use with Shiki highlighter.
 * Also keeps the `LanguageRegistrationMeta` information about when a language could apply to a file/content.
 */
function bridgeLanguageContribution(contribution: ExtensionLanguage): Pick<LanguageRegistration, 'name' | 'displayName' | 'firstLineMatch' | 'aliases'> & LanguageRegistrationMeta {
  const name = contribution.id!;
  // Shiki will throw if a language registration includes its own name as one of its aliases, so we remove it from the list.
  const aliases = contribution.aliases?.filter(alias => alias !== name);
  return {
    name,
    aliases,
    // VS Code uses the first alias, and falls back on the language id
    // see: https://github.com/microsoft/vscode/blob/60706b48bb96fe0fc4c43d7a710db7fb247d4d92/src/vs/editor/common/services/languagesRegistry.ts#L255-L261
    displayName: contribution.aliases?.[0] || name,
    firstLineMatch: contribution.firstLine,
    extensions: contribution.extensions,
    filenamePatterns: contribution.filenamePatterns,
    filenames: contribution.filenames,
    mimetypes: contribution.mimetypes,
  };
}

/**
 * Transform a `ExtensionGrammar` into properties of `LanguageRegistration` for use with Shiki highlighter.
 */
function bridgeGrammarContribution(contribution: ExtensionGrammar): Pick<LanguageRegistration, 'embeddedLangs' | 'embeddedLangsLazy' | 'scopeName' | 'injectTo' | 'balancedBracketSelectors' | 'unbalancedBracketSelectors'> {
  return {
    scopeName: contribution.scopeName,
    embeddedLangs: [],
    embeddedLangsLazy: bridgeEmbeddedLanguages(contribution.language, contribution.embeddedLanguages),
    injectTo: contribution.injectTo,
    // Very unclear what these are exactly and why the names vary, but they seem to be about the same concept
    // see: https://code.visualstudio.com/updates/v1_67#_textmate-grammars-can-mark-tokens-as-unbalanced
    balancedBracketSelectors: contribution.balancedBracketScopes,
    unbalancedBracketSelectors: contribution.unbalancedBracketScopes,
  };
}

/**
 * Transform a `embeddedLanguages` property into a `embeddedLangs` for use with Shiki highlighter.
 */
function bridgeEmbeddedLanguages(languageId?: string, embeddedLanguages?: Record<string, string>): string[] {
  if (!embeddedLanguages) {
    return [];
  }
  const languages = Object.values(embeddedLanguages);
  const unique = new Set(languages);
  // NOTE: some grammars have its language id also set as part of embedded languages
  //       to prevent infinite recursion in shiki, we remove it from its aliases
  if (languageId) {
    unique.delete(languageId);
  }
  return [...unique];
}

/**
 * Transform a `LanguageConfigurationFoldingMarkers` into properties of `LanguageRegistration` for use with Shiki highlighter.
 */
function bridgeFoldingMarkers(configuration: LanguageConfigurationFoldingMarkers): Pick<LanguageRegistration, 'foldingStartMarker' | 'foldingStopMarker'> {
  // these seem to map to https://code.visualstudio.com/api/language-extensions/language-configuration-guide#folding
  // part of the `language-configuration.json` file
  return {
    foldingStartMarker: configuration.folding?.markers?.start,
    foldingStopMarker: configuration.folding?.markers?.end,
  };
}

/**
 * Transform a `IRawGrammar` into properties of `LanguageRegistration` for use with Shiki highlighter.
 */
function bridgeRawGrammar(grammar: IRawGrammar): Pick<LanguageRegistration, 'repository' | 'patterns' | 'injections' | 'injectionSelector' | 'fileTypes'> {
  // NOTE: `scopeName` and `name` are also part of `IRawGrammar`, but we discard those
  //       `scopeName` is also defined in `ExtensionGrammar` which should take precedence
  //       `name` for `IRawGrammar` is **NOT** a language id, but a human readable name
  return {
    repository: grammar.repository,
    patterns: grammar.patterns,
    injections: grammar.injections,
    injectionSelector: grammar.injectionSelector,
    // I have scanned the source code of Shiki and vscode-textmate and neither of them do anything with `fileTypes`, we just pass it on for completions sake.
    // `LanguageRegistrationMeta` is the interface that stores the information that extensions provide about what language should apply to what kind of files/content.
    fileTypes: grammar.fileTypes,
  };
}

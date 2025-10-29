import type { LanguageRegistration } from "shiki";
import type { IRawGrammar } from "shiki/textmate";
import type { LanguageConfiguration } from "vscode";
import type { ExtensionGrammer as ExtensionGrammar, ExtensionLanguage } from "vscode-extension-manifest";

import type { Registry } from "./registry.js";
import type { ExtensionFileReader } from "./vscode-utils.js";
import { logger } from './logger.js';
import { parse } from "jsonc-parser";

/**
 * The {@link LanguageConfiguration} type from vscode is incomplete, so we augment it with our own addition
 */
export type LanguageConfigurationFull = LanguageConfigurationFoldingMarkers & LanguageConfiguration;

/**
 * Seems like `vscode` does not have {@link LanguageConfiguration} updated
 * @see https://code.visualstudio.com/api/language-extensions/language-configuration-guide#folding
 */
export interface LanguageConfigurationFoldingMarkers {
  folding?: {
    markers?: {
      start?: string,
      end?: string,
    }
  };
}

function hasConfiguration(language: ExtensionLanguage): language is ExtensionLanguage & { configuration: string } {
  return !!language.configuration;
}

export class LanguageRegistrationCollectionBuilder {
  constructor(readonly registry: Registry, readonly fileReader: ExtensionFileReader) {}

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

  async getGrammarFiles(grammars: ExtensionGrammar[]): Promise<Map<ExtensionGrammar, IRawGrammar>> {
    const entries = await Promise.all(grammars.map(async grammar => {
      const base = this.registry.getUri(grammar);
      const grammarFile = await this.fileReader.readFile(base, grammar.path);
      // `.tmLanguage` can be an XML file
      if (grammarFile.startsWith("<?xml") || grammarFile.startsWith("<?XML")) {
        return [grammar, { scopeName: grammar.scopeName, patterns: [], repository: {}} as IRawGrammar] as const;
      }
      const json = parse(grammarFile) as IRawGrammar;
      return [grammar, json] as const;
    }));
    return new Map(entries);
  }

  /**
   * This function needs to build the language registrations for the given language ids.
   * It needs to:
   * - find the given language id's
   * - build at least 1 language registration
   *   - merge the language contributions
   *   - language configuration files are part of a language contribution
   *   - for each grammar (grammars are always scoped), build a language registration merge the contributions and the grammar
   * - find any embedded languages, and recursively add those to the result
   */
  static async build(languageIds: string[], registry: Registry, fileReader: ExtensionFileReader): Promise<LanguageRegistration[]> {
    // make a copy of the array, so we don't modify the original
    languageIds = [...languageIds];
    const builder = new LanguageRegistrationCollectionBuilder(registry, fileReader);
    const result: LanguageRegistration[] = [];

    const languageIdsWithoutContributions: string[] = [];

    for (const languageId of languageIds) {
      const aliases = registry.getAliases(languageId);
      const languages = registry.getLanguageContributions(languageId);
      const grammars = registry.getGrammarContributions(languageId);

      // Some basic testing (extensions enabled) show the following languageId's have no language and grammar contributions
      // ['smarty', 'vs_net', 'dosbatch', 'coffee', 'objc', 'perl6', 'scala', 'plaintext', 'sass', 'stylus', 'postcss', 'json5']
      // but the following are aliased
      // 'coffee' => 'coffeescript'
      // 'perl6' => 'raku'
      if (languages.length === 0 && grammars.length === 0) {
        logger.info(`(vscode-shiki-bridge) language ${languageId} has no language or grammar contributions`);
        const aliased = registry.resolveAliasToLanguageId(languageId);
        if (aliased !== languageId) {
          logger.info(`(vscode-shiki-bridge)  but is an alias for ${aliased}`);
        }
        languageIdsWithoutContributions.push(languageId);
        continue;
      }

      if (languages.length === 0 && grammars.length > 0) {
        logger.info(`(vscode-shiki-bridge) language ${languageId} has grammars (${grammars.length}) but no language contribution`, grammars);
      }

      if (languages.length > 0 && grammars.length === 0) {
        logger.info(`(vscode-shiki-bridge) language ${languageId} has languages (${languages.length}) but no grammar contribution`, languages);
      }

      if (languages.length > 1) {
        logger.info(`(vscode-shiki-bridge) language ${languageId} has multiple language contributions (${languages.length})`, languages);
        const firstLines = languages.map(lang => lang.firstLine);
        if (firstLines.length > 1) {
          logger.info(`(vscode-shiki-bridge) language ${languageId} has conflicting firstLines: ${firstLines}`, firstLines);
        }
      }

      if (grammars.length > 1) {
        logger.info(`(vscode-shiki-bridge) language ${languageId} has multiple grammars contributions (${grammars.length})`, grammars);
      }

      // it seems safe to merge the language contributions
      // duplicates mostly add `filenames`, `extensions`, `aliases`, `filenamePatterns` and `mimetypes`
      // duplicate language configurations are merged below
      // only thing that could conflict is the `firstLine` property
      const language = mergeLanguageContributions(languageId, languages);

      const languageConfigurations = await builder.getLanguageConfigurationFiles(languages);
      const rawGrammars = await builder.getGrammarFiles(grammars);

      // Some basic testing (extensions disabled) shows that 0 languages have multiple configuration files
      // More basic testing (extensions enabled) shows that 4 languages have multiple configuration files
      // ['html', 'jade', 'markdown', 'rust']
      if (languageConfigurations.size > 1) {
        logger.info(`(vscode-shiki-bridge) language ${languageId} has multiple language configuration files (${languageConfigurations.size})`, languageConfigurations);
      }

      const languageConfiguration = mergeLanguageConfigurations(languageConfigurations);

      // Some basic testing shows that only 2 languages have multiple grammar files (cpp, php)
      if (rawGrammars.size > 1) {
        logger.info(`(vscode-shiki-bridge) language ${languageId} has multiple grammar files (${rawGrammars.size})`, rawGrammars);
      }

      // since `grammar` and `rawGrammar` should be scoped with `scopeName`, this should create language registrations without conflicts
      for (const [grammar, rawGrammar] of rawGrammars.entries()) {
        if (grammar.scopeName !== rawGrammar.scopeName) {
          logger.info(`(vscode-shiki-bridge) language ${languageId} has scope mismatch in grammar contribution and grammar file: ${grammar.scopeName} !== ${rawGrammar.scopeName}`, grammar, rawGrammar);
        }
        const languageRegistration = buildLanguageRegistration({
          grammar,
          language,
          languageConfiguration,
          rawGrammar,
          aliases,
        });
        result.push(languageRegistration);
      }


      // This will keep the for..of loop going as long as there are more embedded languages that need a LanguageRegistration
      // Some basic testing (extensions disabled) shows 7 embedded languages are added
      // ['smarty', 'vs_net', 'dosbatch', 'coffee', 'objc', 'perl6', 'scala']
      // More basic testing (extensions enabled) shows 12 embedded languages are added
      // ['smarty', 'vs_net', 'dosbatch', 'coffee', 'objc', 'perl6', 'scala', 'plaintext', 'sass', 'stylus', 'postcss', 'json5']
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

    // TODO: we have to handle language ids without contributions:
    //         - remove them from any `embeddedLangs`
    //         - create empty language registrations for them
    //         - the one with aliases, can be changed in any `embeddedLangs`
    //       not resolving this will make shiki throw if highlighting a language where a embeddedLang is not loaded
    languageIdsWithoutContributions.forEach(languageId => {
      const resolvedLanguageId = registry.resolveAliasToLanguageId(languageId);
      const isAlias = resolvedLanguageId === languageId;
      if (isAlias) {} else {}
    });

    return result;
  }
}

type BuildLanguageRegistrationParams = {
  language: ExtensionLanguage,
  grammar: ExtensionGrammar,
  languageConfiguration: LanguageConfigurationFull,
  rawGrammar: IRawGrammar,
  aliases: string[],
};

function buildLanguageRegistration({ language, grammar, languageConfiguration, rawGrammar, aliases }: BuildLanguageRegistrationParams): LanguageRegistration {
  return {
    ...bridgeLanguageContribution(language),
    ...bridgeGrammarContribution(grammar),
    ...bridgeRawGrammar(rawGrammar),
    ...bridgeFoldingMarkers(languageConfiguration),
    aliases,
  };
}

/**
 * Only for internal testing purposes.
 * So far no language configuration founds where an overwrite would change the value, only a few duplicates which change nothing in the end result
 * TODO: don't use this in release
 * @internal
 */
function warnForPropertyOverwrite<T extends object>(target: T, source: T | undefined, property: keyof T & string) {
  if (source && target[property] && source[property]) {
    if (typeof target[property] !== typeof source[property] || target[property].toString() !== source[property].toString()) {
      logger.warn(`(vscode-shiki-bridge) overwriting ${property}: '${target[property]}' with '${source[property]}'`, target[property], source[property]);
    }
  }
}

function mergeLanguageContributions(languageId: string, languages: ExtensionLanguage[]): ExtensionLanguage {
  const initialValue: ExtensionLanguage = {
    id: languageId,
    aliases: [],
    // configurations are already handled, do not merge it into the merged language contribution
    configuration: undefined,
    extensions: [],
    filenamePatterns: [],
    filenames: [],
    firstLine: undefined,
    // icon is a property not relevant for shiki
    icon: undefined,
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
 * Testing shows no conflicting properties are overwritten, overwrites are logged when running the vscode-shiki-bridge-example-extension
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
    indentationRules: {
      // NOTE: VS Code types see this as `RegExp` instance, but the configuration values will be a string
      decreaseIndentPattern: undefined as unknown as RegExp,
      // NOTE: VS Code types see this as `RegExp` instance, but the configuration values will be a string
      increaseIndentPattern: undefined as unknown as RegExp,
      indentNextLinePattern: undefined,
      unIndentedLinePattern: undefined,
    },
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

function bridgeLanguageContribution(contribution: ExtensionLanguage): Pick<LanguageRegistration, 'name' | 'displayName' | 'firstLineMatch' | 'fileTypes'> {
  return {
    name: contribution.id!,
    // Take the first alias that starts with an uppercase ASCII
    // eg. `aliases: ['Python', 'py']`, or `aliases: ['TypeScript', 'ts']`
    // Some testing with the build-in extensions of VS Code shows that this always resolves to the human readable name for the language
    displayName: contribution.aliases?.find(alias => /^[A-Z]/.test(alias)),
    firstLineMatch: contribution.firstLine,
    // Unsure what `fileTypes` are for shiki, they seem to be extensions without the `.` but that is not always the case for all `shiki` grammars
    // We return the extensions instead, and use it to resolve extensions to a language id
    // see: https://github.com/shikijs/textmate-grammars-themes/tree/main
    fileTypes: contribution.extensions,
  };
}

function bridgeGrammarContribution(contribution: ExtensionGrammar): Pick<LanguageRegistration, 'embeddedLangs' | 'embeddedLangsLazy' | 'scopeName' | 'injectTo' | 'balancedBracketSelectors' | 'unbalancedBracketSelectors'> {
  return {
    scopeName: contribution.scopeName,
    embeddedLangs: [],
    embeddedLangsLazy: bridgeEmbeddedLanguages(contribution.language!, contribution.embeddedLanguages),
    injectTo: contribution.injectTo,
    // Very unclearwhat these are exactly and why the names vary, but they seem to be about the same concept
    // see: https://code.visualstudio.com/updates/v1_67#_textmate-grammars-can-mark-tokens-as-unbalanced
    balancedBracketSelectors: contribution.balancedBracketScopes,
    unbalancedBracketSelectors: contribution.unbalancedBracketScopes,
  };
}

function bridgeEmbeddedLanguages(languageId: string, embeddedLanguages?: Record<string, string>): string[] {
  if (!embeddedLanguages) {
    return [];
  }
  const languages = Object.values(embeddedLanguages);
  const unique = new Set(languages);
  // NOTE: some grammars have its language id also set as part of embedded languages (why?)
  //       to prevent infinite recursion in shiki, we remove it from its aliases
  unique.delete(languageId);
  return [...unique];
}


function bridgeFoldingMarkers(configuration: LanguageConfigurationFoldingMarkers): Pick<LanguageRegistration, 'foldingStartMarker' | 'foldingStopMarker'> {
  // these seem to map to https://code.visualstudio.com/api/language-extensions/language-configuration-guide#folding
  // part of the `language-configuration.json` file
  return {
    foldingStartMarker: configuration.folding?.markers?.start,
    foldingStopMarker: configuration.folding?.markers?.end,
  };
}

function bridgeRawGrammar(grammar: IRawGrammar): Pick<LanguageRegistration, 'repository' | 'patterns' | 'injections' | 'injectionSelector'> {
  // NOTE: `scopeName` and `name` are also part of `IRawGrammar`, but we discard those
  //       `name` for `IRawGrammar` is **NOT** a language id, but a human readable name
  return {
    repository: grammar.repository,
    patterns: grammar.patterns,
    injections: grammar.injections,
    injectionSelector: grammar.injectionSelector,
  };
}

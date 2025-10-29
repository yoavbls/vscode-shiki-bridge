import type { LanguageRegistration } from "shiki";
import type { IRawGrammar } from "shiki/textmate";
import type { LanguageConfiguration } from "vscode";
import type { ExtensionGrammer as ExtensionGrammar, ExtensionLanguage } from "vscode-extension-manifest";

export type LanguageConfigurationFull = LanguageConfigurationFoldingMarkers & LanguageConfiguration;

/**
 * Seems like `vscode` does not have {@link LanguageConfiguration} updated
 * @see https://code.visualstudio.com/api/language-extensions/language-configuration-guide#folding
 */
export interface LanguageConfigurationFoldingMarkers {
  folding?: {
    markers: {
      start: string,
      end: string,
    }
  };
}

type BuildLanguageRegistrationParams = {
  language: ExtensionLanguage,
  grammar: ExtensionGrammar,
  languageConfiguration: LanguageConfigurationFull,
  rawGrammar: IRawGrammar,
  aliases: string[],
};

export function buildLanguageRegistration({ language, grammar, languageConfiguration, rawGrammar, aliases }: BuildLanguageRegistrationParams): LanguageRegistration {
  return {
    ...bridgeLanguageContribution(language),
    ...bridgeGrammarContribution(grammar),
    ...bridgeRawGrammar(rawGrammar),
    ...bridgeFoldingMarkers(languageConfiguration),
  };
}

function bridgeEmbeddedLanguages(embeddedLanguages?: Record<string, string>): string[] {
  if (!embeddedLanguages) {
    return [];
  }
  const languages = Object.values(embeddedLanguages);
  const unique = new Set(languages);
  return [...unique];
}

function bridgeLanguageContribution(contribution: ExtensionLanguage): Pick<LanguageRegistration, 'name' | 'displayName' | 'firstLineMatch'> {
  return {
    name: contribution.id!,
    // maybe the uppercase variant of its aliases?
    // eg. `aliases: ['Python', 'py']`, or `aliases: ['TypeScript', 'ts']`
    displayName: undefined,
    firstLineMatch: contribution.firstLine,
  };
}

function bridgeGrammarContribution(contribution: ExtensionGrammar): Pick<LanguageRegistration, 'embeddedLangs' | 'embeddedLangsLazy' | 'scopeName' | 'injectTo' | 'balancedBracketSelectors' | 'unbalancedBracketSelectors'> {
  return {
    scopeName: contribution.scopeName,
    embeddedLangs: [],
    embeddedLangsLazy: bridgeEmbeddedLanguages(contribution.embeddedLanguages),
    injectTo: contribution.injectTo,
    // Very unclearwhat these are exactly and why the names vary, but they seem to be about the same concept
    // see: https://code.visualstudio.com/updates/v1_67#_textmate-grammars-can-mark-tokens-as-unbalanced
    balancedBracketSelectors: contribution.balancedBracketScopes,
    unbalancedBracketSelectors: contribution.unbalancedBracketScopes,
  };
}

function bridgeFoldingMarkers(configuration: LanguageConfigurationFoldingMarkers): Pick<LanguageRegistration, 'foldingStartMarker' | 'foldingStopMarker'> {
  // these seem to map to https://code.visualstudio.com/api/language-extensions/language-configuration-guide#folding
  // part of the `language-configuration.json` file
  return {
    foldingStartMarker: configuration.folding?.markers.start,
    foldingStopMarker: configuration.folding?.markers.end,
  };
}

function bridgeRawGrammar(grammar: IRawGrammar): Pick<LanguageRegistration, 'repository' | 'patterns' |'injections' | 'injectionSelector' | 'fileTypes'> {
  // NOTE: `scopeName` and `name` are also part of `IRawGrammar`, but we discard those
  //       `name` for `IRawGrammar` is **NOT** a language id, but a human readable name
  return {
    repository: grammar.repository,
    patterns: grammar.patterns,
    injections: grammar.injections,
    injectionSelector: grammar.injectionSelector,
    // Unsure what `fileTypes` are for shiki, they seem to be extensions without the `.` but that is not always the case for all grammars
    // In vscode grammars this property is most likely undefined
    // see: https://github.com/shikijs/textmate-grammars-themes/tree/main
    fileTypes: grammar.fileTypes,
  };
}

import type { IRawGrammar } from "shiki/textmate";
import type { LanguageRegistration } from "shiki/types";
import type { ExtensionGrammer as ExtensionGrammar, ExtensionLanguage } from "vscode-extension-manifest";

import { ExtensionFileReader, getVscode } from "./vscode-utils.js";
import { Registry } from "./registry.js";
import { buildLanguageRegistration, type LanguageConfigurationFull } from "./shiki-bridge.js";

/**
 * Collect TextMate grammars contributed by installed VS Code extensions.
 * @param langIds - If provided, only loads grammars for those specific language IDs.
 */
export async function getUserLangs(langIds?: string[]) {
  const vscode = getVscode();
  const registry = Registry.build(vscode.extensions.all);
  const fileReader = new ExtensionFileReader(vscode);

  // if no language ids are given, fall back to all the language ids vscode extensions have registered
  if (!langIds) {
    langIds = registry.getLanguageIds();
  }
  // resolve aliases
  langIds = langIds.map(langId => registry.resolveAliasToLanguageId(langId));

  const languageRegistrations: LanguageRegistration[] = [];

  const loadLanguageConfiguration = async (language: ExtensionLanguage): Promise<LanguageConfigurationFull> => {
    if (!language.configuration) {
      return {};
    }
    const uri = registry.getUri(language);
    return fileReader.readJson(uri, language.configuration);
  };

  const loadGrammar = async (grammar: ExtensionGrammar): Promise<IRawGrammar> => {
    const uri = registry.getUri(grammar);
    return fileReader.readJson(uri, grammar.path);
  };

  for (const languageId of langIds) {
    const languages = registry.getLanguageContributions(languageId);
    const grammars = registry.getGrammarContributions(languageId);

    // for now, assume there is only 1 language and 1 grammar
    if (languages.length !== 1 || grammars.length !== 1) {
      console.warn('extension provided more than 1 language or grammar contribution, not supported yet', languages, grammars);
      continue;
    }

    const language = languages[0]!;
    const grammar = grammars[0]!;
    const languageConfiguration = await loadLanguageConfiguration(language);
    const rawGrammar = await loadGrammar(grammar);
    const aliases = registry.getAliases(languageId);

    const languageRegistration = buildLanguageRegistration({
      language,
      grammar,
      languageConfiguration,
      rawGrammar,
      aliases,
    });

    languageRegistrations.push(languageRegistration);
  }

  return languageRegistrations;
}

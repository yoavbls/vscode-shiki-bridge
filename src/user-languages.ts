import type { LanguageRegistration } from "shiki";
import { LanguageRegistrationCollectionBuilder, type LanguageRegistrationExtended } from "./shiki-bridge-language.js";
import { ExtensionFileReader, getVscode } from "./vscode-utils.js";
import { LanguageRegistry } from "./language-registry.js";

interface UserLangsResult {
  /**
   * The language registrations to pass to Shiki's highlighter.
   */
  langs: LanguageRegistration[],
  /**
   * Get the language registration for the given language id.
   * Will resolve language id if it is an alias.
   *
   * Returns `undefined` if there is no language registration for the given language id.
   *
   * @example
   * ```ts
   * const result = getUserLangs(['tsx']);
   *
   * const resolvedLanguageId = result.get('tsx');
   * //    ^? LanguageRegistration { name: 'typescriptreact', ... }
   * ```
   */
  get(languageId: string): LanguageRegistration | undefined,
  /**
   * A helper function to resolve a possible alias to its language id.
   * The language registrations always use the resolved alias as its `name` property.
   * All its aliases can be found under the `aliases` property.
   *
   * @example
   * ```ts
   * const result = getUserLangs(['tsx']);
   *
   * const resolvedLanguageId = result.resolveAlias('tsx');
   * //    ^? 'typescriptreact'
   * ```
   */
  resolveAlias(languageId: string): string;
  /**
   * A helper function to resolve an `.ext` extension to its language id.
   * @example
   * ```ts
   * const result = getUserLangs(['handlebars']);
   *
   * const resolvedLanguageId = result.resolveExtension('.hbs');
   * //    ^? 'handlebars'
   */
  resolveExtension(extension: string): string;
}

let cache: LanguageRegistry | null = null;
function getLanguageRegistry(vscode: typeof import('vscode')): LanguageRegistry {
  if (!cache) {
    cache = LanguageRegistry.build(vscode.extensions.all);
    const disposable = vscode.extensions.onDidChange(() => {
      cache = null;
      disposable.dispose();
    });
  }
  return cache;
}


/**
 * Collect TextMate grammars contributed by installed VS Code extensions to use with Shiki's highlighter.
 * @param languageIds If provided, only loads grammars for those specific language IDs.
 */
export async function getUserLangs(languageIds?: string[]): Promise<UserLangsResult> {
  const vscode = getVscode();
  const registry = getLanguageRegistry(vscode);
  const fileReader = new ExtensionFileReader(vscode);

  const registeredLanguageIds = registry.getLanguageIds();
  // if no language ids are given, fall back to all the language ids vscode extensions have registered
  if (!languageIds) {
    languageIds = registeredLanguageIds;
  } else {
    languageIds = languageIds.map(langId => registry
      // resolve any aliases
      .resolveAliasToLanguageId(langId))
      // only do work for the languages actually registered by extensions
      .filter(langId => registeredLanguageIds.includes(langId));
  }

  const languages = await LanguageRegistrationCollectionBuilder.build(languageIds, registry, fileReader);

  return {
    langs: languages,
    get(languageId: string): LanguageRegistrationExtended | undefined {
      for (const language of languages) {
        if (language.name === languageId) {
          return language;
        }
        if (language.aliases?.includes(languageId)) {
          return language;
        }
      }
      return;
    },
    resolveAlias(languageId: string): string {
      return this.get(languageId)?.name ?? languageId;
    },
    resolveExtension(extension: string): string {
      for (const language of languages) {
        if (language.extensions?.includes(extension)) {
          return language.name;
        }
      }
      // default to `text` as this will never cause Shiki to throw when highlighting
      return 'text';
    }
  } satisfies UserLangsResult;
}

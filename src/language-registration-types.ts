import type { LanguageConfiguration } from "vscode";
import type { ExtensionLanguage } from "./manifest.js";
import type { LanguageRegistration } from "shiki";

/**
 * The {@link LanguageConfiguration} type from vscode is incomplete, so we augment it with our own addition.
 * @see {@link LanguageConfigurationFoldingMarkers}
 */

export type LanguageConfigurationFull = LanguageConfiguration & LanguageConfigurationFoldingMarkers;

/**
 * Seems like `vscode` does not have a `folding` property in {@link LanguageConfiguration} , so we create the type here.
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

/**
 * To not lose the information about which files a language could apply, we keep the information language contributions provide
 */
export type LanguageRegistrationMeta = Pick<ExtensionLanguage, 'filenames' | 'filenamePatterns' | 'extensions' | 'mimetypes'>;

/**
 * `LanguageRegistrationExtended` contains everything a Shiki `LanguageRegistration` requires.
 *
 * Additionally it preserves the following properties from the vscode extension contributions:
 * - `filenames`
 * - [`filenamePatterns`](https://code.visualstudio.com/docs/editor/glob-patterns)
 * - [`extensions`](https://code.visualstudio.com/docs/languages/overview#_add-a-file-extension-to-a-language)
 * - `mimetypes`
 *
 * @see https://code.visualstudio.com/api/references/contribution-points#contributes.languages
 */
export type LanguageRegistrationExtended = LanguageRegistration & LanguageRegistrationMeta;
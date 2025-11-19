import type { ThemeRegistration, ThemeRegistrationRaw } from "shiki";
import type { ExtensionTheme } from "vscode-extension-manifest";
import type { ThemeRegistry } from "./theme-registry.js";
import { type ExtensionFileReader } from "./vscode-utils.js";
import { logger } from "./logger.js";

type ThemeRegistrationRawWithInclude = ThemeRegistrationRaw & { include?: string };

export async function buildThemeRegistration(contribution: ExtensionTheme, registry: ThemeRegistry, fileReader: ExtensionFileReader, Uri: typeof import('vscode').Uri): Promise<ThemeRegistration> {
    const id = contribution.id ?? contribution.label;

    if (!id) {
        logger.debug(`cannot build a theme registration for a contribution without a label or id`, contribution);
        return {};
    }

    /**
     * Because the `include` property is relative to the file it is in, we need to keep track of the location of the last included grammar.
     */
    const rawTheme = await resolveThemeGrammar(contribution, registry, fileReader, Uri);

    if (typeof rawTheme.tokenColors === 'string') {
        logger.debug(`theme '${id}' has 'tokenColors' set to a relative file path`, contribution, rawTheme);
    }

    const themeRegistration: ThemeRegistration = {
        name: id,
        displayName: contribution.label,
        /**
         * NOTE: note that we use `settings` instead of `tokenColors` when building the final theme registration, as this is what Shiki expects
         */
        settings: rawTheme.tokenColors,
        colors: rawTheme.colors,
        semanticHighlighting: rawTheme.semanticHighlighting,
        semanticTokenColors: rawTheme.semanticTokenColors,
        type: bridgeThemeType(contribution.uiTheme),
    };

    return themeRegistration;
}

type ThemeMergeResult = Pick<ThemeRegistrationRawWithInclude, 'colors' | 'include' | 'semanticHighlighting' | 'semanticTokenColors' | 'type' | 'tokenColors'>;

/**
 * Recursively resolves the `include` property of theme grammars.
 *
 * NOTE: the `tokenColors` can be a string which would make it a relative file path to another TextMate file
 *       this does not seem to be used in any theme, but if it does happen we log it and set it to an empty array as Shiki expects it to be an array
 */
export async function resolveThemeGrammar(contribution: ExtensionTheme, registry: ThemeRegistry, fileReader: ExtensionFileReader, Uri: typeof import('vscode').Uri) {
  const id = contribution.id ?? contribution.label;
  const uri = registry.getUri(contribution);
  let lastUri = Uri.joinPath(uri, contribution.path);
  let rawTheme = await fileReader.readTmLanguage<ThemeRegistrationRawWithInclude>(lastUri);
  let hasInclude = typeof rawTheme.include === 'string';
  while (hasInclude) {
    const directory = Uri.parse(lastUri.path.slice(0, lastUri.path.lastIndexOf('/')));
    const currentUri = Uri.joinPath(directory, rawTheme.include!);
    const include = await fileReader.readTmLanguage<ThemeRegistrationRawWithInclude>(currentUri);
    lastUri = currentUri;
    rawTheme = mergeRawTheme(include, rawTheme) as typeof rawTheme;
    if (typeof rawTheme.tokenColors === 'string') {
      logger.debug(`theme '${id}' with include '${rawTheme.include}' has 'tokenColors' set to a relative file path`, contribution, rawTheme);
      rawTheme.tokenColors = [];
    }
    hasInclude = typeof rawTheme.include === 'string';
  }
  return rawTheme;
}

function mergeRawTheme(include: ThemeRegistrationRawWithInclude, result: ThemeRegistrationRawWithInclude): ThemeMergeResult {
    return {
        type: result.type ?? include.type,
        include: include.include,
        colors: Object.assign({}, include.colors, result.colors),
        semanticHighlighting: result.semanticHighlighting || include.semanticHighlighting,
        semanticTokenColors: Object.assign({}, include.semanticTokenColors, result.semanticTokenColors),
        tokenColors: [...(include.tokenColors ?? []), ...(result.tokenColors ?? [])],
    };
}

/**
 * VS Code `uiTheme` -> Shiki `type` mapping:
 * - `hc-black` -> `dark`
 * - `vs-dark`  -> `dark`
 * - `vs`       -> `light`
 * - `hc-light` -> `light`
 */
function bridgeThemeType(uiTheme: ExtensionTheme['uiTheme']): ThemeRegistration['type'] {
  switch (uiTheme) {
    case "hc-black":
    case "vs-dark": {
      return 'dark';
    }
    case "hc-light":
    case "vs": {
      return 'light';
    }
    default: {
      return "dark";
    }
  }
}

import type { ThemeRegistration, ThemeRegistrationRaw, RawTheme } from "shiki";
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

    const rawTheme = await resolveThemeGrammar(contribution, registry, fileReader, Uri);
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
 *
 * `include` is recursive
 * see: https://github.com/microsoft/vscode/blob/60706b48bb96fe0fc4c43d7a710db7fb247d4d92/src/vs/workbench/services/themes/common/colorThemeData.ts#L723
 *
 * `tokenColors` can be a string pointing to a PList file containing a `RawTheme`
 * see: https://github.com/microsoft/vscode/blob/60706b48bb96fe0fc4c43d7a710db7fb247d4d92/src/vs/workbench/services/themes/common/colorThemeData.ts#L749
 */
async function resolveThemeGrammar(contribution: ExtensionTheme, registry: ThemeRegistry, fileReader: ExtensionFileReader, Uri: typeof import('vscode').Uri) {
  const id = contribution.id ?? contribution.label;
  const uri = registry.getUri(contribution);
  const contributionUri = Uri.joinPath(uri, contribution.path);
  /**
   * Keep track of the directory the resolver is in
   */
  let directory = Uri.parse(dirname(contributionUri.path));
  /**
   * `rawTheme` will contain the final result, `include`s will be merged into it
   */
  let rawTheme = await fileReader.readTmLanguage<ThemeRegistrationRawWithInclude>(contributionUri);
  /**
   * Keep resolving, until the current theme file does not have an include
   */
  let hasInclude = typeof rawTheme.include === 'string';
  while (hasInclude) {
    const includeUri = Uri.joinPath(directory, rawTheme.include!);
    // update the directory, so the next `include` or `tokenColors` will resolve correctly
    directory = Uri.parse(dirname(includeUri.path));
    const include = await fileReader.readTmLanguage<ThemeRegistrationRawWithInclude>(includeUri);
    // if `tokenColors` is a path, resolve it
    if (typeof rawTheme.tokenColors === 'string') {
      logger.debug(`theme '${id}' with include '${rawTheme.include}' has 'tokenColors' set to a relative file path`, contribution, rawTheme);
      const contents = await fileReader.readPlist<RawTheme>(directory, rawTheme.tokenColors);
      rawTheme.tokenColors = contents.settings;
    }
    // merge the results
    rawTheme = mergeRawTheme(include, rawTheme) as typeof rawTheme;
    // check if we have to recurse one more level
    hasInclude = typeof rawTheme.include === 'string';
  }
  return rawTheme;
}

function dirname(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
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

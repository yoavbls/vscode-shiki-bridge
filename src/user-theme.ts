import { parse } from "jsonc-parser";
import { getVscode } from "./vscode-utils.js";
import type { SpecialTheme, ThemeRegistration } from "shiki/types";
import type { ExtensionManifest, ExtensionTheme } from "vscode-extension-manifest";
import { logger } from "./logger.js";

type TokenColor = { name: string, scope: string | string[], settings: { foreground: string, background: string, fontStyle: string } };

/**
 * The interface VSCode uses for its theme files
 * NOTE: the schema can be found at vscode://schemas/color-theme
 * (old) online mirror: https://github.com/wraith13/vscode-schemas/blob/master/en/latest/schemas/color-theme.json
 */
interface VSCodeTheme {
  /**
   * A human readable name
   */
  name?: string;
  /**
   * A relative path to include as part of this theme
   */
  include?: string;
  /**
   * Colors in the workbench
   */
  colors: Record<string, string>;
  /**
   * when `string`: Path to a tmTheme file (relative to the current file).
   *
   * else: Colors for syntax highlighting
   */
  tokenColors: string | TokenColor[];
  /**
   * Whether semantic highlighting should be enabled for this theme.
   */
  semanticHighlighting?: boolean;
  /**
   * Colors for semantic tokens
   */
  semanticTokenColors?: Record<string, string>;
}

interface ResolvedVSCodeTheme extends VSCodeTheme {
  include: undefined;
  tokenColors: TokenColor[];
}

/**
 * Read the currently selected user theme's theme JSON.
 * Returns null when not running inside VS Code, no theme is configured,
 * or the theme file cannot be found/read.
 */
export async function getUserTheme(): Promise<
  [string, ThemeRegistration[]]
> {
  const vscode = getVscode();
  const workbenchConfig = vscode.workspace.getConfiguration("workbench");
  const themeName = workbenchConfig.get<string>("colorTheme");

  if (!themeName) {
    return THEME_NOT_FOUND_RESULT;
  }

  const decoder = new TextDecoder("utf-8");

  for (const extension of vscode.extensions.all) {
    const manifest = extension.packageJSON as ExtensionManifest;
    const contributions = manifest.contributes?.themes;

    if (!contributions) {
      continue;
    }

    const matchedTheme = contributions.find(
      (contribution) =>
        contribution.path &&
        (contribution.id === themeName)
    );

    if (!matchedTheme) {
      continue;
    }

    const loadTheme = async (path: string): Promise<VSCodeTheme> => {
      const themeUri = vscode.Uri.joinPath(
        extension.extensionUri,
        path
      );
      const rawBytes = await vscode.workspace.fs.readFile(themeUri);
      const jsonText = decoder.decode(rawBytes);
      const json = parse(jsonText) as VSCodeTheme;
      // TODO: resolve token colors
      if (typeof json.tokenColors === 'string') {
        logger.warn('tokenColors as a relative tmTheme file is not supported', themeUri.toString(), json.tokenColors);
        json.tokenColors = [];
      }
      return json;
    };

    const resolveTheme = async (path: string): Promise<ResolvedVSCodeTheme> => {
      const base = await loadTheme(path);
      if (base.include) {
        const lastSlash = path.lastIndexOf('/');
        const dirPath = path.slice(0, lastSlash + 1);
        const extend = await resolveTheme(dirPath + base.include);
        const tokenColors = [
            ...(extend.tokenColors ?? []),
            ...(base.tokenColors ?? [])
        ] as TokenColor[];
        return {
          name: base.name,
          include: undefined,
          tokenColors,
          colors: { ...extend.colors, ...base.colors },
          semanticHighlighting: extend.semanticHighlighting || base.semanticHighlighting,
          semanticTokenColors: { ...extend.semanticTokenColors, ...base.semanticTokenColors },
        };
      }
      return base as ResolvedVSCodeTheme;
    };

    // NOTE: the `include` property is not documented but part of the Monarch compiler that compiles these configurations to regexes that vscode uses
    // see: https://github.com/microsoft/vscode/blob/e8405f396717932cbf59b312052179c1fc759cbd/src/vs/editor/standalone/common/monarch/monarchCompile.ts#L478-L489
    // it seems that it just loads the include rules first, internally with some scoping, but we can assume that later additions overwrite earlier ones
    const theme = await resolveTheme(matchedTheme.path);

    const themeRegistration: ThemeRegistration = {
      name: matchedTheme.id!,
      displayName: matchedTheme.label ?? theme.name,
      colors: theme.colors,
      semanticHighlighting: theme.semanticHighlighting,
      semanticTokenColors: theme.semanticTokenColors,
      // NOTE: `settings` is aliased by `tokenColors`, but shiki requires `settings` to be defined
      settings: theme.tokenColors,
      type: getThemeType(matchedTheme.uiTheme),
    };

    return [matchedTheme.id!, [themeRegistration]];
  }

  return THEME_NOT_FOUND_RESULT;
}

const THEME_NOT_FOUND_RESULT: [SpecialTheme, ThemeRegistration[]] = [
  "none",
  [],
];

function getThemeType(uiTheme: ExtensionTheme['uiTheme']): ThemeRegistration['type'] {
  switch (uiTheme) {
    case "hc-black":
    case "vs-dark": {
      return 'light';
    }
    case "hc-light":
    case "vs": {
      return 'dark';
    }
    default: {
      return "dark";
    }
  }
}

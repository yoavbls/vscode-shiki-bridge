
export type ExtensionLanguage = {
  aliases?: string[];
  configuration?: string;
  extensions?: string[];
  filenamePatterns?: string[];
  filenames?: string[];
  firstLine?: string;
  id?: string;
  mimetypes?: string[];
  icon?: {
    dark: string;
    light: string;
  };
};

export type ExtensionGrammar = {
  path: string;
  scopeName: string;
  balancedBracketScopes?: string[];
  injectTo?: string[];
  language?: string;
  unbalancedBracketScopes?: string[];
  embeddedLanguages?: {
    [key: string]: string;
  };
  tokenTypes?: {
    [key: string]: 'comment' | 'other' | 'string';
  };
};

export type ExtensionTheme = {
  path: string;
  uiTheme: 'hc-black' | 'hc-light' | 'vs-dark' | 'vs';
  id?: string;
  label?: string;
};

export type ExtensionContributes = {
  /**
   * Contribute a TextMate grammar to a language. You must provide the language this grammar applies to, the TextMate scopeName for the grammar and the file path.
   *
   * @see {@link https://code.visualstudio.com/api/references/contribution-points#contributes.grammars}
   */
  grammars: ExtensionGrammar[];

  /**
   * Contribute definition of a programming language. This will introduce a new language or enrich the knowledge VS Code has about a language.
   *
   * The main effects of contributes.languages are:
   *
   * - Define a languageId that can be reused in other parts of VS Code API, such as vscode.TextDocument.languageId and the onLanguage Activation Events.
   *    - You can contribute a human-readable using the aliases field. The first item in the list will be used as the human-readable label.
   * - Associate file name extensions (extensions), file names (filenames), file name [glob patterns](https://code.visualstudio.com/docs/editor/glob-patterns) (filenamePatterns), files that begin with a specific line (such as hashbang) (firstLine), and mimetypes to that languageId.
   * - Contribute a set of Declarative Language Features for the contributed language. Learn more about the configurable editing features in the Language Configuration Guide.
   * - Contribute an icon which can be used as in file icon themes if theme does not contain an icon for the language
   *
   * @see {@link https://code.visualstudio.com/api/references/contribution-points#contributes.languages}
   */
  languages?: ExtensionLanguage[];
  /**
   * Contribute a color theme to VS Code, defining workbench colors and styles for syntax tokens in the editor.
   *
   * You must specify a label, whether the theme is a dark theme or a light theme (such that the rest of VS Code changes to match your theme) and the path to the file (JSON format).
   *
   * @see {@link https://code.visualstudio.com/api/references/contribution-points#contributes.themes}
   */
  themes?: ExtensionTheme[];
}

/**
 * Extension Manifest
 *
 * @see {@link https://code.visualstudio.com/api/references/extension-manifest}
 */
export type ExtensionManifest = {
  name: string;
  contributes?: ExtensionContributes;
};

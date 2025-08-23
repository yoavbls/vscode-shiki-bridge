import { parse } from "jsonc-parser";
import { getVscode } from "./getVscode";
import type { IRawGrammar } from "shiki/textmate";
import type { LanguageRegistration } from "shiki/types";

/**
 * Read the currently selected user theme's theme JSON.
 * Returns null when not running inside VS Code, no theme is configured,
 * or the theme file cannot be found/read.
 */
export async function getUserTheme() {
  try {
    const vscode = getVscode();
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const themeName = workbenchConfig.get<string>("colorTheme");

    if (!themeName) {
      return null;
    }

    const decoder = new TextDecoder("utf-8");

    for (const extension of vscode.extensions.all) {
      // `packageJSON` is `any` in VS Code's types; narrow the specific shape we need
      const contributions = (extension.packageJSON?.contributes?.themes ??
        []) as {
        id?: string;
        label?: string;
        path: string;
      }[];

      const matchedTheme = contributions.find(
        (contribution) =>
          contribution.path &&
          (contribution.id === themeName || contribution.label === themeName)
      );

      if (!matchedTheme) {
        continue;
      }

      try {
        const themeUri = vscode.Uri.joinPath(
          extension.extensionUri,
          matchedTheme.path
        );
        const rawBytes = await vscode.workspace.fs.readFile(themeUri);
        const jsonText = decoder.decode(rawBytes);
        const json = parse(jsonText) as Record<string, unknown>;
        return json;
      } catch {
        // If reading this theme fails, try the next extension (if any)
        continue;
      }
    }

    return null;
  } catch {
    // If the VS Code API is unavailable or any unexpected error occurs
    return null;
  }
}

/**
 * Collect TextMate grammars contributed by installed VS Code extensions.
 * - Returns an empty array when not running inside VS Code or on failure.
 * - Only JSON-based grammars are collected ("*.json").
 */
export async function getUserExtensionLanguageGrammars() {
  try {
    const vscode = getVscode();

    const decoder = new TextDecoder("utf-8");
    const results: LanguageRegistration[] = [];

    for (const extension of vscode.extensions.all) {
      const contributes = (extension.packageJSON?.contributes ?? {}) as {
        languages?: { id: string; aliases?: string[] }[];
        grammars?: {
          language?: string;
          scopeName?: string;
          path?: string;
          embeddedLanguages?: Record<string, string>;
        }[];
      };

      if (!contributes.grammars || contributes.grammars.length === 0) {
        continue;
      }

      const languageIdToAliases = new Map<string, string[]>();
      for (const lang of contributes.languages ?? []) {
        if (lang?.id) languageIdToAliases.set(lang.id, lang.aliases ?? []);
      }

      for (const grammar of contributes.grammars) {
        // We only handle JSON grammars to keep this dependency-light
        if (!grammar?.path || !grammar.scopeName) continue;
        if (!/\.json$/i.test(grammar.path)) continue;

        // Prefer grammars that are tied to a language id
        if (!grammar.language) continue;

        try {
          const uri = vscode.Uri.joinPath(extension.extensionUri, grammar.path);
          const raw = await vscode.workspace.fs.readFile(uri);
          const jsonText = decoder.decode(raw);
          const grammarJson = parse(jsonText) as IRawGrammar;

          const embeddedLangs = grammar.embeddedLanguages
            ? Array.from(
                new Set(
                  Object.values(grammar.embeddedLanguages).filter(Boolean)
                )
              )
            : undefined;

          results.push({
            ...grammarJson,
            name: grammar.language,
            embeddedLangs,
            aliases: languageIdToAliases.get(grammar.language) ?? undefined,
          });
        } catch {
          // Skip this grammar if reading/parsing fails
          continue;
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

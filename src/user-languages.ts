import { parse } from "jsonc-parser";
import type { IRawGrammar } from "shiki/textmate";
import type { LanguageRegistration } from "shiki/types";
import { inferBuiltinLanguageIds } from "./user-language-inference";
import { getVscode } from "./vscode-utils";

/**
 * Collect TextMate grammars contributed by installed VS Code extensions.
 * @param langIds - If provided, only loads grammars for those specific language IDs.
 */
export async function getUserLangs(langIds?: string[]) {
  try {
    const vscode = getVscode();

    const decoder = new TextDecoder("utf-8");
    const extensionLangs: LanguageRegistration[] = [];
    const seenScope = new Set<string>();

    // Normalize langIds to lowercase for comparison
    const normalizedLangIds = langIds?.map((id) => id.toLowerCase());

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

      // Build language ID to aliases map
      const languageIdToAliases = new Map<string, string[]>();
      for (const lang of contributes.languages ?? []) {
        if (lang?.id) languageIdToAliases.set(lang.id, lang.aliases ?? []);
      }

      // If langIds specified, check if this extension has any matching grammars
      if (normalizedLangIds) {
        const hasMatchingGrammar = contributes.grammars.some((grammar) => {
          if (!grammar?.language) return false;

          const names = [
            grammar.language,
            ...(languageIdToAliases.get(grammar.language) ?? []),
          ]
            .filter(Boolean)
            .map((name) => name.toLowerCase());

          return normalizedLangIds.some((desiredName) =>
            names.includes(desiredName)
          );
        });

        // Skip this extension entirely if no matching grammars
        if (!hasMatchingGrammar) {
          continue;
        }
      }

      for (const grammar of contributes.grammars) {
        // We only handle JSON grammars to keep this dependency-light
        if (!grammar?.path || !grammar.scopeName) continue;
        if (!/\.json$/i.test(grammar.path)) continue;

        // Prefer grammars that are tied to a language id
        if (!grammar.language) continue;

        // Skip if we've already seen this scope
        if (seenScope.has(grammar.scopeName)) continue;

        // If langIds specified, check if this grammar matches
        if (normalizedLangIds) {
          const names = [
            grammar.language,
            ...(languageIdToAliases.get(grammar.language) ?? []),
          ]
            .filter(Boolean)
            .map((name) => name.toLowerCase());

          const match = normalizedLangIds.find((desiredName) =>
            names.includes(desiredName)
          );
          if (!match) {
            continue;
          }
        }

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

          seenScope.add(grammar.scopeName);
          extensionLangs.push({
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

    // If langIds specified, also include inferred built-in languages
    if (normalizedLangIds) {
      const builtinLangs = inferBuiltinLanguageIds(extensionLangs);
      return [...extensionLangs, ...builtinLangs];
    }

    return extensionLangs;
  } catch {
    return [];
  }
}

import type { LanguageInput, LanguageRegistration } from "shiki/types";
import { getVscode } from "./vscode-utils";
import { parse } from "jsonc-parser";
import type { IRawGrammar } from "shiki/textmate";
import { inferBuiltinLanguageIds } from "./user-language-inference";

/**
 * Collect TextMate grammars contributed by installed VS Code extensions.
 * - Returns an empty array when not running inside VS Code or on failure.
 * - Only JSON-based grammars are collected ("*.json").
 */
async function getUserExtensionLangs() {
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

export async function getSpecificUserLangs(langIds: string[]) {
  const userExtensionLangs = await getUserExtensionLangs();
  const langs: LanguageInput = [];
  const seenScope = new Set<string>();

  for (const grammer of userExtensionLangs) {
    if (!grammer.scopeName || seenScope.has(grammer.scopeName)) {
      continue;
    }
    const names = [grammer.name, ...(grammer.aliases ?? [])]
      .filter(Boolean)
      .map((name) => name.toLowerCase());

    const match = langIds.find((desiredName) => names.includes(desiredName));
    if (!match) {
      continue;
    }
    seenScope.add(grammer.scopeName);
    // Register only the canonical id and grammar to prevent alias loops and cascades
    langs.push(grammer);
  }

  const builtinLangs = inferBuiltinLanguageIds(langs);
  return [...langs, ...builtinLangs];
}

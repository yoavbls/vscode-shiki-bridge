import type { LanguageRegistration } from "shiki/types";

/**
 * This function is vibe coded, I should revisit it in the future.
 * Infer required builtin Shiki language ids from a list of extension grammars.
 *
 * This inspects `embeddedLangs` provided by the collector and scans the grammar
 * `patterns`, `repository`, and `injections` for `include` targets like
 * `source.ts#...`, mapping known scopes to Shiki builtin language ids
 * (e.g., `source.ts` -> `typescript`).
 *
 * Returns a deduped array of builtin language ids in lowercase, excluding
 * any languages that are already present in the given `langs` by name or alias.
 */
export function inferBuiltinLanguageIds(langs: LanguageRegistration[]) {
  const scopeToBuiltinLang: Record<string, string> = {
    "source.ts": "typescript",
    "source.tsx": "tsx",
    "source.js": "javascript",
    "source.jsx": "jsx",
    "source.json": "json",
    "text.html.basic": "html",
    "source.css": "css",
    "source.scss": "scss",
    "source.sass": "sass",
    "source.less": "less",
    "source.graphql": "graphql",
    "source.yaml": "yaml",
    "source.toml": "toml",
    "source.rust": "rust",
    "source.python": "python",
    "source.java": "java",
    "source.go": "go",
    "source.cpp": "cpp",
    "source.c": "c",
    "source.swift": "swift",
    "source.kotlin": "kotlin",
    "source.shell": "bash",
    "source.bash": "bash",
    "source.diff": "diff",
    "text.xml": "xml",
    "text.markdown": "markdown",
  };

  const presentLanguageNames = new Set<string>();
  for (const entry of langs) {
    const candidates = [entry.name, ...(entry.aliases ?? [])]
      .filter(Boolean)
      .map((x) => x.toLowerCase());
    for (const c of candidates) {
      presentLanguageNames.add(c);
    }
  }

  function extractIncludeTargets(grammar: unknown): Set<string> {
    const targets = new Set<string>();
    function visit(node: unknown) {
      if (!node || typeof node !== "object") {
        return;
      }
      const objectNode = node as Record<string, unknown>;
      const include = objectNode.include;
      if (typeof include === "string") {
        targets.add(include);
      }
      const patterns = Array.isArray(objectNode.patterns)
        ? (objectNode.patterns as unknown[])
        : [];
      for (const p of patterns) {
        visit(p);
      }
      const repository = objectNode.repository;
      if (repository && typeof repository === "object") {
        for (const key of Object.keys(repository as Record<string, unknown>)) {
          visit((repository as Record<string, unknown>)[key]);
        }
      }
    }
    visit(grammar);
    const injections = (grammar as Record<string, unknown> | undefined)
      ?.injections as Record<string, unknown> | undefined;
    if (injections && typeof injections === "object") {
      for (const key of Object.keys(injections)) {
        visit(injections[key]);
      }
    }
    return targets;
  }

  const inferred = new Set<string>();
  for (const entry of langs) {
    for (const embedded of entry.embeddedLangs ?? []) {
      if (typeof embedded === "string") {
        inferred.add(embedded.toLowerCase());
      }
    }
    const includeTargets = extractIncludeTargets(entry);
    for (const inc of includeTargets) {
      if (inc.startsWith("#")) {
        continue; // local include
      }
      const scope = inc.split("#", 1)[0];
      const mapped = scopeToBuiltinLang[scope];
      if (mapped) {
        inferred.add(mapped.toLowerCase());
      }
    }
  }

  const result: string[] = [];
  for (const langName of inferred) {
    if (!presentLanguageNames.has(langName)) {
      result.push(langName);
    }
  }
  return result;
}

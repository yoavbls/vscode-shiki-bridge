import * as vscode from "vscode";
import type { TextDocumentContentProvider } from "vscode";
import { getUserLangs, getUserTheme } from "vscode-shiki-bridge";
import { buildThemeRegistration, ExtensionFileReader, LanguageRegistry, ThemeRegistry } from 'vscode-shiki-bridge/internals';

/**
 * Used to serialize Map/Set/Uri values properly
 */
function replacer(key: string, value: unknown) {
  if (value instanceof Map) {
    return [...value.entries()].reduce((record, [key, value]) => {
      if (typeof key === 'object' && key !== null) {
        // detect ExtensionLanguage, ExtensionGrammar or ExtensionTheme contributions as key
        if ((typeof key['id'] === 'string') || typeof key['scopeName'] === 'string' && typeof key['path'] === 'string') {
          if (value instanceof vscode.Uri) {
            const extension = value.path.slice(value.path.lastIndexOf('/') + 1);
            key = extension;
          }
        }
      }
      record[key] = replacer(key, value);
      return record;
    }, {} as Record<string, unknown>);
  } else if (value instanceof Set) {
    return [...value.values()];
  } else if (value instanceof vscode.Uri) {
    return value.toString(true);
  }  else {
    return value;
  }
}

function stringify(value: unknown) {
  return JSON.stringify(value, replacer, 2);
}

function lazy<T>(getter: () => NonNullable<T>) {
  let instance: T | null = null;
  return () => {
    if (!instance) {
      instance = getter();
    }
    return instance;
  };
}

const fileReader = new ExtensionFileReader(vscode);
const getLanguageRegistry = lazy(() => LanguageRegistry.build(vscode.extensions.all));
const getThemeRegistry = lazy(() => ThemeRegistry.build(vscode.extensions.all));

/**
 * Actions available when running Inspect Internals
 */
const actions = {
  'Inspect Language Registration': inspectLanguageRegistration,
  'Inspect Language Registry': inspectLanguageRegistry,
  'Inspect Language Contributions': inspectLanguageContributions,
  'Inspect Grammar Contributions': inspectGrammarContributions,
  'Inspect Scope Contributions': inspectScopeContributions,
  'Inspect Theme Registry': inspectThemeRegistry,
  'Inspect Theme Contribution': inspectThemeContribution,
  'Inspect Theme Registration': inspectThemeRegistration,
  'Inspect User Theme': inspectUserTheme,
} as const;

/**
 * Map actions to text document providers, these are just wrappers to serialize the internal representations of themes/grammars to a readonly JSON editor.
 */
export const textDocumentContentProvider: TextDocumentContentProvider & { scheme: string } = {
  scheme: "vscode-shiki-bridge",
  async provideTextDocumentContent(uri, token) {
    const [type, path] = uri.path.split('/', 2);
    switch (type) {
      case 'inspect-language-registration': {
        return getLanguageRegistrationTextDocumentContent(path);
      }
      case 'inspect-language-registry': {
        return getRegistryTextDocumentContent();
      }
      case 'inspect-language-contributions': {
        return getLanguageContributionsTextDocumentContent(path);
      }
      case 'inspect-grammar-contributions': {
        return getGrammarContributionsTextDocumentContent(path);
      }
      case 'inspect-scope-contributions': {
        return getScopeContributionsTextDocumentContent(path);
      }
      case 'inspect-theme-registry': {
        return getThemeRegistryTextDocumentContent();
      }
      case 'inspect-theme-contributions': {
        return getThemeContributionTextDocumentContent(path);
      }
      case 'inspect-theme-registrations': {
        return getThemeRegistrationTextDocumentContent(path);
      }
      case 'inspect-user-theme': {
        return getUserThemeTextDocumentContent();
      }
      default: {
        return;
      }
    }
  }
};


export async function inspectInternals() {
  const action = await vscode.window.showQuickPick(Object.keys(actions), {
    placeHolder: 'Choose an Action',
    title: 'Inspect Internals',
  }) as keyof typeof actions | undefined;
  if (!action || !(action in actions)) {
    return;
  }
  return actions[action]();
}

async function inspectLanguageRegistration() {
  const result = await getUserLangs();
  const languageId = await vscode.window.showQuickPick(result.langs.map(lang => lang.name), {
    ignoreFocusOut: true,
    placeHolder: 'Choose a Language ID',
    title: "Inspect Language Registration",
  });
  if (!languageId) {
    return;
  }
  const uri = vscode.Uri.from({ path: `inspect-language-registration/${languageId}.json`, scheme: textDocumentContentProvider.scheme });
  await vscode.window.showTextDocument(uri);
}

async function getLanguageRegistrationTextDocumentContent(path: string): Promise<string> {
  const languageId = path.replace('.json', '');
  const result = await getUserLangs();
  const language = result.get(languageId);
  if (!language) {
    return stringify({
      "error": `no language found for ${languageId}`,
    });
  }
  const text = stringify(language);
  return text;
}

async function inspectLanguageRegistry() {
  const uri = vscode.Uri.from({ path: `inspect-language-registry/registry.json`, scheme: textDocumentContentProvider.scheme });
  await vscode.window.showTextDocument(uri);
}

async function getRegistryTextDocumentContent() {
  const registry = getLanguageRegistry();
  const text = stringify(registry);
  return text;
}

async function inspectLanguageContributions() {
  const result = await getUserLangs();
  const languageId = await vscode.window.showQuickPick(result.langs.map(lang => lang.name), {
    ignoreFocusOut: true,
    placeHolder: 'Choose a Language ID',
    title: "Inspect Language Contributions",
  });
  if (!languageId) {
    return;
  }
  const uri = vscode.Uri.from({ path: `inspect-language-contributions/${languageId}.json`, scheme: textDocumentContentProvider.scheme });
  await vscode.window.showTextDocument(uri);
}

async function getLanguageContributionsTextDocumentContent(path: string) {
  const languageId = path.replace('.json', '');
  const registry = getLanguageRegistry();
  const languages = await Promise.all(registry.getLanguageContributions(languageId).map(async language => {
    const copy = {
      ...language,
    };
    if (language.configuration) {
      copy.configuration = await fileReader.readJson(registry.getUri(language), language.configuration);
    }
    return copy;
  }));
  const text = stringify(languages);
  return text;
}

async function inspectGrammarContributions() {
  const result = await getUserLangs();
  const languageId = await vscode.window.showQuickPick(result.langs.map(lang => lang.name), {
    ignoreFocusOut: true,
    placeHolder: 'Choose a Language ID',
    title: "Inspect Grammar Contributions",
  });
  if (!languageId) {
    return;
  }
  const uri = vscode.Uri.from({ path: `inspect-grammar-contributions/${languageId}.json`, scheme: textDocumentContentProvider.scheme });
  await vscode.window.showTextDocument(uri);
}

async function getGrammarContributionsTextDocumentContent(path: string) {
  const languageId = path.replace('.json', '');
  const registry = getLanguageRegistry();
  const grammars = await Promise.all(registry.getGrammarContributions(languageId).map(async grammar => {
    const copy = {
      ...grammar,
    };
    if (grammar.path) {
      copy.path = await fileReader.readJson(registry.getUri(grammar), grammar.path);
    }
    return copy;
  }));
  const text = stringify(grammars);
  return text;
}


async function inspectScopeContributions() {
  const registry = getLanguageRegistry();
  const scopes = [...registry.orphanedScopes.keys()];
  const scope = await vscode.window.showQuickPick(scopes, {
    ignoreFocusOut: true,
    placeHolder: 'Choose a Scope Name',
    title: "Inspect Scope Contributions",
  });
  if (!scope) {
    return;
  }
  const uri = vscode.Uri.from({ path: `inspect-scope-contributions/${scope}.json`, scheme: textDocumentContentProvider.scheme });
  await vscode.window.showTextDocument(uri);
}

async function getScopeContributionsTextDocumentContent(path: string) {
  const scopeName = path.replace(/\.json$/, '');
  const registry = getLanguageRegistry();
  const grammars = await Promise.all(registry.getScopeContributions(scopeName).map(async grammar => {
    const copy = {
      ...grammar,
    };
    if (grammar.path) {
      copy.path = await fileReader.readJson(registry.getUri(grammar), grammar.path);
    }
    return copy;
  }));
  const text = stringify(grammars);
  return text;
}

async function inspectThemeRegistry() {
  const uri = vscode.Uri.from({ path: `inspect-theme-registry/registry.json`, scheme: textDocumentContentProvider.scheme });
  await vscode.window.showTextDocument(uri);
}

async function getThemeRegistryTextDocumentContent() {
  const registry = getThemeRegistry();
  const text = stringify(registry);
  return text;
}

async function inspectThemeContribution() {
  const registry = getThemeRegistry();
  const themes = [...registry.themes.keys()];
  const theme = await vscode.window.showQuickPick(themes, {
    ignoreFocusOut: true,
    placeHolder: 'Choose a Theme',
    title: "Inspect Theme Contributions",
  });
  if (!theme) {
    return;
  }
  const uri = vscode.Uri.from({ path: `inspect-theme-contributions/${theme}.json`, scheme: textDocumentContentProvider.scheme });
  await vscode.window.showTextDocument(uri);
}

async function getThemeContributionTextDocumentContent(path: string) {
  const themeId = path.replace('.json', '');
  const registry = getThemeRegistry();
  const theme = registry.themes.get(themeId)!;
  const copy = {
    ...theme,
  };
  if (copy.path) {
    copy.path = await fileReader.readTmLanguage(registry.getUri(theme), copy.path);
  }
  const text = stringify(copy);
  return text;
}

async function inspectThemeRegistration() {
  const registry = getThemeRegistry();
  const themes = [...registry.labels.entries()];
  const theme = await vscode.window.showQuickPick(themes.map<vscode.QuickPickItem>(([id, labels]) => {
    const label = [...labels][0];
    return {
      label: label ?? id,
      description: label ? id : undefined,
    };
  }), {
    ignoreFocusOut: true,
    placeHolder: 'Choose a Theme',
    title: "Inspect Theme Registration",
  });
  if (!theme) {
    return;
  }
  const uri = vscode.Uri.from({ path: `inspect-theme-registrations/${theme.label}.json`, scheme: textDocumentContentProvider.scheme });
  await vscode.window.showTextDocument(uri);
}

async function getThemeRegistrationTextDocumentContent(path: string) {
  const label = path.replace('.json', '');
  const registry = getThemeRegistry();
  const theme = registry.themes.get(registry.resolveLabelToId(label))!;
  const themeRegistration = await buildThemeRegistration(theme, registry, fileReader, vscode.Uri);
  const text = stringify(themeRegistration);
  return text;
}

async function inspectUserTheme() {
  const uri = vscode.Uri.from({ path: 'inspect-user-theme/theme.json', scheme: textDocumentContentProvider.scheme });
  await vscode.window.showTextDocument(uri);
}

async function getUserThemeTextDocumentContent(): Promise<string> {
  const [themeId, theme] = await getUserTheme();
  const text = stringify({ themeId, theme });
  return text;
}
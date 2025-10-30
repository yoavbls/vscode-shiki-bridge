import * as vscode from "vscode";
import type { TextDocumentContentProvider } from "vscode";
import { getUserLangs as _getUserLangs } from "vscode-shiki-bridge";
import { ExtensionFileReader, LanguageRegistrationCollectionBuilder, Registry } from 'vscode-shiki-bridge/internals';

function replacer(key: string, value: unknown) {
  if (value instanceof Map) {
    return [...value.entries()].reduce((record, [key, value]) => {
      if (typeof key === 'object' && key !== null) {
        // detect ExtensionLanguage or ExtensionGrammar as key
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
    return [...value.entries()];
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
const getUserLangs = lazy(() => _getUserLangs());
const getRegistry = lazy(() => Registry.build(vscode.extensions.all));

const actions = {
  'Inspect Language Registration': inspectLanguageRegistration,
  'Inspect Registry': inspectRegistry,
  'Inspect Language Contributions': inspectLanguageContributions,
  'Inspect Grammar Contributions': inspectGrammarContributions,
  'Inspect Scope Contributions': inspectScopeContributions,
} as const;

export const textDocumentContentProvider: TextDocumentContentProvider & { scheme: string } = {
  scheme: "vscode-shiki-bridge",
  async provideTextDocumentContent(uri, token) {
    const [type, path] = uri.path.split('/', 2);
    switch (type) {
      case 'inspect-language-registration': {
        return getLanguageRegistrationTextDocumentContent(path);
      }
      case 'inspect-registry': {
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
  const languageId = await vscode.window.showQuickPick(result.languages.map(lang => lang.name), {
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

export async function getLanguageRegistrationTextDocumentContent(path: string): Promise<string> {
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

async function inspectRegistry() {
  const uri = vscode.Uri.from({ path: `inspect-registry/registry.json`, scheme: textDocumentContentProvider.scheme });
  await vscode.window.showTextDocument(uri);
}

export async function getRegistryTextDocumentContent() {
  const registry = getRegistry();
  const text = stringify(registry);
  return text;
}

async function inspectLanguageContributions() {
  const result = await getUserLangs();
  const languageId = await vscode.window.showQuickPick(result.languages.map(lang => lang.name), {
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

export async function getLanguageContributionsTextDocumentContent(path: string) {
  const languageId = path.replace('.json', '');
  const registry = getRegistry();
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
  const languageId = await vscode.window.showQuickPick(result.languages.map(lang => lang.name), {
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

export async function getGrammarContributionsTextDocumentContent(path: string) {
  const languageId = path.replace('.json', '');
  const registry = getRegistry();
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
  const registry = getRegistry();
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

export async function getScopeContributionsTextDocumentContent(path: string) {
  const scopeName = path.replace(/\.json$/, '');
  const registry = getRegistry();
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

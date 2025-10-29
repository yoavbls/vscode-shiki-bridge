// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import * as vscode from "vscode";
import { getUserLangs, getUserTheme } from "vscode-shiki-bridge";

let highlighter: ReturnType<typeof createHighlighterCore> | null = null;

async function getHighlighter(): NonNullable<typeof highlighter> {
  if (highlighter === null) {
    highlighter = createHighlighterCore({
      engine: createOnigurumaEngine(import('shiki/wasm')),
    });
  }
  return highlighter;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error) during debugging
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "vscode-shiki-bridge-example-extension" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "vscode-shiki-bridge-example-extension.shikiPreview",
    async () => {
      // Resolve current VS Code theme JSON (may be `THEME_NOT_FOUND_RESULT` if unavailable)
      const [theme, themes] = await getUserTheme();
      const result = await getUserLangs();

      console.log({ theme, themes, result });

      // NOTE: it is recommended to cache this instance and dynammically load themes and languages
      // see: https://shiki.style/guide/bundles#fine-grained-bundle
      const highlighter = await getHighlighter();

      // dynamically load themes that are not loaded yet
      let loadedThemes = highlighter.getLoadedThemes();
      const unloadedThemes = themes.filter(theme => {
        if (!theme.name) {
          return false;
        }
        return !loadedThemes.includes(theme.name);
      });
      if (unloadedThemes.length > 0) {
        console.log(`loading themes: `, unloadedThemes);
        await highlighter.loadTheme(...unloadedThemes);
        loadedThemes = highlighter.getLoadedThemes();
      }
      console.log(`loaded themes: `, loadedThemes);

      // dynamically load languages that are not loaded yet
      let loadedLanguages = highlighter.getLoadedLanguages();
      const unloadedLanguages = result.languages.filter(language => !loadedLanguages.includes(language.name));
      if (unloadedLanguages.length > 0) {
        console.log(`loading languages: `, unloadedLanguages);
        await highlighter.loadLanguage(...unloadedLanguages);
        loadedLanguages = highlighter.getLoadedLanguages();
      }
      console.log(`loaded languages: `, loadedLanguages);

      // read the open workspace (`./examples/` for this extensions launch configuration)
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('no open workspace folders');
        return;
      }

      // read all the `example.*` files
      const entries = await vscode.workspace.fs.readDirectory(workspaceFolder.uri);
      const examples = await Promise.all(entries
        .filter(([name, type]) => name.startsWith('example.') && type === vscode.FileType.File)
        .map(async ([name]) => {
          const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(workspaceFolder.uri, name));
          const contents = new TextDecoder('utf-8').decode(bytes);
          const extension = name.slice(name.lastIndexOf('.'));
          return {
            name,
            lang: result.resolveExtension(extension),
            extension,
            contents,
          };
        }));

      const highlighted = examples.map((example) => {
        try {
          return {
            name: example.name,
            lang: example.lang,
            highlighted: highlighter.codeToHtml(example.contents, {
              lang: example.lang,
              theme,
            })
          };
        } catch (error) {
          // highlighting failed, return the contents as plain text
          // see: https://shiki.style/languages#plain-text
          return {
            name: example.name,
            lang: 'text',
            error,
            highlighted: highlighter.codeToHtml(example.contents, {
              lang: 'text',
              theme,
            }),
          };
        }
      });

      const panel = vscode.window.createWebviewPanel(
        "vscodeShikiBridgeExample",
        "Shiki Preview",
        vscode.ViewColumn.Active,
        { enableScripts: false }
      );

      panel.webview.html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shiki Preview</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        padding: 20px;
        margin: 0;
      }
      h3 {
        margin: 10px 0;
      }
      pre.shiki code {
        padding: 8px;
        display: block;
        border-radius: 8px;
        line-height: 1;
      }
      pre.shiki .line {
        display: block;
      }

      .navigation {
        position: sticky;
        top: 0px;
        padding: 8px;
        background-color: var(--vscode-editor-background);
        box-shadow: rgba(0, 0, 0, 0.24) 0px 3px 8px;
      }

      .navigation ul {
      }

      .navigation li {
        display: inline-flex;
      }

      .navigation a {
        padding: 2px 4px;
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        text-decoration: none;
        margin-bottom: 4px;
        margin-right: 4px;
      }
    </style>
  </head>
  <body>
    <nav class="container navigation">
      <ul>
        ${highlighted.map(({ name }) => `<li><a href="#${name}">${name}</a></li>`).join('\n')}
      </ul>
    </nav>
    ${highlighted.map(entry => {
      return `
    <div class="container" id=${entry.name}>
      <h2><pre class="shiki"><code>${entry.name}</code><pre></h2>
      <p>rendered with language: <pre><code>${entry.lang}</code></pre></p>
      ${entry.error ? `<pre class="shiki"><code>${entry.error}</code></pre>` : ''}
      ${entry.highlighted}
    </div>
    <hr />
`;
    }).join('\n')}
  </body>
</html>`;
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

import type { HighlighterCore } from "shiki";
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

export async function showShikiPreview() {
  const disposables: vscode.Disposable[] = [];

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    cancellable: false,
    title: 'loading preview...'
  }, async (progress) => {
    // Resolve current VS Code theme JSON (may be `THEME_NOT_FOUND_RESULT` if unavailable)
    const [theme, themeRegistration] = await getUserTheme();
    const result = await getUserLangs();

    console.log({ themeRegistration, result });

    // NOTE: it is recommended to cache this instance and dynammically load themes and languages
    // see: https://shiki.style/guide/bundles#fine-grained-bundle
    const highlighter = await getHighlighter();

    // dynamically load themes that are not loaded yet
    let loadedThemes = highlighter.getLoadedThemes();
    if (!loadedThemes.includes(theme)) {
      console.log(`loading theme: `, themeRegistration);
      await highlighter.loadTheme(themeRegistration);
    }

    // dynamically load languages that are not loaded yet
    let loadedLanguages = highlighter.getLoadedLanguages();
    const unloadedLanguages = result.langs.filter(language => !loadedLanguages.includes(language.name));
    if (unloadedLanguages.length > 0) {
      console.log(`loading languages: `, unloadedLanguages);
      await highlighter.loadLanguage(...unloadedLanguages);
      loadedLanguages = highlighter.getLoadedLanguages();
    }

    // Ensure we are in a workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('no open workspace folders');
      return;
    }
    const examples = await fetchExamples(workspaceFolder, result);


    const panel = vscode.window.createWebviewPanel(
      "vscodeShikiBridgeExample",
      "Shiki Preview",
      vscode.ViewColumn.Active,
      { enableScripts: true, enableFindWidget: true },
    );
    panel.webview.html = 'loading preview...';
    await renderPreview(examples, highlighter, theme, panel);

    // TODO: onThemeChange rerender?
    panel.onDidDispose(() => {
      disposables.forEach(disposable => disposable.dispose());
    });
  });
};

type Highlighted = ReturnType<typeof highlightExamples>[number];

async function renderPreview(examples: Example[], highlighter: HighlighterCore, theme: string, panel: vscode.WebviewPanel) {
  const highlighted = highlightExamples(examples, highlighter, theme);
  panel.webview.html = renderPreviewHtml(highlighted);
}

function renderPreviewHtml(highlighted: Highlighted[]) {
  return `<!DOCTYPE html>
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
        h2 pre.shiki code {
          background-color: var(--vscode-textPreformat-background)
        }
        code {
          font-family: var(--vscode-editor-font-family);
        }
        pre.shiki code {
          padding: 16px 12px;
          display: block;
          border-radius: 8px;
          line-height: 1;
          background-color: var(--vscode-editor-background);
          border: solid 2px var(--vscode-textPreformat-background);
          overflow-x: auto;
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
          padding: 0;
          max-height: 90px;
          overflow: auto;
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
        <input type="search" id="filter" placeholder="filter filenames" />
        <ul id="filenames">
          ${highlighted.map(({ name }) => `<li><a href="#${name}">${name}</a></li>`).join('\n')}
        </ul>
      </nav>
      ${highlighted.map(entry => {
        return `
      <div class="container" id=${entry.name}>
        <h2><pre class="shiki"><code>${entry.name}</code></pre></h2>
        <p>
          rendered with language: <code>${entry.lang}</code>.
          ${entry.lang === 'text' ? '<br/>this language probably has no registered grammars to highlight it, check if you have an extension that provides a grammar.' : ''}
        </p>
        ${entry.error ? `<pre class="shiki"><code>${entry.error}</code></pre>` : ''}
        ${entry.highlighted}
      </div>
      <hr />
  `;
      }).join('\n')}
      <script>
        const $filter = document.querySelector('#filter');
        const $$fileNames = Array.from(document.querySelectorAll("#filenames li"));
        if ($filter) {
          ['change', 'blur', 'input'].forEach(eventName => {
            $filter.addEventListener(eventName, (event) => {
              const value = $filter.value;
              const isEmpty = value.trim().length === 0;
              $$fileNames.forEach($fileName => {
                const isMatch = isEmpty || $fileName.textContent.includes(value);
                if (isMatch) {
                  $fileName.style = '';
                } else {
                  $fileName.style = 'display: none;';
                }
              });
            });
          });
        }
      </script>
    </body>
  </html>`;
}

type UserLangsResult = Awaited<ReturnType<typeof getUserLangs>>;

/**
 * read all the `example.*` files in the current workspace
 */
async function fetchExamples(workspaceFolder: vscode.WorkspaceFolder, result: UserLangsResult) {
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
  return examples;
}

type Example = { name: string; lang: string; extension: string; contents: string; };

type Highlight = { name: string, lang: string, highlighted: string, error?: string };

/**
 *
 */
function highlightExamples(examples: Example[], highlighter: HighlighterCore, theme: string): Highlight[] {
  const results: Highlight[] = [];
  for (const example of examples) {
    try {
      results.push({
        name: example.name,
        lang: example.lang,
        highlighted: highlighter.codeToHtml(example.contents, {
          lang: example.lang,
          theme,
        })
      });
    } catch (error) {
      // highlighting failed, return the contents as plain text
      // see: https://shiki.style/languages#plain-text
      results.push({
        name: example.name,
        lang: 'text',
        error: error as any,
        highlighted: highlighter.codeToHtml(example.contents, {
          lang: 'text',
          theme,
        }),
      });
    }
  }
  return results;
}

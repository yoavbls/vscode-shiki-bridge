// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { createHighlighter } from "shiki";
import * as vscode from "vscode";
import { getUserLangs, getUserTheme } from "vscode-shiki-bridge";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
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
      // Resolve current VS Code theme JSON (may be null if unavailable)
      const [theme, themeRegistration] = await getUserTheme();
      const result = await getUserLangs(["html", "javascript", "css"]);

      const highlighter = await createHighlighter({
        themes: [themeRegistration],
        langs: result.langs,
      });

      const htmlSnippet = highlighter.codeToHtml(
        `
    <h1>Mozilla is cool</h1>
    <img src="images/firefox-icon.png" alt="The Firefox logo: a flaming fox surrounding the Earth.">

    <p>At Mozilla, we’re a global community of</p>

    <ul> <!-- changed to list in the tutorial -->
      <li>technologists</li>
      <li>thinkers</li>
      <li>builders</li>
    </ul>

    <p>working together to keep the Internet alive and accessible, so people worldwide can be informed contributors and creators of the Web.
      We believe this act of human collaboration across an open platform is essential to individual growth and our collective future.</p>

    <p>Read the <a href="https://www.mozilla.org/en-US/about/manifesto/">Mozilla Manifesto</a>
      to learn even more about the values and principles that guide the pursuit of our mission.</p>`,
        {
          lang: "html",
          theme,
        }
      );

      const cssSnippet = highlighter.codeToHtml(
        `
    div p {
      margin: 0;
      padding: 1em;
    }

    div p + p {
      padding-top: 0;
    }`,
        {
          lang: "css",
          theme,
        }
      );

      const javascriptSnippet = highlighter.codeToHtml(
        `
function checkEvenOdd(num) {
    if (typeof num !== 'number') {
        return 'Please enter a valid number.';
    }

    return num % 2 === 0 ? \`\${num} is an even number.\` : \`\${num} is an odd number.\`;
}`,
        {
          lang: "javascript",
          theme,
        }
      );

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
    </style>
  </head>
  <body>
      <div class="container">${htmlSnippet}</div>
      <div class="container">${cssSnippet}</div>
      <div class="container">${javascriptSnippet}</div>
  </body>
</html>`;
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

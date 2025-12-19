# vscode-shiki-bridge-example-extension

This is an example extension to showcase the usage of [`vscode-shiki-bridge`](../../).

This example showcases:
- use `getUserLangs` and `getUserTheme` to fetch language and theme configurations
- create a highlighter by passing `themes` and `langs` to the `createHighlighter` function
- highlight a `html`, `css` and `javascript` snippet
- show the results in a webview panel by invoking the `VSCode Shiki bridge: Shiki Preview` command

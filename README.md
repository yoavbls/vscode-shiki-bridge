# `vscode-shiki-bridge`

🌉 Extracts the user's VS Code theme and language grammars for Shiki

## Why?

VS Code doesn't provide a built-in way to render syntax-highlighted code blocks in webviews that match the user's current theme and installed language extensions. This library solves that by extracting the user's VS Code configuration (themes & language grammars) and passing it to Shiki, so you can render code blocks that look exactly like the editor.

## Installation

```bash
npm install vscode-shiki-bridge shiki
```

## Usage

```typescript
import { createHighlighter } from "shiki";
import { getUserTheme, getUserLangs } from "vscode-shiki-bridge";

const [theme, themes] = await getUserTheme();
const langs = await getUserLangs(["graphql"]);
// Create Shiki highlighter with the extracted themes and langs
const highlighter = await createHighlighter({ themes, langs });

// Highlight GraphQL code with the user's theme
const html = highlighter.codeToHtml(
  `type User {
    name: String
    age: Int
}`,
  {
    lang: "graphql",
    theme,
  }
);
```

#### Results

![VS Code Shiki Bridge Example](images/vscode-shiki-bridge.png)

## API

### Themes

#### `UserThemeResult`

A tuple containing a theme id, and an array containing the `ThemeRegistration`.

```ts
export type UserThemeResult = [id: string, themes: [ThemeRegistration]];
```

#### `getUserTheme`

Get a `UserThemeResult` for the currently active theme.

```ts
async function getUserTheme(): Promise<UserThemeResult>;
```

#### `getTheme`

Get a `UserThemeResult` for the given `themeName`. The `themeName` can be its `label` or `id`. VS Code themes will define at least on of these (usually the `label`), `vscode-shiki-bridge` will resolve it to the correct theme.

```ts
async function getTheme(themeName: string): Promise<UserThemeResult>;
```

### Languages

#### `LanguageRegistrationExtended`

The `LanguageRegistration` interface from `shiki` with the following VS Code specific properties preserved:

- `filenames`
- [`filenamePatterns`](https://code.visualstudio.com/docs/editor/glob-patterns)
- [`extensions`](https://code.visualstudio.com/docs/languages/overview#_add-a-file-extension-to-a-language)
- `mimetypes`

#### `getUserLangs`

Collect the `LanguageRegistrationExtended` objects for the languages supported by VS Code extensions. If `languageIds` is provided only those language ids will be collected.

```ts
async function getUserLangs(languageIds?: string[]): Promise<LanguageRegistrationExtended[]>;
```

#### `LanguagesResult`

The same result from `getUserLangs` but with some utility methods to resolve aliases and file extensions.

Also check the [`languages` namespace of the `vscode` api](https://code.visualstudio.com/api/references/vscode-api#languages) for how documents are resolved to its programming language.

```ts
interface LanguagesResult {
  langs: LanguageRegistrationExtended[];
  /**
   * Get the language registration for the given language id.
   * Will resolve language id if it is an alias.
   *
   * Returns `undefined` if there is no language registration for the given language id.
   *
   * @example
   * ```ts
   * const result = getUserLangs(['tsx']);
   *
   * const resolvedLanguageId = result.get('tsx');
   * //    ^? LanguageRegistration { name: 'typescriptreact', ... }
   * ```
   */
  get(languageId: string): LanguageRegistrationExtended | undefined;
  /**
   * A helper function to resolve a possible alias to its language id.
   * The language registrations always use the resolved alias as its `name` property.
   * All its aliases can be found under the `aliases` property.
   *
   * @example
   * ```ts
   * const result = getUserLangs(['tsx']);
   *
   * const resolvedLanguageId = result.resolveAlias('tsx');
   * //    ^? 'typescriptreact'
   * ```
   */
  resolveAlias(languageId: string): string;
  /**
   * A helper function to resolve an `.ext` extension to its language id.
   * @example
   * ```ts
   * const result = getUserLangs(['handlebars']);
   *
   * const resolvedLanguageId = result.resolveExtension('.hbs');
   * //    ^? 'handlebars'
   */
  resolveExtension(extension: string): string;
}
```


### Examples
Check the [`example/`](./example/) directory for complete examples on how to use `vscode-shiki-bridge`.
To test the library, check out the repository and follow the instructions below

## Development and Debug

1. Open the project in VS Code / Cursor
2. install dependencies with `npm i`
3. Press `F5` to start debugging (opens a new VS Code window with the example extension)
4. Run the "Shiki Preview" command from the Command Palette to see your highlighted code blocks
5. Make changes and reload the window to test

## Documentation
See the [`docs/`](./docs/) directory for documentation on how this library bridges the gap from [VS Code Highlighting](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide) to Shikis [Custom Themes](https://shiki.style/guide/load-theme) and [Custom Languages](https://shiki.style/guide/load-lang).

## License

[MIT](./LICENSE)

# `vscode-shiki-bridge` documentation

## VS Code & Shiki
As per the [Shiki](https://shiki.style/guide/) documentation itself:
> Shiki (式, a Japanese word for "Style") is a beautiful and powerful syntax highlighter based on TextMate grammar and themes, the same engine as VS Code's syntax highlighting. Provides very accurate and fast syntax highlighting for almost any mainstream programming language.

VS Code uses [TextMate grammars](https://macromates.com/manual/en/language_grammars) in the the [Oniguruma]() dialect and wraps its engine (written in C) with:
- [`vscode-oniguruma`](https://github.com/microsoft/vscode-oniguruma)
- [`vscode-textmate`](https://github.com/microsoft/vscode-textmate)

Shiki has its own packages to harness this backend to implement the highlighter API Shiki provides:
- [`@shikijs/engine-oniguruma`](https://github.com/shikijs/shiki/tree/main/packages/engine-oniguruma) (wrapper of `vscode-oniguruma`)
- [`@shikijs/vscode-textmate`](https://github.com/shikijs/vscode-textmate) (fork of `vscode-textmate`)

This is what allows for the grammars and themes powering [VS Code syntax highlighting](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide) also to power highlighting with Shiki.

### The gap in between
This means there is a lot of overlap, but in practice there is still a gap to bridge to take the TextMate grammars from VS Code extensions and plug them into the Custom [Theme](https://shiki.style/guide/load-theme) and [Language](https://shiki.style/guide/load-lang) API of Shiki.

#### Shiki

Shiki does use the same grammar files, and even collects and provides a collection of them at the [`textmate-grammars-themes`](https://github.com/shikijs/textmate-grammars-themes) repository:

> Collection of TextMate [grammars](https://github.com/shikijs/textmate-grammars-themes/tree/main/packages/tm-grammars) and [themes](https://github.com/shikijs/textmate-grammars-themes/tree/main/packages/tm-themes), converted to JSON and re-distributed as npm packages. Extracted from Shiki, available for general usage.

But as seen in the the custom [Theme](https://shiki.style/guide/load-theme) and [Language](https://shiki.style/guide/load-lang) API of Shiki, these are provided as singular objects that define the whole theme or grammar.

Themes are straightforward, but languages can use embedded languages to depend on other grammars. Every theme and language bundled in Shiki is defined in a single configuration object.
The caller of the Shiki API is responsible for making sure embedded languages are loaded, which makes loading non-bundled grammars for languages that have embedded languages a bit more complicated.

#### VS Code

VS Code uses the [`languages`](https://code.visualstudio.com/api/references/contribution-points#contributes.languages), [`grammars`](https://code.visualstudio.com/api/references/contribution-points#contributes.grammars)  and [`themes`](https://code.visualstudio.com/api/references/contribution-points#contributes.themes) contribution points in the [extension manifest](https://code.visualstudio.com/api/references/extension-manifest) to allow (built-in) extensions to define or augment grammars and themes.
This dynamic nature allows for new extensions to provide extra functionality on top of what other extensions already provide.

Sometimes an extension keeps it simple with accociating certain filenames or file extensions with a language id, to enable the correct highlighting for those files.

Other extensions will contribute more complex features like defining custom languages, embedded grammars, scope injection and adding new theme colors.

Themes for VS Code also have a few features which introduce complexity. Both features are not documented on the [docs](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#theming), and will be explained [below](#bridging-the-gap).

This is great for a extension/plugin like architecture that VS Code uses, but also introduces where the gap lies between reading the grammar and themes from VS Code and passing them on to Shiki. The grammars and metadata from VS Code extensions are spread out over different extensions and have to resolved into a single interface that can be passed to the Shiki API. This is where `vscode-shiki-bridge` implements a bridge to cross that gap.

### Bridging the gap
Because of the plugable architecture VS Code uses, all extensions need to be checked for their contributions to `languages`, `grammars` and `themes`.
For both grammars and themes a registry is built to allow for resolving the dynamic nature of these contributions.
With this registry `vscode-shiki-bridge` is able to resolve any dependencies and will transform everything needed into the interfaces Shiki expects.
Because Shiki requires the the caller to ensure embedded languages are also registered before using the highlighter, calling `getUserLangs(['<language>'])`, might return more language registrations. Both embedded languages and 'orphaned' scopes that the language requires to be registered will be returned as an unique language registration that can be passed on to Shiki.

#### Grammars
- explain the 'orphaned' scopes part
- explain the reading of `tmLanguage[.json]` files from various formats

#### Themes

A theme contribution can have an `id` and a `label` property, but the typescript types show both as optional, as does the json schema VS Code uses internally.
The example in the docs, the [extension sample](https://github.com/microsoft/vscode-extension-samples/blob/main/theme-sample) and the [yeoman generator](https://github.com/microsoft/vscode-generator-code) only use `label`.
The json schema describes the fields as:
```json
"id": {
    "description": "Id of the color theme as used in the user settings.",
    "type": "string"
},
"label": {
    "description": "Label of the color theme as shown in the UI.",
    "type": "string"
},
```

The menu in VS Code to switch themes uses a `<label> [<id>]` format.
![alt text](assets/image.png)

All of this leads to the conclusion to use the `id` as an unique identifier and use the `label` as a string to show to the user. Since the occasional theme might only have a `label`, it will also be used as the `id`, if the property is missing.
If both are missing the theme contribution will be ignored.

Shiki uses the `name` and `displayName?` properties on its `ThemeRegistration` interface, thus `id` and `label` are mapped respectively to its Shiki counter parts.

VS Code themes are required to define a `uiTheme` property which is an enum of the following values:
- `vs` (light theme)
- `vs-dark` (dark theme)
- `hc-black` (high contrast dark theme)
- `hc-light` (high contrast light theme)

These are mapped to the Shiki property `type` of its `ThemeRegistration` interface like:
| Shiki | VS Code |
| --- | --- |
| `light` | `vs`, `hc-light` |
| `dark` | `vs-dark`, `hc-black` |

A theme configuration file can have an `include` property, which is a relative file path to another theme configuration file. This functions as a crude version of inheritance.
This feature is used in some of the default themes of the built-in [`theme-defaults`](https://github.com/microsoft/vscode/tree/main/extensions/theme-defaults/themes) extension of VS Code. Besides the `theme-defaults` there are several more [built-in extensions](https://github.com/microsoft/vscode/tree/main/extensions) (prefixed with `theme-`) that define one or more themes a user can use.

Another property that can be a relative file path is the `tokenColors` (aliased to the `settings` property in Shiki themes). This can either be the token color definitions, or a string, which would make it a relative file path to another file which defines the `tokenColors`.

> NOTE: this is only described in the `vscode://schemas/color-theme.json` file, but does not seem to be used by any built-in theme.

## API
- explain API decisions

## Architecture
- internals
- inspecting internals
- logger
- simple example
- advanced example
- vscode interfacing

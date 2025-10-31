# `vscode-shiki-bridge` documentation

## VS Code & Shiki
As per the [Shiki](https://shiki.style/guide/) documentation itself:
> Shiki (式, a Japanese word for "Style") is a beautiful and powerful syntax highlighter based on TextMate grammar and themes, the same engine as VS Code's syntax highlighting. Provides very accurate and fast syntax highlighting for almost any mainstream programming language.

VS Code uses [TextMate grammars](https://macromates.com/manual/en/language_grammars) in the the [Oniguruma]() dialect and uses its engine:
- [`vscode-oniguruma`](https://github.com/microsoft/vscode-oniguruma)
- [`vscode-textmate`](https://github.com/microsoft/vscode-textmate)

Shiki has packages (wrapper and a fork) to enable the same backend to power the highlighting Shiki provides:
- [`@shikijs/engine-oniguruma`](https://github.com/shikijs/shiki/tree/main/packages/engine-oniguruma)
- [`@shikijs/vscode-textmate`](https://github.com/shikijs/vscode-textmate)

This is what allows for the grammars and themes powering [VS Code syntax highlighting](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide) also to power highlighting with Shiki.

### The gap in between
This sounds all nice and well, but in practice there is still a gap to bridge to take the TextMate grammars from VS Code extensions and plug them into the Custom [Theme](https://shiki.style/guide/load-theme) and [Language](https://shiki.style/guide/load-lang) API of Shiki.

#### Shiki

Shiki does use the same grammar files, and even collects and provides a collection of them at the [`textmate-grammars-themes`](https://github.com/shikijs/textmate-grammars-themes) repository:

> Collection of TextMate [grammars](https://github.com/shikijs/textmate-grammars-themes/tree/main/packages/tm-grammars) and [themes](https://github.com/shikijs/textmate-grammars-themes/tree/main/packages/tm-themes), converted to JSON and re-distributed as npm packages. Extracted from Shiki, available for general usage.

But as seen in the the custom [Theme](https://shiki.style/guide/load-theme) and [Language](https://shiki.style/guide/load-lang) API of Shiki, these are provided as singular objects that define the whole theme or grammar.

Languages can use embedded languages and scopes to depend on other grammars, but in general every theme and language is defined as a monolithic entity depending on other monolithic entities.

#### VS Code

VS Code uses the [language](), [grammars]()  and [themes]() contribution points in the [extension manifest]() to allow (builtin) extensions to define or augment grammars and themes.
This dynamic nature allows for new extensions to provide extra functionality on top of what other extensions already provide.

This can somethimes be as simple as defining that certain filenames or extensions should be linked to a certain language id, to enable the correct highlighting for those types of files.

Other extensions will contribute more complex features like defining custom languages, embedded languages and adding new theme colors.

This is great for a extension like architecture that VS Code uses, but this is where the gap lies between reading the grammar and themes from VS Code and passing them on to Shiki. The grammars and metadata from VS Code extensions spread out over different extensions as to be bundled back to singular objects that can be passed to the Shiki API. This is where `vscode-shiki-bridge` comes in to bridge that gap.

### Bridging the gap

- explain how `vscode-shiki-bridge` bridges the gap
- explain the discovery phase
- explain the registry
- explain the 'orphaned' scopes part
- explain the API given to the consumer of `vscode-shiki-bridge`
- explain the reading of `tmLanguage[.json]` files from various formats

## Architecture
- internals
- inspecting internals
- logger
- simple example
- advanced example
- vscode interfacing

## API
- explain API decisions

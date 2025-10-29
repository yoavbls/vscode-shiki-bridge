# vscode-shiki-bridge-example-extension README

This is an advanced example extension to showcase the usage of [`vscode-shiki-bridge`](../../).

This example showcases:
- using `shiki/core` to create a highlighter without bundled grammars or themse
- loading the current theme and all registered languages in VS Code
- displaying all the [example files](./examples/) highlighted when running the `VSCode Shiki bridge: Shiki Preview` command

## Languages showcased in [`examples`](./examples/)
> use https://sampleprograms.io/projects/fizz-buzz/ or google for example files
| `isShowcased` | `languageId` | `aliases` | `extensions`
| --- | --- | --- | --- |
| `[x]` | `aspnetcorerazor` | `ASP.NET Razor` | `.cshtml`, `.razor`
| `[x]` | `bat` | `Batch` | `.bat`, `.cmd`
| `[x]` | `bibtex` | `BibTeX` | `.bib`
| `[x]` | `c` | `C` | `.c`, `.i`
| `[x]` | `clojure` | `Clojure` | `.clj`, `.cljs`, `.cljc`, `.cljx`, `.clojure`, `.edn`
| `[x]` | `coffeescript` | `CoffeeScript`, `coffee` | `.coffee`, `.cson`, `.iced`
| `[x]` | `cpp` | `C++`, `Cpp` | `.cpp`, `.cppm`, `.cc`, `.ccm`, `.cxx`, `.cxxm`, `.c++`, `.c++m`, `.hpp`, `.hh`, `.hxx`, `.h++`, `.h`, `.ii`, `.ino`, `.inl`, `.ipp`, `.ixx`, `.tpp`, `.txx`, `.hpp.in`, `.h.in`
| `[x]` | `csharp` | `C#` | `.cs`, `.csx`, `.cake`
| `[x]` | `css` | `CSS` | `.css`
| `[x]` | `csv` | `CSV` | `.csv`
| `[x]` | `cuda-cpp` | `CUDA C++` | `.cu`, `.cuh`
| `[x]` | `dart` | `Dart` | `.dart`
| `[x]` | `diff` | `Diff` | `.diff`, `.patch`, `.rej`
| `[x]` | `dockercompose` | `Compose`, `compose` |
| `[x]` | `dockerfile` | `Docker`, `Dockerfile`, `Containerfile` | `.dockerfile`, `.containerfile`
| `[x]` | `dtd` | `DTD` | `.dtd`, `.ent`, `.mod`
| `[x]` | `editorconfig` | `EditorConfig` | `.editorconfig`
| `[x]` | `fsharp` | `F#`, `FSharp` | `.fs`, `.fsi`, `.fsx`, `.fsscript`
| `[ ]` | `git-commit` | `Git Commit Message` |
| `[ ]` | `git-rebase` | `Git Rebase Message` |
| `[x]` | `gitignore` | `Gitignore` | `.gitignore`
| `[x]` | `go` | `Go` | `.go`
| `[x]` | `groovy` | `Groovy` | `.groovy`, `.gvy`, `.gradle`, `.jenkinsfile`, `.nf`
| `[x]` | `handlebars` | `Handlebars` | `.handlebars`, `.hbs`, `.hjs`, `.hbs`, `.handlebars`
| `[ ]` | `hlsl` | `HLSL` | `.hlsl`, `.hlsli`, `.fx`, `.fxh`, `.vsh`, `.psh`, `.cginc`, `.compute`
| `[x]` | `html` | `HTML`, `htm`, `xhtml` | `.html`, `.htm`, `.shtml`, `.xhtml`, `.xht`, `.mdoc`, `.jsp`, `.asp`, `.aspx`, `.jshtm`, `.volt`, `.ejs`, `.rhtml`
| `[x]` | `ignore` | `Ignore` | `.gitignore_global`, `.gitignore`, `.git-blame-ignore-revs`, `.npmignore`, `.eslintignore`
| `[x]` | `ini` | `Ini` | `.ini`
| `[ ]` | `jade` | `Pug`, `Jade` | `.pug`, `.jade`
| `[x]` | `java` | `Java` | `.java`, `.jav`
| `[x]` | `javascript` | `JavaScript`, `js` | `.js`, `.es6`, `.mjs`, `.cjs`, `.pac`
| `[x]` | `javascriptreact` | `JavaScript JSX`, `JavaScript React`, `jsx` | `.jsx`
| `[x]` | `json` | `JSON` | `.code-profile`, `.json`, `.bowerrc`, `.jscsrc`, `.webmanifest`, `.js.map`, `.css.map`, `.ts.map`, `.har`, `.jslintrc`, `.jsonld`, `.geojson`, `.ipynb`, `.vuerc`, `.tsbuildinfo`
| `[ ]` | `jsonc` | `JSON with Comments` | `.code-workspace`, `language-configuration.json`, `icon-theme.json`, `color-theme.json`, `.jsonc`, `.eslintrc`, `.eslintrc.json`, `.jsfmtrc`, `.jshintrc`, `.swcrc`, `.hintrc`, `.babelrc`, `.toolset.jsonc`
| `[ ]` | `jsonl` | `JSON Lines` | `.jsonl`, `.ndjson`
| `[ ]` | `julia` | `Julia` | `.jl`, `.jl`
| `[ ]` | `latex` | `LaTeX` | `.tex`, `.ltx`, `.ctx`
| `[ ]` | `less` | `Less` | `.less`
| `[ ]` | `lldb.disassembly` | `Disassembly` | `.disasm`
| `[ ]` | `log` | `Log` | `.log`, `*.log.?`
| `[ ]` | `lua` | `Lua` | `.lua`
| `[ ]` | `makefile` | `Makefile` | `.mak`, `.mk`
| `[ ]` | `markdown` | `Markdown` | `.md`, `.mkd`, `.mdwn`, `.mdown`, `.markdown`, `.markdn`, `.mdtxt`, `.mdtext`, `.workbook`
| `[ ]` | `objective-c` | `Objective-C` | `.m`
| `[ ]` | `objective-cpp` | `Objective-C++` | `.mm`
| `[ ]` | `perl` | `Perl` | `.pl`, `.pm`, `.pod`, `.t`, `.PL`, `.psgi`
| `[ ]` | `php` | `PHP` | `.php`, `.php4`, `.php5`, `.phtml`, `.ctp`
| `[ ]` | `pip-requirements` | `pip requirements`, `requirements.txt` |
| `[ ]` | `powershell` | `PowerShell`, `ps`, `ps1`, `pwsh` | `.ps1`, `.psm1`, `.psd1`, `.pssc`, `.psrc`
| `[ ]` | `prompt` | `Prompt` | `.prompt.md`, `copilot-instructions.md`
| `[ ]` | `properties` | `Properties` | `.conf`, `.properties`, `.cfg`, `.directory`, `.gitattributes`, `.gitconfig`, `.gitmodules`, `.editorconfig`, `.repo`, `.npmrc`
| `[ ]` | `python` | `Python`, `py` | `.py`, `.rpy`, `.pyw`, `.cpy`, `.gyp`, `.gypi`, `.pyi`, `.ipy`, `.pyt`
| `[ ]` | `r` | `R` | `.r`, `.rhistory`, `.rprofile`, `.rt`
| `[ ]` | `ra_syntax_tree` |  | `.rast`
| `[ ]` | `raku` | `Raku`, `Perl6`, `perl6` | `.raku`, `.rakumod`, `.rakutest`, `.rakudoc`, `.nqp`, `.p6`, `.pl6`, `.pm6`
| `[ ]` | `razor` | `Razor` | `.cshtml`, `.razor`
| `[ ]` | `restructuredtext` | `reStructuredText` | `.rst`
| `[ ]` | `rnc` | `RelaxNG Compact` | `.rnc`
| `[ ]` | `ruby` | `Ruby`, `rb` | `.rb`, `.rbx`, `.rjs`, `.gemspec`, `.rake`, `.ru`, `.erb`, `.podspec`, `.rbi`
| `[ ]` | `rust` | `Rust`, `rs` | `.rs`, `.rs`
| `[ ]` | `scss` | `SCSS` | `.scss`
| `[ ]` | `search-result` | `Search Result` | `.code-search`
| `[ ]` | `shaderlab` | `ShaderLab` | `.shader`
| `[ ]` | `shellscript` | `Shell Script`, `bash`, `fish`, `sh`, `zsh`, `ksh`, `csh` | `.sh`, `.bash`, `.bashrc`, `.bash_aliases`, `.bash_profile`, `.bash_login`, `.ebuild`, `.eclass`, `.profile`, `.bash_logout`, `.xprofile`, `.xsession`, `.xsessionrc`, `.Xsession`, `.zsh`, `.zshrc`, `.zprofile`, `.zlogin`, `.zlogout`, `.zshenv`, `.zsh-theme`, `.fish`, `.ksh`, `.csh`, `.cshrc`, `.tcshrc`, `.yashrc`, `.yash_profile`
| `[ ]` | `snippets` | `Code Snippets` | `.code-snippets`
| `[ ]` | `sql` | `MS SQL`, `T-SQL` | `.sql`, `.dsql`
| `[ ]` | `swift` | `Swift` | `.swift`
| `[ ]` | `tailwindcss` | `Tailwind CSS` |
| `[ ]` | `tex` | `TeX` | `.sty`, `.cls`, `.bbx`, `.cbx`
| `[ ]` | `tsv` | `TSV` | `.tsv`, `.tab`
| `[x]` | `type` |  | `.type`
| `[x]` | `typescript` | `TypeScript`, `ts` | `.ts`, `.cts`, `.mts`
| `[x]` | `typescriptreact` | `TypeScript JSX`, `TypeScript React`, `tsx` | `.tsx`
| `[ ]` | `vb` | `Visual Basic` | `.vb`, `.brs`, `.vbs`, `.bas`, `.vba`
| `[ ]` | `vitest-snapshot` | `Vitest Snapshot` | `.js.snap`, `.jsx.snap`, `.ts.snap`, `.tsx.snap`
| `[ ]` | `vue` |  | `.vue`, `.vue`
| `[ ]` | `wat` | `WebAssembly Text Format` | `.wat`, `.wasm`
| `[ ]` | `xaml` | `XAML` | `.xaml`
| `[x]` | `xml` | `XML` | `.xml`, `.xsd`, `.ascx`, `.atom`, `.axml`, `.axaml`, `.bpmn`, `.cpt`, `.csl`, `.csproj`, `.csproj.user`, `.dita`, `.ditamap`, `.dtd`, `.ent`, `.mod`, `.dtml`, `.fsproj`, `.fxml`, `.iml`, `.isml`, `.jmx`, `.launch`, `.menu`, `.mxml`, `.nuspec`, `.opml`, `.owl`, `.proj`, `.props`, `.pt`, `.publishsettings`, `.pubxml`, `.pubxml.user`, `.rbxlx`, `.rbxmx`, `.rdf`, `.rng`, `.rss`, `.shproj`, `.slnx`, `.storyboard`, `.svg`, `.targets`, `.tld`, `.tmx`, `.vbproj`, `.vbproj.user`, `.vcxproj`, `.vcxproj.filters`, `.wsdl`, `.wxi`, `.wxl`, `.wxs`, `.xaml`, `.xbl`, `.xib`, `.xlf`, `.xliff`, `.xpdl`, `.xul`, `.xoml`, `.config`, `.csproj`, `.xml`, `.xsd`, `.xsl`, `.plist`, `.mobileconfig`
| `[ ]` | `xquery` | `XQuery` | `.xq`, `.xql`, `.xqm`, `.xqy`, `.xquery`
| `[ ]` | `xsl` | `XSL` | `.xsl`, `.xslt`
| `[ ]` | `yaml` | `YAML` | `.yaml`, `.yml`, `.eyaml`, `.eyml`, `.cff`, `.yaml-tmlanguage`, `.yaml-tmpreferences`, `.yaml-tmtheme`, `.winget`
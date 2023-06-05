# MATLAB language server
MATLAB&reg; language server implements the Microsoft&reg; [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) for the MATLAB language.

## Features Implemented
MATLAB language server implements several Language Server Protocol features and their related services:
* Code diagnostics — [publishDiagnostics](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_publishDiagnostics)
* Quick fixes — [codeActionProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_codeAction)
* Document formatting — [documentFormattingProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_formatting)
* Code completions — [completionProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_completion)
* Function signature help — [signatureHelpProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_signatureHelp)
* Go to definition — [definitionProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_definition)
* Go to references — [referencesProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_references)
* Document symbols — [documentSymbol](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentSymbol)

## Clients
MATLAB language server supports these editors by installing the corresponding extension:
* Visual Studio&reg; Code — [MATLAB extension for Visual Studio Code](https://github.com/mathworks/MATLAB-extension-for-vscode)

## Release Notes

### 1.1.2
Release date: 2023-05-31

Fixed:
* Improves responsiveness of documentSymbol support
* Clear linting diagnostics from closed files
* MATLAB should launch with `onDemand` setting

### 1.1.1
Release date: 2023-05-12

* Resolves linting errors

### 1.1.0
Release date: 2023-05-12

* Add support for documentSymbol (outline).

### 1.0.0
Release date: 2023-04-26

* Initial release.

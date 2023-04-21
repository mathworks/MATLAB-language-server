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

## Clients
MATLAB language server supports these editors by installing the corresponding extension:
* Visual Studio&reg; Code — [MATLAB extension for Visual Studio Code](https://github.com/mathworks/MATLAB-extension-for-vscode)

## Release Notes
### 1.0.0
Release date: 2023-04-25

* Initial release.
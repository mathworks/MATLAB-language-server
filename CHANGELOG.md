# Change Log

All notable changes to the MATLAB language server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.9] - 2026-03-09

### Fixed
- Resolves an issue starting MATLAB when the `HOME` environment variable is set to an invalid folder (Addresses [mathworks/MATLAB-extension-for-vscode#164](https://github.com/mathworks/MATLAB-extension-for-vscode/issues/164))
- Applied patches for CVE-2025-13465, CVE-2025-68157, CVE-2025-68458, CVE-2026-2391, CVE-2026-27606, CVE-2026-27903

## [1.3.8] - 2026-01-09

### Added
- Support for using the pause button to pause in the debugger (Addresses [mathworks/MATLAB-extension-for-vscode#263](https://github.com/mathworks/MATLAB-extension-for-vscode/issues/263))
- Improvements to symbol renaming, symbol highlighting, find references, and go to definitions as a result of advanced MATLAB program file indexing (Addresses [mathworks/MATLAB-extension-for-vscode#94](https://github.com/mathworks/MATLAB-extension-for-vscode/issues/94))

### Fixed
- Changes the default value of `MATLAB.defaultEditor` to `true`
- Resolves issues with the `savepath` function by ensuring that MATLAB language server files are not saved to the MATLAB search path (Addresses [mathworks/MATLAB-extension-for-vscode#299](https://github.com/mathworks/MATLAB-extension-for-vscode/issues/299))
- Resolves potential crashes when breakpoints are set
- Applied patches for CVE-2025-15284, CVE-2025-64718, and CVE-2025-64756

## [1.3.7] - 2025-11-12

### Fixed
- Resolves an issue with the previous version build. Does not include any changes to the language server's code or features.

## [1.3.6] - 2025-10-30

### Fixed
- MATLAB automatically closes after 5 minutes if the connection fails during startup, preventing leaked instances (Addresses [mathworks/MATLAB-extension-for-vscode#241](https://github.com/mathworks/MATLAB-extension-for-vscode/issues/241))
- MATLAB now starts from the primary workspace folder, so that the `pwd` command returns the correct path during startup (Addresses [mathworks/MATLAB-extension-for-vscode#233](https://github.com/mathworks/MATLAB-extension-for-vscode/issues/233))
- Resolves a crash that occurs when suppressing a linting diagnostic on a line with an existing comment (Addresses [mathworks/MATLAB-extension-for-vscode#280](https://github.com/mathworks/MATLAB-extension-for-vscode/issues/280))
- Applied patches for CVE-2025-58751 and CVE-2025-58752

## [1.3.5] - 2025-09-04

### Fixed
- Resolves issue where newly saved document contents are ignored during execution

### Added
- Support for highlighting all references to a selected function, variable, class, or class property

## [1.3.4] - 2025-07-31

### Added
- Support for document range formatting
- Document symbol model now include methods, properties, and enumerations for improved navigation

### Fixed
- Resolves a crash that occurs when language server is used over stdin/stdout
- Resolves issue where language server stops working after calling `restoredefaultpath`
- Applied patches for CVE-2023-44270, CVE-2024-11831, CVE-2025-27789, CVE-2025-30359, CVE-2025-30360, CVE-2025-32996, and CVE-2025-5889

## [1.3.3] - 2025-05-15

### Added
- Support for debugging P-coded files when the corresponding source file is available

### Fixed
- Resolves potential crashes when using code completion in files without a .m file extension

## [1.3.2] - 2025-03-06

### Fixed
- Resolves errors with adding workspace folders to the MATLAB path on macOS and Linux systems

## [1.3.1] - 2025-01-23

### Added
- The language server keeps the MATLAB path in sync with the client workspace, improving code navigation, completions, and execution

### Fixed
- Resolves errors with document formatting when using with MATLAB R2025a
- Resolves errors with execution and debugging when using with MATLAB R2022a

## [1.3.0] - 2024-12-18

### Notice
- The MATLAB language server no longer supports MATLAB R2021a. To make use of the advanced features of the extension or run and debug MATLAB code, you must have MATLAB R2021b or later installed.

### Added
- Debugging support
- Include snippets defined within MATLAB (requires MATLAB R2025a or later)

### Fixed
- Use default values when settings are missing from configuration
- Patches CVE-2024-52798

## [1.2.7] - 2024-11-07

### Added
- Allow specifying the maximum file size for code analysis through the `maxFileSizeForAnalysis` setting
- Linting support in untitled files and in MATLAB files with different file extensions

## [1.2.6] - 2024-09-20

### Fixed
- Patches CVE-2024-43788
- Resolves issue preventing code navigation and variable renaming for variables followed by a matrix operation (e.g. `x.^2`)

## [1.2.5] - 2024-08-16

### Added
- Symbol rename support

### Fixed
- Leading or trailing whitespace in `installPath` setting is ignored when connecting to MATLAB

### 1.2.4 
Release date: 2024-07-12

### Added
- Improvements to code folding (requires MATLAB R2024b or later)

### Fixed
- Allow connection to MATLAB when a single quote appears in the extension installation path
- Resolve error with code navigation when using with MATLAB R2024b

## [1.2.3] - 2024-06-14

### Notice
- The MATLAB language server will no longer support MATLAB R2021a in a future release. To make use of the advanced features of the extension or run MATLAB code, you will need to have MATLAB R2021b or later installed.

### Added
- Added a system to detect if the connected MATLAB release is supported by the language server. This will inform the client, which may display a notification to the user about this.

### Fixed
- Resolved issue with connecting to Intel MATLAB installation on Apple Silicon machines
- Resolved error if MATLAB process is killed unexpectedly
- Fixed bug where "never" startup timing was ignored

## [1.2.2] - 2024-05-17

### Fixed
- Resolved packaging failure on Mac
- Resolved connecting to MATLAB in proxy environment
- General bug fixes

## [1.2.1] - 2024-04-04

### Added
- Supports connecting to MATLAB when the New Desktop for MATLAB is enabled

### Fixed
- Fixed launching App Designer and Simulink through MATLAB code execution

## [1.2.0] - 2024-03-05

### Added
- Code execution support

### Fixed
- Prevent responses from MATLAB being intercepted by the incorrect request callback
- Fixed linting diagnostic suppression with MATLAB R2024a 

## [1.1.8] - 2024-01-16

### Fixed
- Fixed linting with mlint on Windows
- Fixed regression with code navigation when using with MATLAB R2024a

## [1.1.7] - 2023-12-06

### Fixed
- Fixed code navigation when using with MATLAB R2024a
- Handle symbolic link to MATLAB when linting with mlint (Thanks @MoetaYuko!)
- Handle maca64 architecture when linting with mlint (Thanks @tiagovla!)

## [1.1.6] - 2023-10-11

- Add support for MATLAB sections in the documentSymbol (outline).

## [1.1.5] - 2023-09-13

### Fixed
- Fixed issue connecting to MATLAB with Node.js&reg; version 18 and later.

## [1.1.4] - 2023-08-14

### Fixed
- Patched CVE-2023-26136 and CVE-2022-25883

## [1.1.3] - 2023-07-10

### Fixed
- Diagnostic suppression should be placed at correct location when '%' is contained within string
- Improved navigation to files inside MATLAB packages within the VS Code workspace but not on the MATLAB path
- Prevented navigation to private/local functions from other files
- MATLAB sign-in is no longer blocked on Windows

## [1.1.2] - 2023-05-31

### Fixed
- Improves responsiveness of documentSymbol support
- Clear linting diagnostics from closed files
- MATLAB should launch with `onDemand` setting

## [1.1.1] - 2023-05-12

- Resolves linting errors

## [1.1.0] - 2023-05-12

- Add support for documentSymbol (outline).

## [1.0.0] - 2023-04-26

- Initial release.

# ui5‑plugin‑loader

> **A UI5 Tooling extension that auto‑mounts other extensions based on manifest JSON files**

[![npm version](https://badge.fury.io/js/ui5-plugin-loader.svg)](https://badge.fury.io/js/ui5-plugin-loader)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Overview

**ui5‑plugin‑loader** provides a *zero‑configuration* mechanism that automatically discovers and loads UI5 tooling extensions based on manifest JSON files. Simply add one entry to your `ui5.yaml` and all compatible dependencies will be loaded automatically.

## Features

- ✅ **Zero-config setup** - Only requires a single `ui5.yaml` entry
- ✅ **Auto-discovery** - Scans all dependencies for manifest files
- ✅ **Server & Build support** - Works with both `ui5 serve` and `ui5 build`
- ✅ **Fallback manifests** - Includes manifests for popular extensions
- ✅ **Graceful failure** - Invalid manifests won't crash your dev server
- ✅ **Comprehensive logging** - Uses `@ui5/logger` with configurable levels

## Installation

```bash
npm install --save-dev ui5-plugin-loader
```

## Quick Start

### 1. Add to your `ui5.yaml`

```yaml
specVersion: '3.0'
metadata:
  name: my-ui5-app
type: application

server:
  customMiddleware:
    - name: ui5-plugin-loader
      afterMiddleware: compression

builder:
  customTasks:
    - name: ui5-plugin-loader
      afterTask: replaceVersion
```

### 2. Install extensions

Install any supported UI5 tooling extension:

```bash
npm install --save-dev ui5-tooling-modules
npm install --save-dev ui5-middleware-livereload
```

### 3. Run your project

```bash
ui5 serve  # or ui5 build
```

That's it! The plugin loader will automatically:
1. Scan all your dependencies and devDependencies
2. Look for `ui5-plugin-loader.json` manifests in each package
3. Fall back to built-in manifests for popular extensions
4. Auto-register all found middlewares and tasks

## Currently Supported Extensions

The plugin loader includes built-in support for these popular UI5 tooling extensions:

### Middlewares
- **`ui5-tooling-modules`** - Transforms ES modules and Node.js modules for UI5
- **`ui5-middleware-livereload`** - Provides live reload functionality for development

### Tasks  
- **`ui5-tooling-modules`** - Build-time transformation of ES modules and Node.js modules

### Adding More Extensions

To add support for additional extensions, create a manifest file in the `manifests/` directory or contribute to this project by submitting a PR with new manifest files.

## How It Works

The plugin loader follows this discovery process:

1. **Dependency Scanning**: Reads your `package.json` to get all dependencies and devDependencies
2. **Manifest Discovery**: For each dependency `<package-name>`, looks for:
   - `node_modules/<package-name>/ui5-plugin-loader.json` (preferred)
   - `manifests/<package-name>.json` (fallback in this package)
3. **Auto-Registration**: Uses official UI5 tooling APIs to register found middlewares and tasks

## Configuration Options

You can customize the plugin loader behavior in your `ui5.yaml`:

```yaml
server:
  customMiddleware:
    - name: ui5-plugin-loader
      afterMiddleware: compression
      configuration:
        manifestsDir: "custom-manifests"  # Default: "manifests"
        debug: false                      # Enable debug logging

builder:
  customTasks:
    - name: ui5-plugin-loader
      afterTask: replaceVersion
      configuration:
        manifestsDir: "custom-manifests"  # Default: "manifests"
        debug: false                      # Enable debug logging
```

## Extension Development Guide

### Making Your Extension Compatible

To make your UI5 tooling extension work with the plugin loader:

#### 1. Create a Manifest File

Add a `ui5-plugin-loader.json` file to your extension package root:

```json
{
  "$schema": "https://example.com/ui5-plugin-loader.schema.json",
  "middleware": [
    {
      "name": "my-awesome-middleware",
      "afterMiddleware": "compression",
      "configuration": {
        "debug": false,
        "customOption": "value"
      }
    }
  ],
  "tasks": [
    {
      "name": "my-awesome-task", 
      "afterTask": "replaceVersion",
      "configuration": {
        "debug": false,
        "customOption": "value"
      }
    }
  ]
}
```

#### 2. Follow Naming Conventions

The plugin loader maps extension names to package names using these patterns:

- `ui5-tooling-transpile-middleware` → `ui5-tooling-transpile`
- `ui5-tooling-modules-task` → `ui5-tooling-modules`
- `ui5-middleware-livereload` → `ui5-middleware-livereload`

#### 3. File Structure

Ensure your extension follows the expected file structure:

```
my-extension/
├── lib/
│   ├── middleware.js    # For middleware extensions
│   └── task.js         # For task extensions
├── package.json
└── ui5-plugin-loader.json
```

Alternative paths that the loader will try:
- `lib/middleware.js` or `lib/livereload.js`
- `middleware.js` (root level)
- `index.js` (root level)

### Manifest Schema Reference

#### Middleware Configuration

```json
{
  "middleware": [
    {
      "name": "extension-name",           // Required: Extension name
      "afterMiddleware": "compression",   // Optional: Middleware to run after
      "configuration": {                  // Optional: Extension configuration
        "debug": false,
        "customOption": "value"
      }
    }
  ]
}
```

#### Task Configuration

```json
{
  "tasks": [
    {
      "name": "extension-name",          // Required: Extension name
      "afterTask": "replaceVersion",     // Optional: Task to run after  
      "configuration": {                 // Optional: Extension configuration
        "debug": false,
        "customOption": "value"
      }
    }
  ]
}
```

### Testing Your Extension

1. Install your extension in a UI5 project
2. Add `ui5-plugin-loader` to the project
3. Run `ui5 serve --verbose` to see if your extension is discovered
4. Check the logs for any loading errors

## Creating Custom Manifests

If an extension doesn't provide its own manifest, you can create one:

### 1. Create a Custom Manifests Directory

```bash
mkdir custom-manifests
```

### 2. Add Manifest Files

Create `custom-manifests/<package-name>.json`:

```json
{
  "middleware": [
    {
      "name": "some-third-party-middleware",
      "afterMiddleware": "compression",
      "configuration": {
        "debug": false
      }
    }
  ]
}
```

### 3. Configure Plugin Loader

```yaml
server:
  customMiddleware:
    - name: ui5-plugin-loader
      configuration:
        manifestsDir: "custom-manifests"
```

## Logging

The plugin loader uses `@ui5/logger` with the category `ui5-plugin-loader`. Log levels:

- **ERROR**: Critical failures that don't crash the server
- **WARN**: Non-critical issues (missing packages, invalid configs)
- **INFO**: General information about loaded extensions
- **VERBOSE**: Detailed debug information

Example log output:

```
[INFO] ui5-plugin-loader: Starting plugin loader...
[INFO] ui5-plugin-loader: Scanning 15 dependencies for manifests
[INFO] ui5-plugin-loader: Found manifest for ui5-tooling-modules in package
[INFO] ui5-plugin-loader: Loaded middleware: ui5-tooling-modules-middleware
[INFO] ui5-plugin-loader: Plugin loader completed: loaded 1 middleware, 1 tasks (25 ms)
```

## Troubleshooting

### Common Issues

**No extensions are being loaded**
- Ensure your dependencies are installed in `node_modules`
- Check that manifest files exist and are valid JSON
- Enable verbose logging: `ui5 serve --verbose`

**Extension not found**
- Verify the extension package is listed in your `package.json` dependencies
- Check that the package name in the manifest matches the actual package name
- Ensure the extension follows expected file structure

**Build failures**
- The plugin loader gracefully handles errors during builds
- Invalid manifests are logged as errors but don't stop the build process
- Check console output for specific error messages

### Debug Logging

Enable debug logging to troubleshoot issues:

```bash
ui5 serve --verbose
```

Or enable specific debug categories:

```bash
DEBUG=ui5-plugin-loader* ui5 serve
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation as needed
5. Submit a pull request

### Adding Support for New Extensions

To add support for a new extension:

1. Create a manifest file in `manifests/<extension-name>.json`
2. Test the manifest with the extension
3. Submit a PR with the new manifest

## License

MIT © Marian Zeis

## Related Projects

- [UI5 Tooling](https://sap.github.io/ui5-tooling/) - The official UI5 build and development tooling
- [UI5 Community](https://github.com/ui5-community) - Community extensions for UI5 tooling
- [ui5-tooling-modules](https://github.com/ui5-community/ui5-ecosystem-showcase/tree/main/packages/ui5-tooling-modules) - ES modules support for UI5

---

*For more information about UI5 development, visit the [SAP UI5 Documentation](https://ui5.sap.com/).* 
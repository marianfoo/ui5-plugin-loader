# ui5‑plugin‑loader

> **A UI5 Tooling v4 extension that auto‑mounts other extensions based on manifest JSON files**

## Overview

**ui5‑plugin‑loader v0.2.x** provides a *single‑line* integration that automatically discovers and loads UI5 tooling extensions based on manifest JSON files. Simply add one entry to your `ui5.yaml` and all compatible dependencies will be loaded automatically in the correct order.

## Features

- ✅ **Single-line setup** - Only requires one `ui5.yaml` entry
- ✅ **Auto-discovery** - Scans all dependencies for manifest files
- ✅ **Smart ordering** - Fixed pattern ordering: stringreplace → transpile → modules → livereload → rest
- ✅ **Server & Build support** - Works with both `ui5 serve` and `ui5 build`
- ✅ **Fallback manifests** - Includes manifests for popular extensions
- ✅ **Disable/Override support** - Disable extensions or override their configuration
- ✅ **Graceful failure** - Invalid manifests won't crash your dev server
- ✅ **Comprehensive logging** - Uses `@ui5/logger` with configurable levels

## Requirements

- **UI5 Tooling v4.0 or higher** (for dynamic middleware registration)
- **Node.js v18.0.0 or higher**
- **npm v8 or higher**

## Installation

```bash
npm install --save-dev ui5-plugin-loader
```

## Quick Start

### 1. Add to your `ui5.yaml`

```yaml
specVersion: '4.0'
metadata:
  name: my-ui5-app
type: application

server:
  customMiddleware:
    - name: ui5-plugin-loader
      afterMiddleware: compression

builder:
  customTasks:
    - name: ui5-plugin-loader-task
      afterTask: replaceVersion
```

### 2. Install extensions

Install any supported UI5 tooling extension:

```bash
npm install --save-dev ui5-tooling-modules
npm install --save-dev ui5-middleware-livereload
npm install --save-dev ui5-tooling-transpile
npm install --save-dev ui5-tooling-stringreplace
```

### 3. Run your project

```bash
ui5 serve  # or ui5 build
```

That's it! The plugin loader will automatically:
1. Scan all your dependencies and devDependencies
2. Look for `ui5-plugin-loader.json` manifests in each package
3. Fall back to built-in manifests for popular extensions
4. Auto-register all found middlewares and tasks with smart ordering

## Currently Supported Extensions

The plugin loader includes built-in support for these popular UI5 tooling extensions:

### Middlewares
- **`ui5-tooling-stringreplace`** - String replacement for placeholders
- **`ui5-tooling-transpile`** - TypeScript and modern JavaScript transpilation
- **`ui5-tooling-modules`** - ES modules and Node.js modules transformation
- **`ui5-middleware-livereload`** - Live reload functionality for development

### Tasks  
- **`ui5-tooling-stringreplace`** - Build-time string replacement
- **`ui5-tooling-transpile`** - Build-time TypeScript transpilation
- **`ui5-tooling-modules`** - Build-time modules transformation

### Adding More Extensions

To add support for additional extensions, create a manifest file in the `manifests/` directory or contribute to this project by submitting a PR with new manifest files.

## How It Works

The plugin loader follows this discovery and processing pipeline:

1. **Load Configuration**: Validate and normalize the configuration options
2. **Discover Manifests**: Scan dependencies for manifest files  
3. **Apply Disable**: Remove extensions from the disable list
4. **Fill Defaults**: Add default `afterMiddleware: compression` and `afterTask: replaceVersion`
5. **Apply Overrides**: Merge override configurations
6. **Validate References**: Check that all after/before targets exist
7. **Deduplicate**: Remove duplicates (first occurrence wins)
8. **Smart Sort**: Apply fixed pattern ordering: stringreplace → transpile → modules → livereload → rest

## Configuration Options

You can customize the plugin loader behavior in your `ui5.yaml`:

```yaml
server:
  customMiddleware:
    - name: ui5-plugin-loader
      afterMiddleware: compression
      configuration:
        debug: false                            # Enable debug logging
        disable:                               # Disable specific extensions
          - ui5-middleware-livereload
          - ui5-tooling-stringreplace-middleware
        override:                             # Override extension configurations
          ui5-tooling-transpile-middleware:
            afterMiddleware: ui5-tooling-stringreplace-middleware
            configuration:
              debug: true

builder:
  customTasks:
    - name: ui5-plugin-loader-task
      afterTask: replaceVersion
      configuration:
        debug: false                            # Enable debug logging
        disable:                               # Disable specific extensions
          - ui5-tooling-stringreplace-task
        override:                             # Override extension configurations
          ui5-tooling-modules-task:
            afterTask: ui5-tooling-transpile-task
            configuration:
              debug: true
```

### Configuration Properties

- **`debug`** *(boolean, default: false)*: Enable debug logging to `@ui5/logger` verbose
- **`disable`** *(string[], default: [])*: Array of extension names to disable
- **`override`** *(object, default: {})*: Override configurations for specific extensions
  - Each key is an extension name
  - Each value can contain:
    - `afterMiddleware`/`beforeMiddleware` - Change middleware order
    - `afterTask`/`beforeTask` - Change task order  
    - `mountPath` - Override middleware mount path
    - `configuration` - Merge with extension's default configuration

## Example Configurations

### Basic Development Setup
```yaml
server:
  customMiddleware:
    - name: ui5-plugin-loader
      afterMiddleware: compression
```

### TypeScript Development with Customization
```yaml
server:
  customMiddleware:
    - name: ui5-plugin-loader
      afterMiddleware: compression
      configuration:
        debug: true
        disable:
          - ui5-middleware-livereload  # Disable livereload
        override:
          ui5-tooling-stringreplace-middleware:
            configuration:
              files: ["**/*.ts"]       # Only process TypeScript files
```

### Production Build Configuration
```yaml
builder:
  customTasks:
    - name: ui5-plugin-loader-task
      afterTask: replaceVersion
      configuration:
        disable:
          - ui5-tooling-stringreplace-task  # Skip string replacement in production
        override:
          ui5-tooling-modules-task:
            configuration:
              minify: true                  # Enable minification
```

## Smart Ordering

The plugin loader uses a fixed pattern ordering system:

1. **String replacement** (priority 10) - `ui5-tooling-stringreplace-*`
2. **Transpilation** (priority 20) - `ui5-tooling-transpile-*`
3. **Modules** (priority 30) - `ui5-tooling-modules-*`
4. **Live reload** (priority 40) - `ui5-middleware-livereload`
5. **Rest** (priority 50) - All other extensions

This ensures that transformations happen in the correct order without manual configuration.

## Extension Development Guide

### Making Your Extension Compatible

To make your UI5 tooling extension work with the plugin loader:

1. **Create a manifest file** `ui5-plugin-loader.json` in your package root:

```json
{
  "$schema": "https://sap.github.io/ui5-plugin-loader/schema/ui5-plugin-loader.schema.json",
  "middleware": [
    {
      "name": "my-custom-middleware",
      "configuration": {
        "debug": false
      }
    }
  ],
  "tasks": [
    {
      "name": "my-custom-task",
      "configuration": {
        "debug": false
      }
    }
  ]
}
```

2. **Follow naming conventions**:
   - Middleware: `<package-name>-middleware` or `<package-name>`
   - Tasks: `<package-name>-task`

3. **Test with the plugin loader**:
   - Install your extension alongside `ui5-plugin-loader`
   - Verify it gets auto-discovered and registered

## Troubleshooting

### Enable Debug Logging

```yaml
server:
  customMiddleware:
    - name: ui5-plugin-loader
      configuration:
        debug: true
```

### Common Issues

1. **Extension not found**: Ensure the package is in your `dependencies` or `devDependencies`
2. **Wrong order**: Use the `override` configuration to adjust ordering
3. **Duplicate registration**: Check for manual registrations in your `ui5.yaml`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### v0.2.x
- ✅ Removed preset functionality (breaking change)
- ✅ Added `debug`, `disable`, and `override` configuration options
- ✅ Implemented fixed pattern smart ordering
- ✅ Improved pipeline processing with validation
- ✅ Enhanced error handling and logging

### v0.1.x
- ✅ Initial release with basic auto-discovery
- ✅ Support for popular UI5 tooling extensions
- ✅ Preset functionality (deprecated in v0.2.x) 
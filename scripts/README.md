# Scripts Directory

This directory contains utility scripts for the UI5 Plugin Loader project.

## generate-context.js

**Purpose:** Combines all relevant source files into a single `context.md` file for AI analysis.

### What it does

The script reads and combines the following files:
- `lib/middleware.js` - UI5 Tooling v4 middleware implementation
- `lib/task.js` - UI5 Tooling v4 task implementation
- `lib/core.js` - Core utility functions and plugin loading logic
- `manifests/ui5-tooling-modules.json` - Manifest for ui5-tooling-modules extension
- `manifests/ui5-tooling-transpile.json` - Manifest for ui5-tooling-transpile extension
- `manifests/ui5-middleware-livereload.json` - Manifest for ui5-middleware-livereload extension
- `schema/ui5-plugin-loader.schema.json` - JSON schema for manifest validation
- `ui5.yaml` - UI5 tooling extension configuration
- `package.json` - Package configuration and dependencies
- `README.md` - Project documentation and usage guide

### Usage

**Option 1: Using npm script (recommended)**
```bash
npm run generate-context
```

**Option 2: Direct execution**
```bash
node scripts/generate-context.js
```

### Output

The script generates a `context.md` file in the project root with:
- Header with generation info
- Table of contents with links to all files
- Complete content of each file with proper syntax highlighting
- Generation statistics at the end

### Use Cases

This is useful for:
- Providing complete context to AI assistants like ChatGPT
- Creating comprehensive documentation bundles
- Code reviews where all context is needed in one place
- Debugging issues that span multiple files

### Example Output

```
🚀 Starting context.md generation...
📄 Processing: middleware.js
📄 Processing: task.js
📄 Processing: core.js
📄 Processing: ui5-tooling-modules.json
📄 Processing: ui5-tooling-transpile.json
📄 Processing: ui5-middleware-livereload.json
📄 Processing: ui5-plugin-loader.schema.json
📄 Processing: ui5.yaml
📄 Processing: package.json
📄 Processing: README.md
✅ Successfully created context.md
📊 Stats: 10 files successfully processed, 0 errors
📄 File size: 70 KB
```

The generated `context.md` file will be approximately 60KB and contains all the source code and documentation needed for comprehensive analysis. 
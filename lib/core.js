const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// Initialize AJV with schemas
let ajv;
let validateManifestSchema;
let validateLoaderConfigSchema;

try {
    ajv = new Ajv({ allErrors: true, verbose: true });
    
    // Load manifest schema
    const manifestSchemaPath = path.resolve(__dirname, '..', 'schema', 'ui5-plugin-loader.schema.json');
    if (fs.existsSync(manifestSchemaPath)) {
        const manifestSchema = JSON.parse(fs.readFileSync(manifestSchemaPath, 'utf8'));
        validateManifestSchema = ajv.compile(manifestSchema);
    }
    
    // Load loader config schema
    const loaderConfigSchemaPath = path.resolve(__dirname, '..', 'schema', 'loader-config.schema.json');
    if (fs.existsSync(loaderConfigSchemaPath)) {
        const loaderConfigSchema = JSON.parse(fs.readFileSync(loaderConfigSchemaPath, 'utf8'));
        validateLoaderConfigSchema = ajv.compile(loaderConfigSchema);
    }
} catch (error) {
    // Schema validation will be disabled if AJV setup fails
    console.warn('Warning: AJV schema validation disabled:', error.message);
}

module.exports = function (log) {
    
    // ========== PIPELINE FUNCTIONS ==========
    
    /**
     * Step 1: Load and validate configuration
     * @param {Object} config - Raw configuration from UI5 tooling
     * @returns {Object} Validated configuration
     */
    function loadConfig(config = {}) {
        log.debug('Pipeline Step 1: Loading configuration');
        
        // Handle nested UI5 configuration structure
        const src = config.configuration || config;
        
        // Set defaults
        const normalizedConfig = {
            debug: !!src.debug,
            disable: Array.isArray(src.disable) ? src.disable : [],
            override: src.override && typeof src.override === 'object' ? src.override : {}
        };
        
        // Validate configuration using schema
        if (validateLoaderConfigSchema) {
            const isValid = validateLoaderConfigSchema(normalizedConfig);
            if (!isValid && validateLoaderConfigSchema.errors) {
                log.warn('Configuration validation warnings:');
                validateLoaderConfigSchema.errors.forEach(error => {
                    const path = error.instancePath || '';
                    const message = error.message || 'Invalid value';
                    log.warn(`  ${path ? path + ': ' : ''}${message}`);
                });
            }
        }
        
        // Warn about unknown configuration keys
        const knownKeys = ['debug', 'disable', 'override', 'middlewareName', 'configuration'];
        Object.keys(src).forEach(key => {
            if (!knownKeys.includes(key)) {
                log.warn(`Unknown configuration key '${key}' - ignoring`);
            }
        });
        
        log.debug(`Configuration loaded: debug=${normalizedConfig.debug}, disable=${normalizedConfig.disable.length} items, override=${Object.keys(normalizedConfig.override).length} items`);
        return normalizedConfig;
    }
    
    /**
     * Step 2: Discover manifests from node_modules and fallback
     * @param {string} manifestsDir - Path to fallback manifests directory
     * @returns {Array} Array of discovered extensions
     */
    function discoverManifests(manifestsDir) {
        log.debug('Pipeline Step 2: Discovering manifests');
        
        const extensions = [];
        const dependencies = getAllDependencies();
        
        log.debug(`Scanning ${dependencies.length} dependencies for manifests`);
        
        for (const dependency of dependencies) {
            const manifestInfo = findManifestForDependency(dependency, manifestsDir);
            
            if (!manifestInfo) {
                log.verbose(`No manifest found for ${dependency}`);
                continue;
            }
            
            const { manifest, source } = manifestInfo;
            log.verbose(`Processing manifest for ${dependency} (source: ${source})`);
            
            // Add middleware extensions
            if (manifest.middleware && Array.isArray(manifest.middleware)) {
                manifest.middleware.forEach(mw => {
                    extensions.push({
                        ...mw,
                        type: 'middleware',
                        dependency,
                        source
                    });
                });
            }
            
            // Add task extensions
            if (manifest.tasks && Array.isArray(manifest.tasks)) {
                manifest.tasks.forEach(task => {
                    extensions.push({
                        ...task,
                        type: 'task',
                        dependency,
                        source
                    });
                });
            }
        }
        
        log.debug(`Discovered ${extensions.length} extensions from ${dependencies.length} dependencies`);
        return extensions;
    }
    
    /**
     * Step 3: Apply disable list
     * @param {Array} extensions - Array of extension configurations
     * @param {Array} disableList - Array of extension names to disable
     * @returns {Array} Filtered array of extensions
     */
    function applyDisable(extensions, disableList) {
        log.debug('Pipeline Step 3: Applying disable list');
        
        if (!disableList || disableList.length === 0) {
            log.debug('No extensions to disable');
            return extensions;
        }
        
        const filtered = extensions.filter(ext => {
            const shouldDisable = disableList.includes(ext.name);
            if (shouldDisable) {
                log.info(`Disabled extension: ${ext.name}`);
            }
            return !shouldDisable;
        });
        
        log.debug(`Disabled ${extensions.length - filtered.length} extensions`);
        return filtered;
    }
    
    /**
     * Step 4: Fill in default order values
     * @param {Array} extensions - Array of extension configurations
     * @returns {Array} Extensions with default order values
     */
    function fillDefaults(extensions) {
        log.debug('Pipeline Step 4: Filling default order values');
        
        return extensions.map(ext => {
            const updated = { ...ext };
            
            // Fill default afterMiddleware/afterTask if missing
            if (ext.type === 'middleware' && !ext.afterMiddleware && !ext.beforeMiddleware) {
                updated.afterMiddleware = 'compression';
                log.debug(`Added default afterMiddleware 'compression' for ${ext.name}`);
            }
            
            if (ext.type === 'task' && !ext.afterTask && !ext.beforeTask) {
                updated.afterTask = 'replaceVersion';
                log.debug(`Added default afterTask 'replaceVersion' for ${ext.name}`);
            }
            
            return updated;
        });
    }
    
    /**
     * Step 5: Apply override configurations
     * @param {Array} extensions - Array of extension configurations
     * @param {Object} overrideMap - Map of extension names to override configs
     * @returns {Array} Extensions with overrides applied
     */
    function applyOverride(extensions, overrideMap) {
        log.debug('Pipeline Step 5: Applying override configurations');
        
        if (!overrideMap || Object.keys(overrideMap).length === 0) {
            log.debug('No overrides to apply');
            return extensions;
        }
        
        return extensions.map(ext => {
            const override = overrideMap[ext.name];
            if (!override) {
                return ext;
            }
            
            log.info(`Applying override for ${ext.name}`);
            
            // Shallow merge override properties
            const updated = { ...ext };
            
            // Override order properties
            if (override.afterMiddleware !== undefined) {
                updated.afterMiddleware = override.afterMiddleware;
                delete updated.beforeMiddleware; // Clear conflicting property
            }
            if (override.beforeMiddleware !== undefined) {
                updated.beforeMiddleware = override.beforeMiddleware;
                delete updated.afterMiddleware; // Clear conflicting property
            }
            if (override.afterTask !== undefined) {
                updated.afterTask = override.afterTask;
                delete updated.beforeTask; // Clear conflicting property
            }
            if (override.beforeTask !== undefined) {
                updated.beforeTask = override.beforeTask;
                delete updated.afterTask; // Clear conflicting property
            }
            if (override.mountPath !== undefined) {
                updated.mountPath = override.mountPath;
            }
            
            // Merge configuration objects
            if (override.configuration) {
                updated.configuration = {
                    ...updated.configuration,
                    ...override.configuration
                };
            }
            
            return updated;
        });
    }
    
    /**
     * Step 6: Validate references to ensure all after/before targets exist
     * @param {Array} extensions - Array of extension configurations
     * @returns {Array} Same array (validation only emits warnings)
     */
    function validateRefs(extensions) {
        log.debug('Pipeline Step 6: Validating references');
        
        const extensionNames = new Set(extensions.map(ext => ext.name));
        
        // Built-in middleware/tasks that are always available
        const builtinMiddleware = new Set(['compression', 'csp', 'cors']);
        const builtinTasks = new Set(['replaceVersion', 'replaceCopyright', 'replaceToken']);
        
        extensions.forEach(ext => {
            // Check middleware references
            if (ext.type === 'middleware') {
                if (ext.afterMiddleware && !extensionNames.has(ext.afterMiddleware) && !builtinMiddleware.has(ext.afterMiddleware)) {
                    log.warn(`Extension '${ext.name}' references unknown afterMiddleware '${ext.afterMiddleware}'`);
                }
                if (ext.beforeMiddleware && !extensionNames.has(ext.beforeMiddleware) && !builtinMiddleware.has(ext.beforeMiddleware)) {
                    log.warn(`Extension '${ext.name}' references unknown beforeMiddleware '${ext.beforeMiddleware}'`);
                }
            }
            
            // Check task references
            if (ext.type === 'task') {
                if (ext.afterTask && !extensionNames.has(ext.afterTask) && !builtinTasks.has(ext.afterTask)) {
                    log.warn(`Extension '${ext.name}' references unknown afterTask '${ext.afterTask}'`);
                }
                if (ext.beforeTask && !extensionNames.has(ext.beforeTask) && !builtinTasks.has(ext.beforeTask)) {
                    log.warn(`Extension '${ext.name}' references unknown beforeTask '${ext.beforeTask}'`);
                }
            }
        });
        
        return extensions;
    }
    
    /**
     * Step 7: Remove duplicates (first occurrence wins)
     * @param {Array} extensions - Array of extension configurations
     * @returns {Array} Deduplicated array
     */
    function deduplicate(extensions) {
        log.debug('Pipeline Step 7: Removing duplicates');
        
        const seen = new Set();
        const deduplicated = [];
        
        extensions.forEach(ext => {
            if (seen.has(ext.name)) {
                log.warn(`Duplicate extension '${ext.name}' found - using first occurrence`);
                return;
            }
            seen.add(ext.name);
            deduplicated.push(ext);
        });
        
        log.debug(`Removed ${extensions.length - deduplicated.length} duplicate extensions`);
        return deduplicated;
    }
    
    /**
     * Step 8: Smart sort using fixed pattern order
     * @param {Array} extensions - Array of extension configurations
     * @returns {Array} Sorted array
     */
    function smartSort(extensions) {
        log.debug('Pipeline Step 8: Smart sorting');
        
        // Fixed pattern order: stringreplace → transpile → modules → livereload → rest
        const patterns = [
            { pattern: /stringreplace/i, order: 10 },
            { pattern: /transpile/i, order: 20 },
            { pattern: /modules/i, order: 30 },
            { pattern: /livereload/i, order: 40 }
        ];
        
        // Assign smart order based on patterns
        const withOrder = extensions.map(ext => {
            let order = 50; // default for "rest"
            
            for (const pattern of patterns) {
                if (pattern.pattern.test(ext.name)) {
                    order = pattern.order;
                    break;
                }
            }
            
            return { ...ext, _smartOrder: order };
        });
        
        // Sort by smart order, then by name for stability
        const sorted = withOrder.sort((a, b) => {
            if (a._smartOrder !== b._smartOrder) {
                return a._smartOrder - b._smartOrder;
            }
            return a.name.localeCompare(b.name);
        });
        
        log.debug(`Smart sort order: ${sorted.map(ext => ext.name).join(' → ')}`);
        return sorted;
    }
    
    // ========== UTILITY FUNCTIONS ==========
    
    /**
     * Validates manifest structure and content using AJV schema validation
     * @param {Object} manifest - Manifest object to validate
     * @param {string} source - Source description for error messages
     * @returns {Object} Validation result
     */
    function validateManifest(manifest, source = 'unknown') {
        const errors = [];
        const warnings = [];
        
        if (!manifest || typeof manifest !== 'object') {
            errors.push('Manifest must be a valid object');
            return { isValid: false, errors, warnings };
        }
        
        // Schema validation using AJV
        if (validateManifestSchema) {
            const isValid = validateManifestSchema(manifest);
            if (!isValid && validateManifestSchema.errors) {
                validateManifestSchema.errors.forEach(error => {
                    const path = error.instancePath || '';
                    const message = error.message || 'Invalid value';
                    errors.push(`${path ? path + ': ' : ''}${message}`);
                });
            }
        }
        
        // Additional warnings for missing schema
        if (!manifest.$schema) {
            warnings.push('Missing $schema property - consider adding schema reference for better IDE support');
        }
        
        return { 
            isValid: errors.length === 0, 
            errors, 
            warnings,
            source
        };
    }
    
    /**
     * Loads and parses a manifest JSON file with validation
     * @param {string} filePath - Path to the manifest file
     * @returns {Object|null} Parsed manifest or null if not found/invalid
     */
    function loadManifest(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            const manifest = JSON.parse(content);
            
            // Validate manifest structure
            const validation = validateManifest(manifest, filePath);
            if (!validation.isValid) {
                log.error(`Invalid manifest at ${filePath}:`);
                validation.errors.forEach(error => log.error(`  - ${error}`));
                return null;
            }
            
            if (validation.warnings.length > 0) {
                validation.warnings.forEach(warning => log.warn(`Manifest ${filePath}: ${warning}`));
            }
            
            log.verbose(`Loaded and validated manifest from ${filePath}`);
            return manifest;
        } catch (error) {
            log.error(`Failed to load manifest from ${filePath}: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Gets the root package.json to identify dependencies
     * @returns {Object|null} Package.json object or null if not found
     */
    function getRootPackageJson() {
        try {
            const packagePath = path.resolve(process.cwd(), 'package.json');
            if (!fs.existsSync(packagePath)) {
                log.warn('No package.json found in current directory');
                return null;
            }
            
            const content = fs.readFileSync(packagePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            log.error(`Failed to load package.json: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Gets all dependencies from package.json (dependencies + devDependencies)
     * @returns {string[]} Array of dependency names
     */
    function getAllDependencies() {
        const packageJson = getRootPackageJson();
        if (!packageJson) {
            return [];
        }
        
        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});
        
        return [...dependencies, ...devDependencies];
    }
    
    /**
     * Finds manifest for a given dependency
     * @param {string} dependencyName - Name of the dependency
     * @param {string} manifestsDir - Path to fallback manifests directory
     * @returns {Object|null} Manifest object or null if not found
     */
    function findManifestForDependency(dependencyName, manifestsDir) {
        log.debug && log.debug(`Finding manifest for dependency: ${dependencyName}`);
        
        // First try to find manifest in the dependency's package
        const depManifestPath = path.resolve('node_modules', dependencyName, 'ui5-plugin-loader.json');
        log.debug && log.debug(`Checking package manifest at: ${depManifestPath}`);
        let manifest = loadManifest(depManifestPath);
        
        if (manifest) {
            log.info(`Found manifest for ${dependencyName} in package`);
            return { manifest, source: 'package' };
        }
        
        // Fallback to manifests directory
        const fallbackPath = path.resolve(manifestsDir, `${dependencyName}.json`);
        log.debug && log.debug(`Checking fallback manifest at: ${fallbackPath}`);
        manifest = loadManifest(fallbackPath);
        
        if (manifest) {
            log.info(`Found manifest for ${dependencyName} in fallback directory`);
            return { manifest, source: 'fallback' };
        }
        
        log.debug && log.debug(`No manifest found for dependency: ${dependencyName}`);
        return null;
    }
    
    /**
     * Validates that a dependency exists using require.resolve
     * @param {string} dependencyName - Name of the dependency
     * @returns {boolean} True if dependency exists
     */
    function dependencyExists(dependencyName) {
        try {
            require.resolve(dependencyName, { paths: [process.cwd()] });
            return true;
        } catch (error) {
            // Fallback to checking node_modules directory
            const depPath = path.resolve('node_modules', dependencyName);
            return fs.existsSync(depPath);
        }
    }
    
    /**
     * Maps extension names to package names
     * @param {string} extensionName - Extension name
     * @returns {string|null} Package name or null if not found
     */
    function getPackageNameFromExtension(extensionName) {
        // Common patterns for UI5 tooling extensions
        const mappings = {
            'ui5-tooling-transpile-middleware': 'ui5-tooling-transpile',
            'ui5-tooling-transpile-task': 'ui5-tooling-transpile',
            'ui5-tooling-modules-middleware': 'ui5-tooling-modules',
            'ui5-tooling-modules-task': 'ui5-tooling-modules',
            'ui5-tooling-stringreplace-middleware': 'ui5-tooling-stringreplace',
            'ui5-tooling-stringreplace-task': 'ui5-tooling-stringreplace',
            'ui5-middleware-livereload': 'ui5-middleware-livereload'
        };
        
        // Check direct mapping first
        if (mappings[extensionName]) {
            return mappings[extensionName];
        }
        
        // Try to derive package name from extension name
        const match = extensionName.match(/^(.+)-(middleware|task)$/);
        if (match) {
            return match[1];
        }
        
        // Fallback: assume extension name is the package name
        return extensionName;
    }
    
    // ========== MAIN PIPELINE FUNCTION ==========
    
    /**
     * Load and initialize actual middleware functions
     * @param {Object} options - Configuration options
     * @param {Object} options.context - UI5 tooling context
     * @param {string} options.manifestsDir - Directory containing fallback manifests
     * @returns {Object} Object containing loaded middleware functions
     */
    async function loadPlugins({ context, manifestsDir = 'manifests' }) {
        const { options = {} } = context;
        
        // Use the pipeline to get configurations
        const result = processPipeline({
            config: options,
            manifestsDir
        });
        
        const loadedMiddlewares = [];
        
        // Load actual middleware functions for each configuration
        for (const config of result.middleware) {
            try {
                const { name, configuration = {} } = config;
                const packageName = getPackageNameFromExtension(name);
                
                if (!packageName || !dependencyExists(packageName)) {
                    log.warn(`Package '${packageName}' not found, skipping middleware '${name}'`);
                    continue;
                }
                
                // Try different possible entry points
                const possiblePaths = [
                    `${packageName}/lib/middleware.js`,
                    `${packageName}/lib/livereload.js`, 
                    `${packageName}/middleware.js`,
                    `${packageName}/index.js`,
                    packageName
                ];
                
                let middlewareFunction = null;
                for (const possiblePath of possiblePaths) {
                    try {
                        const middlewarePath = require.resolve(possiblePath, { paths: [process.cwd()] });
                        const middlewareModule = require(middlewarePath);
                        
                        // Initialize the middleware with context and configuration
                        if (typeof middlewareModule === 'function') {
                            middlewareFunction = await middlewareModule({
                                ...context,
                                options: {
                                    ...configuration,
                                    middlewareName: name
                                }
                            });
                        }
                        break;
                    } catch (e) {
                        // Try next path
                    }
                }
                
                if (middlewareFunction) {
                    loadedMiddlewares.push({
                        name,
                        function: middlewareFunction
                    });
                    log.info(`Loaded middleware: ${name}`);
                } else {
                    log.warn(`Failed to load middleware: ${name}`);
                }
            } catch (error) {
                log.error(`Error loading middleware '${config.name}': ${error.message}`);
            }
        }
        
        return { loadedMiddlewares };
    }

    /**
     * Main pipeline function that processes plugin configurations
     * @param {Object} options - Pipeline options
     * @param {Object} options.config - Raw configuration from UI5 tooling
     * @param {string} options.manifestsDir - Path to fallback manifests directory
     * @returns {Object} Processed middleware and task configurations
     */
    function processPipeline({ config = {}, manifestsDir = 'manifests' }) {
        log.info('Starting UI5 Plugin Loader pipeline...');
        const startTime = Date.now();
        
        try {
            // Execute pipeline steps in order
            const normalizedConfig = loadConfig(config);
            const extensions = discoverManifests(manifestsDir);
            const withoutDisabled = applyDisable(extensions, normalizedConfig.disable);
            const withDefaults = fillDefaults(withoutDisabled);
            const withOverrides = applyOverride(withDefaults, normalizedConfig.override);
            const validated = validateRefs(withOverrides);
            const deduplicated = deduplicate(validated);
            const sorted = smartSort(deduplicated);
            
            // Separate middleware and tasks
            const middleware = sorted.filter(ext => ext.type === 'middleware');
            const tasks = sorted.filter(ext => ext.type === 'task');
            
            const duration = Date.now() - startTime;
            log.info(`Pipeline completed: ${middleware.length} middleware, ${tasks.length} tasks (${duration}ms)`);
            
            return {
                middleware,
                tasks,
                duration,
                total: sorted.length
            };
            
        } catch (error) {
            log.error(`Pipeline failed: ${error.message}`);
            throw error;
        }
    }
    
    // ========== EXPORTS ==========
    
    return {
        // Pipeline functions
        loadConfig,
        discoverManifests,
        applyDisable,
        fillDefaults,
        applyOverride,
        validateRefs,
        deduplicate,
        smartSort,
        processPipeline,
        loadPlugins,
        
        // Utility functions
        loadManifest,
        getRootPackageJson,
        getAllDependencies,
        findManifestForDependency,
        dependencyExists,
        getPackageNameFromExtension,
        validateManifest
    };
}; 
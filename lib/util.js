const fs = require('fs');
const path = require('path');

module.exports = function (log) {
    /**
     * Loads and parses a manifest JSON file
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
            
            log.verbose(`Loaded manifest from ${filePath}`);
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
    // First try to find manifest in the dependency's package
    const depManifestPath = path.resolve('node_modules', dependencyName, 'ui5-plugin-loader.json');
    let manifest = loadManifest(depManifestPath);
    
    if (manifest) {
        log.info(`Found manifest for ${dependencyName} in package`);
        return { manifest, source: 'package' };
    }
    
    // Fallback to manifests directory
    const fallbackPath = path.resolve(manifestsDir, `${dependencyName}.json`);
    manifest = loadManifest(fallbackPath);
    
    if (manifest) {
        log.info(`Found manifest for ${dependencyName} in fallback directory`);
        return { manifest, source: 'fallback' };
    }
    
    return null;
}

/**
 * Validates that a dependency exists in node_modules
 * @param {string} dependencyName - Name of the dependency
 * @returns {boolean} True if dependency exists
 */
function dependencyExists(dependencyName) {
    const depPath = path.resolve('node_modules', dependencyName);
    return fs.existsSync(depPath);
}

    /**
     * Loads and returns a middleware function from an extension package
     * @param {string} extensionName - Name of the extension (e.g., 'ui5-tooling-transpile-middleware')
     * @param {Object} configuration - Configuration object to pass to the middleware
     * @param {Object} context - UI5 tooling context (log, middlewareUtil, resources, etc.)
     * @returns {Function|null} Middleware function or null if not found
     */
    async function loadMiddlewareFromExtension(extensionName, configuration, context) {
        try {
            // Map extension names to package names
            const packageName = getPackageNameFromExtension(extensionName);
            if (!packageName) {
                log.warn(`Could not determine package name for extension: ${extensionName}`);
                return null;
            }
            
            // Check if package exists
            if (!dependencyExists(packageName)) {
                log.warn(`Package '${packageName}' not found in node_modules, skipping middleware '${extensionName}'`);
                return null;
            }
            
            // Try to resolve the middleware module
            // Different packages use different file names
            const possiblePaths = [
                path.resolve('node_modules', packageName, 'lib', 'middleware.js'),
                path.resolve('node_modules', packageName, 'lib', 'livereload.js'),
                path.resolve('node_modules', packageName, 'middleware.js'),
                path.resolve('node_modules', packageName, 'index.js')
            ];
            
            let middlewarePath = null;
            for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath)) {
                    middlewarePath = possiblePath;
                    break;
                }
            }
            
            if (!middlewarePath) {
                log.warn(`Middleware file not found for package '${packageName}'. Tried: ${possiblePaths.join(', ')}`);
                return null;
            }
            
            // Load the middleware module
            const middlewareModule = require(middlewarePath);
            
            // Create the context for the middleware
            const middlewareContext = {
                ...context,
                options: {
                    configuration,
                    middlewareName: extensionName
                }
            };
            
            // Initialize the middleware
            const middlewareFunction = await middlewareModule(middlewareContext);
            
            log.info(`Loaded middleware: ${extensionName}`);
            return middlewareFunction;
        } catch (error) {
            log.error(`Failed to load middleware '${extensionName}': ${error.message}`);
            return null;
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
            'ui5-middleware-livereload': 'ui5-middleware-livereload'
        };
        
        // Check direct mapping first
        if (mappings[extensionName]) {
            return mappings[extensionName];
        }
        
        // Try to derive package name from extension name
        // e.g., 'ui5-tooling-transpile-middleware' -> 'ui5-tooling-transpile'
        const match = extensionName.match(/^(.+)-(middleware|task)$/);
        if (match) {
            return match[1];
        }
        
        // Fallback: assume extension name is the package name
        return extensionName;
    }

    /**
     * Registers task using UI5 tooling APIs
     * @param {Object} taskUtil - UI5 task utility
     * @param {Object} taskConfig - Task configuration from manifest
     */
    async function registerTaskFromConfig(taskUtil, taskConfig) {
        try {
            const { name, afterTask, configuration = {} } = taskConfig;
            
            if (!name) {
                log.warn('Task configuration missing name, skipping');
                return;
            }
            
            const options = {
                afterTask: afterTask || 'replaceVersion',
                configuration
            };
            
            await taskUtil.registerTask({
                name,
                ...options
            });
            
            log.info(`Registered task: ${name}`);
        } catch (error) {
            log.error(`Failed to register task '${taskConfig.name}': ${error.message}`);
        }
    }

    /**
     * Main loader function that scans dependencies and loads extensions
     * @param {Object} options - Options object
     * @param {Object} options.context - UI5 tooling context (for middleware loading)
     * @param {Object} options.taskUtil - UI5 task utility (optional)
     * @param {string} options.manifestsDir - Path to fallback manifests directory
     * @returns {Promise<Object>} Summary of loaded extensions
     */
    async function loadPlugins({ context, taskUtil, manifestsDir = 'manifests' }) {
        const startTime = Date.now();
        let middlewareCount = 0;
        let taskCount = 0;
        const loadedMiddlewares = [];
        
        log.info('Starting plugin loader...');
        
        try {
            const dependencies = getAllDependencies();
            log.info(`Scanning ${dependencies.length} dependencies for manifests`);
            
            for (const dependency of dependencies) {
                const manifestInfo = findManifestForDependency(dependency, manifestsDir);
                
                if (!manifestInfo) {
                    log.verbose(`No manifest found for ${dependency}`);
                    continue;
                }
                
                const { manifest, source } = manifestInfo;
                log.info(`Processing manifest for ${dependency} (source: ${source})`);
                
                // Load middlewares
                if (manifest.middleware && Array.isArray(manifest.middleware) && context) {
                    for (const middlewareConfig of manifest.middleware) {
                        const { name, configuration = {} } = middlewareConfig;
                        const middlewareFunction = await loadMiddlewareFromExtension(name, configuration, context);
                        if (middlewareFunction) {
                            loadedMiddlewares.push({
                                name,
                                function: middlewareFunction,
                                config: middlewareConfig
                            });
                            middlewareCount++;
                        }
                    }
                }
                
                // Register tasks (keep existing logic for now)
                if (manifest.tasks && Array.isArray(manifest.tasks) && taskUtil) {
                    for (const taskConfig of manifest.tasks) {
                        await registerTaskFromConfig(taskUtil, taskConfig);
                        taskCount++;
                    }
                }
            }
            
            const duration = Date.now() - startTime;
            log.info(`Plugin loader completed: loaded ${middlewareCount} middleware, ${taskCount} tasks (${duration} ms)`);
            
            return {
                middlewareCount,
                taskCount,
                duration,
                loadedMiddlewares
            };
            
        } catch (error) {
            log.error(`Plugin loader failed: ${error.message}`);
            throw error;
        }
    }

    return {
        loadManifest,
        getRootPackageJson,
        getAllDependencies,
        findManifestForDependency,
        dependencyExists,
        loadMiddlewareFromExtension,
        getPackageNameFromExtension,
        registerTaskFromConfig,
        loadPlugins
    };
}; 
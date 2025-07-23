const path = require('path');

/**
 * UI5 Plugin Loader Middleware for UI5 Tooling v4
 * Auto-registers UI5 tooling extensions based on manifest JSON files
 */

/**
 * Declares required dependencies for UI5 tooling
 * This function is called by UI5 tooling to determine what dependencies are needed
 * @returns {Promise<Set>} Empty set to avoid blocking builds
 */
const determineRequiredDependencies = async () => {
    // Return empty set to avoid blocking builds as per best practices
    return new Set();
};

/**
 * Creates a debug-aware logger that respects the debug configuration
 * @param {Object} baseLogger - Base logger instance
 * @param {boolean} isDebugEnabled - Whether debug logging is enabled
 * @returns {Object} Enhanced logger with debug support
 */
function createDebugLogger(baseLogger, isDebugEnabled = false) {
    const logger = {
        info: baseLogger.info.bind(baseLogger),
        warn: baseLogger.warn.bind(baseLogger),
        error: baseLogger.error.bind(baseLogger),
        verbose: baseLogger.verbose ? baseLogger.verbose.bind(baseLogger) : () => {},
        debug: isDebugEnabled ? 
            (baseLogger.verbose ? baseLogger.verbose.bind(baseLogger) : baseLogger.info.bind(baseLogger)) : 
            () => {}
    };
    
    if (isDebugEnabled) {
        logger.debug('Debug logging enabled for UI5 Plugin Loader');
    }
    
    return logger;
}



/**
 * Middleware initialization function for UI5 Tooling v4
 * Called by UI5 tooling when the middleware is loaded
 * @param {Object} context - UI5 tooling context
 * @param {Object} context.middlewareUtil - Utility for registering middlewares
 * @param {Object} context.options - Configuration options
 * @param {Object} context.log - Logger instance
 * @param {Object} context.resources - Resource readers
 * @returns {Promise<Function>} Express middleware function
 */
const middleware = async (context) => {
    const { middlewareUtil, options = {}, log, resources } = context;
    
    // Fallback logger in case log is not provided
    const baseLogger = log || {
        info: console.log,
        warn: console.warn,
        error: console.error,
        verbose: () => {} // silent in fallback
    };
    
    // Create debug-aware logger based on configuration
    const isDebugEnabled = options.debug === true;
    const logger = createDebugLogger(baseLogger, isDebugEnabled);
    
    logger.debug('UI5 Plugin Loader middleware initialization started');
    logger.debug(`Configuration options: ${JSON.stringify(options, null, 2)}`);
    logger.debug(`Available middlewareUtil methods: ${Object.keys(middlewareUtil)}`);
    
    // Log available middlewareUtil methods for debugging
    logger.info(`Available middlewareUtil methods: ${Object.keys(middlewareUtil || {}).join(', ')}`);
    logger.info(`UI5 CLI version check - registerMiddleware available: ${typeof middlewareUtil?.registerMiddleware}`);
    
    // Note: UI5 Plugin Loader works as a standard custom middleware
    // Dynamic registration APIs may not be available in this UI5 CLI version
    
    // Get the core functions with logger
    const coreFunctions = require('./core')(logger);
    
    // Get manifests directory from options or use default
    const manifestsDir = options.manifestsDir || path.resolve(__dirname, '..', 'manifests');
    logger.debug(`Using manifests directory: ${manifestsDir}`);
    
    let loadedMiddlewares = [];
    
    try {
        logger.debug('Starting plugin pipeline...');
        
        // Use the new pipeline to process configurations
        const result = coreFunctions.processPipeline({
            config: options,
            manifestsDir
        });
        
        logger.debug(`Pipeline processing result: ${JSON.stringify({
            middlewareCount: result.middleware.length,
            taskCount: result.tasks.length,
            duration: result.duration
        })}`);
        
        // Load actual middleware functions using inline chaining
        ({ loadedMiddlewares } = await coreFunctions.loadPlugins({
            context: { log: logger, middlewareUtil, resources, options },
            manifestsDir
        }));

        logger.info(`Plugin loader completed: loaded ${loadedMiddlewares.length} middleware, ${result.tasks.length} tasks`);
        logger.debug('UI5 Plugin Loader middleware initialization completed successfully');
        
    } catch (error) {
        logger.error('UI5 Plugin Loader middleware initialization failed:', error.message);
        logger.debug('Middleware initialization error details:', error.stack);
        throw error; // Re-throw to ensure proper error handling
    }
    
    // Return one Express-compatible function that delegates to the
    // middlewares we just loaded.
    return async (req, res, next) => {
        let idx = 0;
        const run = (err) => {
            if (err) { return next(err); }
            if (idx >= loadedMiddlewares.length) { return next(); }
            try {
                loadedMiddlewares[idx++].function(req, res, run);
            } catch (e) {
                logger.error(`error in middleware ${loadedMiddlewares[idx-1].name}:`, e);
                run(e);
            }
        };
        run();
    };
};

// Export both the middleware function and the dependencies function
module.exports = middleware;
module.exports.determineRequiredDependencies = determineRequiredDependencies; 
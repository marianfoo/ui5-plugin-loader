const path = require('path');

/**
 * UI5 Plugin Loader Middleware
 * Auto-mounts UI5 tooling extensions based on manifest JSON files
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
 * Middleware initialization function
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
    const logger = log || {
        info: console.log,
        warn: console.warn,
        error: console.error,
        verbose: () => {} // silent in fallback
    };
    
    // Get the util functions with logger
    const utilFunctions = require('./util')(logger);
    
    // Get manifests directory from options or use default
    const manifestsDir = options.manifestsDir || path.resolve(__dirname, '..', 'manifests');
    
    let loadedMiddlewares = [];
    
    try {
        // Load plugins and get middleware functions
        const result = await utilFunctions.loadPlugins({
            context: { log: logger, middlewareUtil, options, resources },
            manifestsDir
        });
        loadedMiddlewares = result.loadedMiddlewares || [];
    } catch (error) {
        // Log error but don't crash the server (graceful failure as per requirements)
        logger.error('UI5 Plugin Loader middleware initialization failed:', error.message);
    }
    
    // Return a middleware function that executes loaded middlewares
    return async (req, res, next) => {
        if (loadedMiddlewares.length === 0) {
            // No middlewares loaded, pass through
            next();
            return;
        }
        
        // Execute loaded middlewares in sequence
        let currentIndex = 0;
        
        const executeNext = (err) => {
            if (err) {
                // Pass error to next middleware in the chain
                next(err);
                return;
            }
            
            if (currentIndex >= loadedMiddlewares.length) {
                // All middlewares executed, continue to next middleware
                next();
                return;
            }
            
            const currentMiddleware = loadedMiddlewares[currentIndex++];
            
            try {
                // Execute the middleware function
                currentMiddleware.function(req, res, executeNext);
            } catch (error) {
                logger.error(`Error in middleware ${currentMiddleware.name}:`, error.message);
                executeNext(error);
            }
        };
        
        // Start executing middlewares
        executeNext();
    };
};

// Export both the middleware function and the dependencies function
module.exports = middleware;
module.exports.determineRequiredDependencies = determineRequiredDependencies; 
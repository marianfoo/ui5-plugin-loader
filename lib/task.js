const path = require('path');

/**
 * UI5 Plugin Loader Task
 * Auto-mounts UI5 tooling tasks based on manifest JSON files
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
 * Task initialization function
 * Called by UI5 tooling when the task is loaded
 * @param {Object} context - UI5 tooling context
 * @param {Object} context.taskUtil - Utility for registering tasks
 * @param {Object} context.options - Configuration options
 * @param {Object} context.log - Logger instance
 * @returns {Promise<Function>} Task execution function
 */
const task = async (context) => {
    const { taskUtil, options = {}, log } = context;
    
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
    
    try {
        // Load and register plugins (tasks still use traditional registration)
        await utilFunctions.loadPlugins({
            taskUtil,
            manifestsDir
        });
    } catch (error) {
        // Log error but don't crash the build (graceful failure as per requirements)
        logger.error('UI5 Plugin Loader task initialization failed:', error.message);
    }
    
    // Return a task execution function
    // The actual work is done during initialization above
    return async function executeTask(taskContext) {
        // This task doesn't process any resources, it just registers other tasks
        // Return the workspace unchanged
        return taskContext.workspace;
    };
};

// Export both the task function and the dependencies function
module.exports = task;
module.exports.determineRequiredDependencies = determineRequiredDependencies; 
const path = require('path');

/**
 * UI5 Plugin Loader Task for UI5 Tooling v4
 * Auto-registers UI5 tooling tasks based on manifest JSON files
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
        logger.debug('Debug logging enabled for UI5 Plugin Loader Task');
    }
    
    return logger;
}

/**
 * Task initialization function for UI5 Tooling v4
 * Called by UI5 tooling when the task is loaded
 * @param {Object} context - UI5 tooling context
 * @param {Object} context.taskUtil - Utility for registering tasks
 * @param {Object} context.options - Configuration options
 * @param {Object} context.log - Logger instance
 * @returns {Promise<Function>} Task function
 */
const task = async (context) => {
    const { taskUtil, options = {}, log } = context;
    
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
    
    logger.debug('UI5 Plugin Loader task initialization started');
    logger.debug(`Configuration options: ${JSON.stringify(options, null, 2)}`);
    logger.debug(`Available taskUtil methods: ${Object.keys(taskUtil || {})}`);
    
    // Require UI5 Tooling v4 task registration support
    if (!taskUtil || typeof taskUtil.registerTask !== 'function') {
        const error = 'UI5 Plugin Loader requires UI5 Tooling v4 with taskUtil.registerTask support';
        logger.error(error);
        logger.debug('taskUtil object:', taskUtil);
        throw new Error(error);
    }
    
    // Get the core functions with logger
    const coreFunctions = require('./core')(logger);
    
    // Get manifests directory from options or use default
    const manifestsDir = options.manifestsDir || path.resolve(__dirname, '..', 'manifests');
    logger.debug(`Using manifests directory: ${manifestsDir}`);
    
    try {
        logger.debug('Starting plugin pipeline for tasks...');
        
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
        
        // Register tasks dynamically if UI5 CLI supports it
        if (result.tasks.length > 0 && typeof taskUtil.registerTask === "function") {
            logger.info(`Registering ${result.tasks.length} tasks...`);
            for (const taskConfig of result.tasks) {
                try {
                    const { name, afterTask, beforeTask, configuration = {} } = taskConfig;
                    
                    if (!name) {
                        logger.warn('Task configuration missing name, skipping');
                        continue;
                    }
                    
                    const registrationOptions = {
                        name,
                        configuration
                    };
                    
                    // Add order specification
                    if (afterTask) {
                        registrationOptions.afterTask = afterTask;
                    } else if (beforeTask) {
                        registrationOptions.beforeTask = beforeTask;
                    } else {
                        registrationOptions.afterTask = 'replaceVersion'; // Default fallback
                    }
                    
                    await taskUtil.registerTask(registrationOptions);
                    
                    logger.info(`✓ Registered task: ${name}`);
                    logger.debug(`Task registration successful: ${name}`);
                } catch (error) {
                    logger.error(`Failed to register task '${taskConfig.name}': ${error.message}`);
                    logger.debug(`Task registration error details for ${taskConfig.name}:`, error.stack);
                }
            }
        } else if (result.tasks.length > 0) {
            logger.warn(`Found ${result.tasks.length} task configurations, but your UI5 CLI is too old for dynamic registration.`);
            logger.warn('Please upgrade to @ui5/cli ^4.1.0 or configure tasks statically in ui5.yaml:');
            result.tasks.forEach(config => {
                logger.warn(`  - name: ${config.name}`);
                if (config.afterTask) logger.warn(`    afterTask: ${config.afterTask}`);
                if (config.beforeTask) logger.warn(`    beforeTask: ${config.beforeTask}`);
            });
        } else {
            logger.debug('No task configurations found for registration');
        }
        
        logger.info(`UI5 Plugin Loader Task completed: registered ${result.middleware.length} middlewares, ${result.tasks.length} tasks`);
        logger.debug('UI5 Plugin Loader task initialization completed successfully');
        
    } catch (error) {
        logger.error('UI5 Plugin Loader task initialization failed:', error.message);
        logger.debug('Task initialization error details:', error.stack);
        throw error; // Re-throw to ensure proper error handling
    }
    
    // Return a minimal task function since registration happens during initialization
    return async (taskContext) => {
        logger.debug('Task execution started');
        logger.debug(`Task context: workspace: ${taskContext.workspace}, dependencies: ${taskContext.dependencies}, options: ${JSON.stringify(taskContext.options)}`);
        
        // The actual tasks are registered dynamically during initialization
        // This function just provides a placeholder
        logger.debug('Task execution completed (tasks registered dynamically)');
        return Promise.resolve();
    };
};

// Export both the task function and the dependencies function
module.exports = task;
module.exports.determineRequiredDependencies = determineRequiredDependencies; 
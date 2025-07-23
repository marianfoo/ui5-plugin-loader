const fs = require('fs');
const path = require('path');

/**
 * Node.js script to combine UI5 Plugin Loader files into context.md for AI analysis
 * This script reads all relevant source files and combines them into a single markdown file
 */

// Files to combine for context analysis
const filesToCombine = [
    // lib folder files
    { path: 'lib/middleware.js', type: 'javascript', description: 'UI5 Tooling v4 middleware implementation' },
    { path: 'lib/task.js', type: 'javascript', description: 'UI5 Tooling v4 task implementation' },
    { path: 'lib/core.js', type: 'javascript', description: 'Core utility functions and plugin loading logic' },
    
    // Manifest files
    { path: 'manifests/ui5-tooling-modules.json', type: 'json', description: 'Manifest for ui5-tooling-modules extension' },
    { path: 'manifests/ui5-tooling-transpile.json', type: 'json', description: 'Manifest for ui5-tooling-transpile extension' },
    { path: 'manifests/ui5-middleware-livereload.json', type: 'json', description: 'Manifest for ui5-middleware-livereload extension' },
    
    // Schema files
    { path: 'schema/ui5-plugin-loader.schema.json', type: 'json', description: 'JSON schema for manifest validation' },
    
    // Root configuration files
    { path: 'ui5.yaml', type: 'yaml', description: 'UI5 tooling extension configuration' },
    { path: 'package.json', type: 'json', description: 'Package configuration and dependencies' },
    { path: 'README.md', type: 'markdown', description: 'Project documentation and usage guide' }
];

/**
 * Generates a slug from a filename for markdown anchors
 * @param {string} filename - The filename to convert
 * @returns {string} Slug suitable for markdown anchors
 */
function generateSlug(filename) {
    return filename
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Reads a file and returns its content with error handling
 * @param {string} filePath - Path to the file to read
 * @returns {Object} Object with success status and content or error
 */
function readFileContent(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Formats file content for markdown output
 * @param {Object} fileInfo - File information object
 * @param {string} content - File content
 * @returns {string} Formatted markdown content
 */
function formatFileContent(fileInfo, content) {
    const fileName = path.basename(fileInfo.path);
    let formatted = `## ${fileName}\n\n`;
    formatted += `**Path:** \`${fileInfo.path}\`\n`;
    formatted += `**Type:** ${fileInfo.type}\n`;
    formatted += `**Description:** ${fileInfo.description}\n\n`;
    
    if (fileInfo.type === 'markdown') {
        // For markdown files, include content directly
        formatted += content + '\n\n';
    } else {
        // For other files, wrap in code blocks with syntax highlighting
        formatted += `\`\`\`${fileInfo.type}\n${content}\n\`\`\`\n\n`;
    }
    
    return formatted;
}

/**
 * Generates the complete context.md file
 */
function generateContext() {
    console.log('🚀 Starting context.md generation...');
    
    // Initialize the combined content with header
    let combinedContent = '# UI5 Plugin Loader - Context for AI Analysis\n\n';
    combinedContent += 'This document combines all relevant source files for comprehensive context analysis.\n';
    combinedContent += 'Generated automatically by `scripts/generate-context.js`.\n\n';
    
    // Add metadata
    combinedContent += '## Generation Info\n\n';
    combinedContent += `- **Generated:** ${new Date().toISOString()}\n`;
    combinedContent += `- **Files included:** ${filesToCombine.length}\n`;
    combinedContent += `- **Purpose:** Provide complete context for AI analysis\n\n`;
    
    // Generate table of contents
    combinedContent += '## Table of Contents\n\n';
    filesToCombine.forEach(file => {
        const fileName = path.basename(file.path);
        const slug = generateSlug(fileName);
        combinedContent += `- [${fileName}](#${slug}) - ${file.description}\n`;
    });
    combinedContent += '\n---\n\n';
    
    // Process each file
    let successCount = 0;
    let errorCount = 0;
    
    filesToCombine.forEach(file => {
        const fileName = path.basename(file.path);
        console.log(`📄 Processing: ${fileName}`);
        
        const result = readFileContent(file.path);
        
        if (result.success) {
            combinedContent += formatFileContent(file, result.content);
            combinedContent += '---\n\n';
            successCount++;
        } else {
            console.warn(`⚠️  Warning: Could not read ${file.path}: ${result.error}`);
            combinedContent += `## ${fileName}\n\n`;
            combinedContent += `**Path:** \`${file.path}\`\n`;
            combinedContent += `**Type:** ${file.type}\n`;
            combinedContent += `**Description:** ${file.description}\n\n`;
            combinedContent += `**Error:** Could not read file - ${result.error}\n\n`;
            combinedContent += '---\n\n';
            errorCount++;
        }
    });
    
    // Add footer with statistics
    combinedContent += '## Generation Statistics\n\n';
    combinedContent += `- **Total files processed:** ${filesToCombine.length}\n`;
    combinedContent += `- **Successfully read:** ${successCount}\n`;
    combinedContent += `- **Errors encountered:** ${errorCount}\n`;
    combinedContent += `- **Generated at:** ${new Date().toISOString()}\n\n`;
    
    // Write the combined content
    try {
        fs.writeFileSync('context.md', combinedContent);
        console.log('✅ Successfully created context.md');
        console.log(`📊 Stats: ${successCount} files successfully processed, ${errorCount} errors`);
        console.log(`📄 File size: ${Math.round(combinedContent.length / 1024)} KB`);
    } catch (error) {
        console.error('❌ Error writing context.md:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    generateContext();
}

module.exports = { generateContext }; 
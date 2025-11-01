import { NextResponse } from 'next/server';
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getFileContent } from '@/lib/s3';
import * as acorn from 'acorn';

/**
 * Analyze code and detect potential issues
 */
function analyzeCode(content, fileName) {
  const issues = [];
  const lines = content.split('\n');
  const fileExtension = fileName.split('.').pop().toLowerCase();

  // Determine file type
  const isJavaScript = ['js', 'jsx', 'mjs', 'cjs'].includes(fileExtension);
  const isTypeScript = ['ts', 'tsx'].includes(fileExtension);
  const isPython = ['py'].includes(fileExtension);
  const isCSS = ['css', 'scss', 'sass', 'less'].includes(fileExtension);
  const isHTML = ['html', 'htm'].includes(fileExtension);
  const isJSON = ['json'].includes(fileExtension);

  // General checks for all files
  checkTrailingWhitespace(lines, issues);
  checkFileSize(content, issues);
  checkLongLines(lines, issues);
  checkEmptyFile(content, issues);

  // Language-specific checks
  if (isJavaScript || isTypeScript) {
    analyzeJavaScript(content, lines, issues, fileName);
  } else if (isPython) {
    analyzePython(lines, issues);
  } else if (isCSS) {
    analyzeCSS(lines, issues);
  } else if (isHTML) {
    analyzeHTML(lines, issues);
  } else if (isJSON) {
    analyzeJSON(content, issues);
  }

  // Calculate metrics
  const metrics = calculateMetrics(content, lines, issues);

  return { issues, metrics };
}

/**
 * Check for trailing whitespace
 */
function checkTrailingWhitespace(lines, issues) {
  lines.forEach((line, index) => {
    if (line.endsWith(' ') || line.endsWith('\t')) {
      issues.push({
        type: 'style',
        severity: 'info',
        line: index + 1,
        message: 'Trailing whitespace detected',
        suggestion: 'Remove trailing whitespace at the end of the line',
      });
    }
  });
}

/**
 * Check file size
 */
function checkFileSize(content, issues) {
  const sizeInKB = Buffer.byteLength(content, 'utf-8') / 1024;
  if (sizeInKB > 500) {
    issues.push({
      type: 'performance',
      severity: 'warning',
      line: 1,
      message: `Large file size: ${sizeInKB.toFixed(2)} KB`,
      suggestion: 'Consider splitting this file into smaller modules for better maintainability',
    });
  }
}

/**
 * Check for long lines
 */
function checkLongLines(lines, issues) {
  lines.forEach((line, index) => {
    if (line.length > 120) {
      issues.push({
        type: 'style',
        severity: 'info',
        line: index + 1,
        message: `Line too long (${line.length} characters)`,
        suggestion: 'Consider breaking this line into multiple lines for better readability',
      });
    }
  });
}

/**
 * Check for empty file
 */
function checkEmptyFile(content, issues) {
  if (content.trim().length === 0) {
    issues.push({
      type: 'quality',
      severity: 'warning',
      line: 1,
      message: 'File is empty',
      suggestion: 'Remove unused files or add content',
    });
  }
}

/**
 * Analyze JavaScript/TypeScript code
 */
function analyzeJavaScript(content, lines, issues, fileName) {
  // Check for console.log statements
  lines.forEach((line, index) => {
    if (line.match(/console\.(log|debug|info|warn|error)/)) {
      issues.push({
        type: 'quality',
        severity: 'warning',
        line: index + 1,
        message: 'Console statement detected',
        suggestion: 'Remove console statements before production deployment',
      });
    }
  });

  // Check for var declarations
  lines.forEach((line, index) => {
    if (line.match(/\bvar\s+/)) {
      issues.push({
        type: 'best-practice',
        severity: 'warning',
        line: index + 1,
        message: 'Use of "var" keyword',
        suggestion: 'Use "const" or "let" instead of "var" for better scoping',
      });
    }
  });

  // Check for == instead of ===
  lines.forEach((line, index) => {
    if (line.match(/[^=!><]={2}[^=]/) && !line.includes('===')) {
      issues.push({
        type: 'best-practice',
        severity: 'warning',
        line: index + 1,
        message: 'Use of loose equality (==)',
        suggestion: 'Use strict equality (===) to avoid type coercion issues',
      });
    }
  });

  // Check for missing semicolons (simple check)
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed &&
        !trimmed.endsWith(';') &&
        !trimmed.endsWith('{') &&
        !trimmed.endsWith('}') &&
        !trimmed.endsWith(',') &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('*') &&
        !trimmed.includes('import ') &&
        !trimmed.includes('export ') &&
        (trimmed.includes('const ') || trimmed.includes('let ') || trimmed.includes('var ') || trimmed.includes('return '))) {
      issues.push({
        type: 'syntax',
        severity: 'info',
        line: index + 1,
        message: 'Possibly missing semicolon',
        suggestion: 'Add semicolon at the end of the statement',
      });
    }
  });

  // Try to parse with acorn for syntax errors
  try {
    acorn.parse(content, {
      ecmaVersion: 2022,
      sourceType: 'module',
      allowHashBang: true,
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true
    });
  } catch (error) {
    if (error.loc) {
      issues.push({
        type: 'syntax',
        severity: 'error',
        line: error.loc.line,
        message: 'Syntax error: ' + error.message,
        suggestion: 'Fix the syntax error to ensure the code can be parsed correctly',
      });
    }
  }

  // Check for unused variables (simple detection)
  const variableDeclarations = content.match(/(?:const|let|var)\s+(\w+)/g);
  if (variableDeclarations) {
    variableDeclarations.forEach(declaration => {
      const varName = declaration.split(/\s+/)[1];
      // Count occurrences (excluding the declaration line)
      const occurrences = (content.match(new RegExp(`\\b${varName}\\b`, 'g')) || []).length;
      if (occurrences === 1) {
        issues.push({
          type: 'quality',
          severity: 'info',
          line: 0,
          message: `Variable "${varName}" may be unused`,
          suggestion: 'Remove unused variables to improve code clarity',
        });
      }
    });
  }

  // Check for TODO/FIXME comments
  lines.forEach((line, index) => {
    if (line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)/i)) {
      issues.push({
        type: 'quality',
        severity: 'info',
        line: index + 1,
        message: 'TODO/FIXME comment found',
        suggestion: 'Address this comment or create a task to track it',
      });
    }
  });

  // Check for deeply nested code
  lines.forEach((line, index) => {
    const leadingSpaces = line.search(/\S/);
    if (leadingSpaces > 20) {
      issues.push({
        type: 'complexity',
        severity: 'warning',
        line: index + 1,
        message: 'Deeply nested code detected',
        suggestion: 'Consider refactoring to reduce nesting levels for better readability',
      });
    }
  });
}

/**
 * Analyze Python code
 */
function analyzePython(lines, issues) {
  lines.forEach((line, index) => {
    // Check for print statements
    if (line.match(/\bprint\s*\(/)) {
      issues.push({
        type: 'quality',
        severity: 'warning',
        line: index + 1,
        message: 'Print statement detected',
        suggestion: 'Use proper logging instead of print statements',
      });
    }

    // Check for tabs (PEP 8)
    if (line.includes('\t')) {
      issues.push({
        type: 'style',
        severity: 'warning',
        line: index + 1,
        message: 'Tab character used for indentation',
        suggestion: 'Use 4 spaces for indentation (PEP 8)',
      });
    }
  });
}

/**
 * Analyze CSS code
 */
function analyzeCSS(lines, issues) {
  lines.forEach((line, index) => {
    // Check for !important
    if (line.includes('!important')) {
      issues.push({
        type: 'best-practice',
        severity: 'warning',
        line: index + 1,
        message: 'Use of !important detected',
        suggestion: 'Avoid using !important; refactor specificity instead',
      });
    }

    // Check for color values that could be variables
    if (line.match(/#[0-9a-fA-F]{3,6}/)) {
      issues.push({
        type: 'best-practice',
        severity: 'info',
        line: index + 1,
        message: 'Hard-coded color value',
        suggestion: 'Consider using CSS variables for better maintainability',
      });
    }
  });
}

/**
 * Analyze HTML code
 */
function analyzeHTML(lines, issues) {
  let hasDoctype = false;

  lines.forEach((line, index) => {
    if (line.toLowerCase().includes('<!doctype')) {
      hasDoctype = true;
    }

    // Check for inline styles
    if (line.includes('style=')) {
      issues.push({
        type: 'best-practice',
        severity: 'info',
        line: index + 1,
        message: 'Inline style attribute detected',
        suggestion: 'Use external CSS for better maintainability',
      });
    }

    // Check for missing alt attributes on images
    if (line.includes('<img') && !line.includes('alt=')) {
      issues.push({
        type: 'accessibility',
        severity: 'warning',
        line: index + 1,
        message: 'Image missing alt attribute',
        suggestion: 'Add alt attribute for accessibility',
      });
    }
  });

  if (!hasDoctype) {
    issues.push({
      type: 'quality',
      severity: 'warning',
      line: 1,
      message: 'Missing DOCTYPE declaration',
      suggestion: 'Add <!DOCTYPE html> at the beginning of the file',
    });
  }
}

/**
 * Analyze JSON code
 */
function analyzeJSON(content, issues) {
  try {
    JSON.parse(content);
  } catch (error) {
    issues.push({
      type: 'syntax',
      severity: 'error',
      line: 0,
      message: 'Invalid JSON: ' + error.message,
      suggestion: 'Fix the JSON syntax error',
    });
  }
}

/**
 * Calculate code metrics
 */
function calculateMetrics(content, lines, issues) {
  const totalLines = lines.length;
  const codeLines = lines.filter(line => line.trim().length > 0).length;
  const commentLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
  }).length;

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  // Calculate quality score (0-100)
  let qualityScore = 100;
  qualityScore -= errorCount * 10;
  qualityScore -= warningCount * 3;
  qualityScore -= infoCount * 1;
  qualityScore = Math.max(0, qualityScore);

  return {
    totalLines,
    codeLines,
    commentLines,
    blankLines: totalLines - codeLines,
    errorCount,
    warningCount,
    infoCount,
    qualityScore,
  };
}

export async function POST(request) {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileKey } = await request.json();

    if (!fileKey) {
      return NextResponse.json({ error: 'File key is required' }, { status: 400 });
    }

    // Get file content from S3
    const content = await getFileContent(fileKey);

    // Extract filename from key
    const fileName = fileKey.split('/').pop();

    // Analyze the code
    const analysis = analyzeCode(content, fileName);

    return NextResponse.json({
      fileName,
      fileKey,
      content,
      analysis,
    });
  } catch (error) {
    console.error('Code review API error:', error);
    return NextResponse.json(
      { error: 'Failed to perform code review', details: error.message },
      { status: 500 }
    );
  }
}


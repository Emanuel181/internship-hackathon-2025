import * as acorn from 'acorn';

/**
 * Multi-dimensional code analysis
 * Performs comprehensive static analysis across multiple dimensions:
 * - Linting (style, syntax)
 * - Security (vulnerabilities, unsafe patterns)
 * - Architecture (structure, dependencies, maintainability)
 * - Code Quality (readability, complexity, duplication)
 */

export function analyzeCodeMultiDimensional(content, fileName) {
  const lines = content.split('\n');
  const fileExtension = fileName.split('.').pop().toLowerCase();

  // Initialize analysis results
  const analysis = {
    linting: { issues: [], score: 100 },
    security: { issues: [], score: 100 },
    architecture: { issues: [], score: 100 },
    quality: { issues: [], score: 100 },
    documentation: { issues: [], suggestions: [] },
    metrics: {},
    issues: [], // Combined issues
  };

  // Perform multi-dimensional analysis
  performLintingAnalysis(content, lines, fileExtension, analysis);
  performSecurityAnalysis(content, lines, fileExtension, analysis);
  performArchitectureAnalysis(content, lines, fileExtension, analysis);
  performQualityAnalysis(content, lines, fileExtension, analysis);
  performDocumentationAnalysis(content, lines, fileExtension, analysis);
  calculateMetrics(content, lines, analysis);

  // Combine all issues
  analysis.issues = [
    ...analysis.linting.issues,
    ...analysis.security.issues,
    ...analysis.architecture.issues,
    ...analysis.quality.issues,
    ...analysis.documentation.issues,
  ];

  // Calculate overall scores
  calculateScores(analysis);

  return analysis;
}

/**
 * Linting Analysis - Style and Syntax
 */
function performLintingAnalysis(content, lines, fileExtension, analysis) {
  const isJavaScript = ['js', 'jsx', 'ts', 'tsx'].includes(fileExtension);
  const isPython = fileExtension === 'py';
  const isCSS = ['css', 'scss', 'sass'].includes(fileExtension);

  // Trailing whitespace
  lines.forEach((line, index) => {
    if (line.endsWith(' ') || line.endsWith('\t')) {
      analysis.linting.issues.push({
        type: 'linting',
        category: 'style',
        severity: 'info',
        line: index + 1,
        message: 'Trailing whitespace detected',
        suggestion: 'Remove trailing whitespace at the end of the line',
        autoFixable: true,
      });
    }
  });

  // Long lines
  lines.forEach((line, index) => {
    if (line.length > 120) {
      analysis.linting.issues.push({
        type: 'linting',
        category: 'style',
        severity: 'info',
        line: index + 1,
        message: `Line too long (${line.length} characters)`,
        suggestion: 'Break this line into multiple lines for better readability (max 120 chars)',
        autoFixable: false,
      });
    }
  });

  if (isJavaScript) {
    lintJavaScript(content, lines, analysis);
  } else if (isPython) {
    lintPython(lines, analysis);
  } else if (isCSS) {
    lintCSS(lines, analysis);
  }
}

function lintJavaScript(content, lines, analysis) {
  // var usage
  lines.forEach((line, index) => {
    if (line.match(/\bvar\s+/)) {
      analysis.linting.issues.push({
        type: 'linting',
        category: 'best-practice',
        severity: 'warning',
        line: index + 1,
        message: 'Use of deprecated "var" keyword',
        suggestion: 'Replace "var" with "const" or "let" for better scoping',
        autoFixable: true,
      });
    }
  });

  // Loose equality
  lines.forEach((line, index) => {
    if (line.match(/[^=!><]={2}[^=]/)) {
      analysis.linting.issues.push({
        type: 'linting',
        category: 'best-practice',
        severity: 'warning',
        line: index + 1,
        message: 'Use of loose equality (==)',
        suggestion: 'Use strict equality (===) to avoid type coercion',
        autoFixable: true,
      });
    }
  });

  // console.log
  lines.forEach((line, index) => {
    if (line.match(/console\.(log|debug|info|warn)/)) {
      analysis.linting.issues.push({
        type: 'linting',
        category: 'cleanup',
        severity: 'info',
        line: index + 1,
        message: 'Console statement detected',
        suggestion: 'Remove console statements before production deployment',
        autoFixable: true,
      });
    }
  });

  // Syntax validation
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
      analysis.linting.issues.push({
        type: 'linting',
        category: 'syntax',
        severity: 'error',
        line: error.loc.line,
        message: 'Syntax error: ' + error.message,
        suggestion: 'Fix the syntax error to ensure code can be parsed',
        autoFixable: false,
      });
    }
  }
}

function lintPython(lines, analysis) {
  lines.forEach((line, index) => {
    // Tabs in Python (PEP 8)
    if (line.includes('\t')) {
      analysis.linting.issues.push({
        type: 'linting',
        category: 'style',
        severity: 'warning',
        line: index + 1,
        message: 'Tab character used for indentation',
        suggestion: 'Use 4 spaces for indentation (PEP 8)',
        autoFixable: true,
      });
    }

    // print statements
    if (line.match(/\bprint\s*\(/)) {
      analysis.linting.issues.push({
        type: 'linting',
        category: 'cleanup',
        severity: 'info',
        line: index + 1,
        message: 'Print statement detected',
        suggestion: 'Use proper logging instead of print statements',
        autoFixable: false,
      });
    }
  });
}

function lintCSS(lines, analysis) {
  lines.forEach((line, index) => {
    // !important usage
    if (line.includes('!important')) {
      analysis.linting.issues.push({
        type: 'linting',
        category: 'best-practice',
        severity: 'warning',
        line: index + 1,
        message: 'Use of !important detected',
        suggestion: 'Avoid !important; refactor CSS specificity instead',
        autoFixable: false,
      });
    }
  });
}

/**
 * Security Analysis
 */
function performSecurityAnalysis(content, lines, fileExtension, analysis) {
  const isJavaScript = ['js', 'jsx', 'ts', 'tsx'].includes(fileExtension);
  const isPython = fileExtension === 'py';

  if (isJavaScript) {
    securityCheckJavaScript(content, lines, analysis);
  } else if (isPython) {
    securityCheckPython(content, lines, analysis);
  }

  // Check for hardcoded secrets (all languages)
  lines.forEach((line, index) => {
    // API keys, tokens, passwords
    const secretPatterns = [
      /api[_-]?key\s*=\s*['"]\w{20,}['"]/i,
      /api[_-]?secret\s*=\s*['"]\w{20,}['"]/i,
      /password\s*=\s*['"]\w+['"]/i,
      /token\s*=\s*['"]\w{20,}['"]/i,
      /secret\s*=\s*['"]\w{20,}['"]/i,
      /aws[_-]?access[_-]?key\s*=\s*['"]\w+['"]/i,
    ];

    secretPatterns.forEach(pattern => {
      if (pattern.test(line)) {
        analysis.security.issues.push({
          type: 'security',
          category: 'secrets',
          severity: 'critical',
          line: index + 1,
          message: 'Potential hardcoded secret detected',
          suggestion: 'Move secrets to environment variables or secure vault',
          autoFixable: false,
        });
      }
    });
  });
}

function securityCheckJavaScript(content, lines, analysis) {
  // eval() usage
  lines.forEach((line, index) => {
    if (line.match(/\beval\s*\(/)) {
      analysis.security.issues.push({
        type: 'security',
        category: 'code-injection',
        severity: 'critical',
        line: index + 1,
        message: 'Use of eval() detected - code injection risk',
        suggestion: 'Avoid eval(); use safer alternatives like JSON.parse() or Function constructor',
        autoFixable: false,
      });
    }
  });

  // innerHTML usage
  lines.forEach((line, index) => {
    if (line.match(/\.innerHTML\s*=/)) {
      analysis.security.issues.push({
        type: 'security',
        category: 'xss',
        severity: 'warning',
        line: index + 1,
        message: 'Use of innerHTML - XSS vulnerability risk',
        suggestion: 'Use textContent or sanitize HTML input to prevent XSS',
        autoFixable: false,
      });
    }
  });

  // document.write
  lines.forEach((line, index) => {
    if (line.match(/document\.write\s*\(/)) {
      analysis.security.issues.push({
        type: 'security',
        category: 'xss',
        severity: 'warning',
        line: index + 1,
        message: 'Use of document.write() - security and performance risk',
        suggestion: 'Use modern DOM manipulation methods instead',
        autoFixable: false,
      });
    }
  });

  // Unsafe regex (ReDoS)
  const regexPatterns = content.match(/\/.*\+.*\+.*\//g);
  if (regexPatterns) {
    lines.forEach((line, index) => {
      if (line.match(/\/.*\+.*\+.*\//)) {
        analysis.security.issues.push({
          type: 'security',
          category: 'redos',
          severity: 'warning',
          line: index + 1,
          message: 'Potentially unsafe regex - ReDoS vulnerability',
          suggestion: 'Review regex pattern for catastrophic backtracking',
          autoFixable: false,
        });
      }
    });
  }
}

function securityCheckPython(content, lines, analysis) {
  // exec() usage
  lines.forEach((line, index) => {
    if (line.match(/\bexec\s*\(/)) {
      analysis.security.issues.push({
        type: 'security',
        category: 'code-injection',
        severity: 'critical',
        line: index + 1,
        message: 'Use of exec() - code injection risk',
        suggestion: 'Avoid exec(); use safer alternatives',
        autoFixable: false,
      });
    }
  });

  // SQL injection risk
  lines.forEach((line, index) => {
    if (line.match(/execute\s*\(\s*['"]\s*SELECT.*%s/i)) {
      analysis.security.issues.push({
        type: 'security',
        category: 'sql-injection',
        severity: 'critical',
        line: index + 1,
        message: 'Potential SQL injection vulnerability',
        suggestion: 'Use parameterized queries instead of string formatting',
        autoFixable: false,
      });
    }
  });
}

/**
 * Architecture Analysis
 */
function performArchitectureAnalysis(content, lines, fileExtension, analysis) {
  // File size check
  const sizeInKB = Buffer.byteLength(content, 'utf-8') / 1024;
  if (sizeInKB > 500) {
    analysis.architecture.issues.push({
      type: 'architecture',
      category: 'modularity',
      severity: 'warning',
      line: 1,
      message: `Large file size: ${sizeInKB.toFixed(2)} KB`,
      suggestion: 'Consider splitting into smaller, more focused modules',
      autoFixable: false,
    });
  }

  // Function/method count and size
  const functionCount = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length;
  if (functionCount > 20) {
    analysis.architecture.issues.push({
      type: 'architecture',
      category: 'modularity',
      severity: 'info',
      line: 1,
      message: `High function count: ${functionCount}`,
      suggestion: 'Consider splitting this file into multiple modules',
      autoFixable: false,
    });
  }

  // Dependency analysis
  const imports = content.match(/^import\s+.+$/gm) || [];
  if (imports.length > 15) {
    analysis.architecture.issues.push({
      type: 'architecture',
      category: 'dependencies',
      severity: 'info',
      line: 1,
      message: `High number of imports: ${imports.length}`,
      suggestion: 'Consider reducing dependencies or splitting into focused modules',
      autoFixable: false,
    });
  }

  // Circular dependency detection (basic)
  const hasDefaultExport = content.includes('export default');
  const hasNamedExports = content.match(/export\s+(const|let|var|function|class)/g);
  if (hasDefaultExport && hasNamedExports && hasNamedExports.length > 5) {
    analysis.architecture.issues.push({
      type: 'architecture',
      category: 'module-design',
      severity: 'info',
      line: 1,
      message: 'Mixed default and named exports',
      suggestion: 'Consider using only named exports for better tree-shaking',
      autoFixable: false,
    });
  }

  // Deep nesting
  lines.forEach((line, index) => {
    const leadingSpaces = line.search(/\S/);
    if (leadingSpaces > 24) {
      analysis.architecture.issues.push({
        type: 'architecture',
        category: 'complexity',
        severity: 'warning',
        line: index + 1,
        message: 'Deeply nested code (>6 levels)',
        suggestion: 'Refactor to reduce nesting - extract functions or use early returns',
        autoFixable: false,
      });
    }
  });
}

/**
 * Code Quality Analysis
 */
function performQualityAnalysis(content, lines, fileExtension, analysis) {
  // Magic numbers
  lines.forEach((line, index) => {
    const magicNumbers = line.match(/\b\d{3,}\b/g);
    if (magicNumbers && !line.includes('//') && !line.includes('const')) {
      analysis.quality.issues.push({
        type: 'quality',
        category: 'maintainability',
        severity: 'info',
        line: index + 1,
        message: 'Magic number detected',
        suggestion: 'Extract magic numbers into named constants',
        autoFixable: false,
      });
    }
  });

  // Duplicate code detection (simple)
  const codeBlocks = new Map();
  for (let i = 0; i < lines.length - 5; i++) {
    const block = lines.slice(i, i + 5).join('\n').trim();
    if (block.length > 50 && !block.startsWith('//') && !block.startsWith('/*')) {
      if (codeBlocks.has(block)) {
        analysis.quality.issues.push({
          type: 'quality',
          category: 'duplication',
          severity: 'warning',
          line: i + 1,
          message: 'Duplicate code block detected',
          suggestion: 'Extract duplicate code into a reusable function',
          autoFixable: false,
        });
      }
      codeBlocks.set(block, i + 1);
    }
  }

  // TODO/FIXME comments
  lines.forEach((line, index) => {
    if (line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)/i)) {
      analysis.quality.issues.push({
        type: 'quality',
        category: 'technical-debt',
        severity: 'info',
        line: index + 1,
        message: 'TODO/FIXME comment found',
        suggestion: 'Address this comment or create a task to track it',
        autoFixable: false,
      });
    }
  });

  // Empty catch blocks
  const emptyCatchPattern = /catch\s*\([^)]*\)\s*{\s*}/g;
  if (emptyCatchPattern.test(content)) {
    lines.forEach((line, index) => {
      if (line.includes('catch') && lines[index + 1] && lines[index + 1].trim() === '}') {
        analysis.quality.issues.push({
          type: 'quality',
          category: 'error-handling',
          severity: 'warning',
          line: index + 1,
          message: 'Empty catch block',
          suggestion: 'Handle errors appropriately or at least log them',
          autoFixable: false,
        });
      }
    });
  }

  // Long functions (approximate)
  let functionStart = -1;
  let braceCount = 0;
  lines.forEach((line, index) => {
    if (line.match(/function\s+\w+|const\s+\w+\s*=\s*\(/)) {
      functionStart = index;
      braceCount = 0;
    }
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;

    if (functionStart >= 0 && braceCount === 0 && index - functionStart > 50) {
      analysis.quality.issues.push({
        type: 'quality',
        category: 'complexity',
        severity: 'warning',
        line: functionStart + 1,
        message: `Long function: ${index - functionStart} lines`,
        suggestion: 'Break down into smaller, more focused functions',
        autoFixable: false,
      });
      functionStart = -1;
    }
  });
}

/**
 * Documentation Analysis
 */
function performDocumentationAnalysis(content, lines, fileExtension, analysis) {
  const isCode = ['js', 'jsx', 'ts', 'tsx', 'py', 'java'].includes(fileExtension);

  if (!isCode) return;

  // Check for file-level documentation
  const hasFileComment = content.trimStart().startsWith('/**') || content.trimStart().startsWith('"""');
  if (!hasFileComment) {
    analysis.documentation.suggestions.push({
      type: 'documentation',
      category: 'file-header',
      severity: 'info',
      line: 1,
      message: 'Missing file-level documentation',
      suggestion: 'Add a file-level comment describing the purpose and contents of this file',
    });
  }

  // Check for function documentation
  lines.forEach((line, index) => {
    const isFunctionDeclaration = line.match(/^(export\s+)?(async\s+)?function\s+\w+|^(export\s+)?const\s+\w+\s*=\s*(async\s*)?\(/);
    if (isFunctionDeclaration) {
      const prevLine = index > 0 ? lines[index - 1].trim() : '';
      const hasDocComment = prevLine.startsWith('/**') || prevLine.startsWith('"""');
      if (!hasDocComment && !line.includes('= () =>')) {
        analysis.documentation.issues.push({
          type: 'documentation',
          category: 'function-docs',
          severity: 'info',
          line: index + 1,
          message: 'Function lacks documentation',
          suggestion: 'Add JSDoc/docstring to describe parameters, return value, and purpose',
          autoFixable: false,
        });
      }
    }
  });

  // Check for complex code without comments
  lines.forEach((line, index) => {
    const complexity = (line.match(/if|else|for|while|switch|case|\?|&&|\|\|/g) || []).length;
    if (complexity > 3) {
      const hasComment = index > 0 && lines[index - 1].trim().startsWith('//');
      if (!hasComment) {
        analysis.documentation.suggestions.push({
          type: 'documentation',
          category: 'code-clarity',
          severity: 'info',
          line: index + 1,
          message: 'Complex logic without explanation',
          suggestion: 'Add a comment explaining the logic flow',
        });
      }
    }
  });
}

/**
 * Calculate metrics
 */
function calculateMetrics(content, lines, analysis) {
  analysis.metrics = {
    totalLines: lines.length,
    codeLines: lines.filter(l => l.trim() && !l.trim().startsWith('//')).length,
    commentLines: lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('*')).length,
    fileSize: Buffer.byteLength(content, 'utf-8'),
    complexityScore: 0,
    maintainabilityIndex: 0,
  };

  // Calculate cyclomatic complexity (approximate)
  const complexityKeywords = (content.match(/if|else|for|while|case|catch|\?|&&|\|\|/g) || []).length;
  analysis.metrics.complexityScore = Math.min(100, complexityKeywords * 2);

  // Maintainability index (simplified)
  const avgLineLength = analysis.metrics.codeLines > 0
    ? content.length / analysis.metrics.codeLines
    : 0;

  analysis.metrics.maintainabilityIndex = Math.max(0, Math.min(100,
    100 - analysis.metrics.complexityScore / 2 - avgLineLength / 5
  ));
}

/**
 * Calculate scores for each dimension
 */
function calculateScores(analysis) {
  const calculateScore = (issues, maxDeduction = 50) => {
    let score = 100;
    issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 15;
      else if (issue.severity === 'error') score -= 10;
      else if (issue.severity === 'warning') score -= 5;
      else if (issue.severity === 'info') score -= 1;
    });
    return Math.max(100 - maxDeduction, score);
  };

  analysis.linting.score = calculateScore(analysis.linting.issues);
  analysis.security.score = calculateScore(analysis.security.issues, 100);
  analysis.architecture.score = calculateScore(analysis.architecture.issues);
  analysis.quality.score = calculateScore(analysis.quality.issues);
}


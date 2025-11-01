import { NextResponse } from 'next/server';
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getFileContent, listFilesInFolder } from '@/lib/s3';
import { analyzeCodeMultiDimensional } from '@/lib/multi-dimensional-analyzer';
import { storeFileVersion } from '@/lib/version-tracker';

/**
 * POST /api/folder-analysis
 * Analyze all files in a folder with multi-dimensional analysis
 */
export const POST = async (req) => {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { folderPath } = await req.json();

    if (!folderPath) {
      return NextResponse.json(
        { error: 'Folder path is required' },
        { status: 400 }
      );
    }

    // Construct the full S3 prefix for the folder
    // folderPath may already include userId or be just the folder name
    let s3FolderPath = folderPath;

    // Check if folderPath already includes userId at the start
    const userIdPrefix = `${user.id}/`;
    const hasUserId = folderPath.startsWith(user.id);

    // Only add userId if it's not already there
    if (!hasUserId) {
      s3FolderPath = `${user.id}/${folderPath}`;
    }

    // Ensure it ends with / for listing purposes
    if (!s3FolderPath.endsWith('/')) {
      s3FolderPath = `${s3FolderPath}/`;
    }

    console.log('Folder analysis - Input path:', folderPath);
    console.log('Folder analysis - S3 path:', s3FolderPath);

    // Get all files in the folder using the corrected path
    let files = await listFilesInFolder(s3FolderPath);
    console.log('Folder analysis - Files found:', files.length);

    // If no files found, try without trailing slash
    if (!files || files.length === 0) {
      const altPath = s3FolderPath.slice(0, -1);
      console.log('Folder analysis - Trying alt path:', altPath);
      files = await listFilesInFolder(altPath);
      console.log('Folder analysis - Alt files found:', files.length);
    }

    // Filter out .foldermarker files
    let analysisFiles = (files || []).filter(file => !file.key.includes('.foldermarker'));
    console.log('Folder analysis - Analysis files after filter:', analysisFiles.length);

    if (!analysisFiles || analysisFiles.length === 0) {
      return NextResponse.json(
        {
          error: `No files found in folder`,
          details: {
            inputPath: folderPath,
            s3Path: s3FolderPath,
            filesFound: files.length,
          }
        },
        { status: 404 }
      );
    }


    // Initialize metrics
    const results = [];
    const folderMetrics = {
      totalFiles: analysisFiles.length,
      analyzedFiles: 0,
      skippedFiles: 0,
      totalIssues: 0,
      criticalIssues: 0,
      warningIssues: 0,
      infoIssues: 0,
      securityIssues: 0,
      architectureIssues: 0,
      qualityIssues: 0,
      documentationIssues: 0,
      passedFiles: 0, // Files with score > 8
      failedFiles: 0, // Files with score <= 8
    };

    // Analyze each file
    for (const file of analysisFiles) {
      try {
        const content = await getFileContent(file.key);
        const fileName = file.key.split('/').pop();
        const fileExtension = fileName.split('.').pop().toLowerCase();

        // Skip non-code files
        const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'css', 'scss', 'html', 'json', 'xml', 'yaml', 'yml'];
        if (!codeExtensions.includes(fileExtension)) {
          folderMetrics.skippedFiles++;
          continue;
        }

        // Analyze the file
        const analysis = analyzeCodeMultiDimensional(content, fileName);

        // Store file version for incremental review
        if (user?.id) {
          await storeFileVersion(user.id, file.key, fileName, content);
        }

        // Calculate quality score (0-10 scale)
        const qualityScore = calculateQualityScore(analysis);
        const isPassed = qualityScore > 8;

        if (isPassed) {
          folderMetrics.passedFiles++;
        } else {
          folderMetrics.failedFiles++;
        }

        results.push({
          fileName,
          filePath: file.key,
          language: getLanguage(fileExtension),
          analysis,
          qualityScore,
          isPassed,
        });

        // Update folder metrics
        folderMetrics.analyzedFiles++;
        folderMetrics.totalIssues += analysis.issues.length;
        folderMetrics.criticalIssues += analysis.issues.filter(i => i.severity === 'critical').length;
        folderMetrics.warningIssues += analysis.issues.filter(i => i.severity === 'warning').length;
        folderMetrics.infoIssues += analysis.issues.filter(i => i.severity === 'info').length;
        folderMetrics.securityIssues += analysis.security.issues.length;
        folderMetrics.architectureIssues += analysis.architecture.issues.length;
        folderMetrics.qualityIssues += analysis.quality.issues.length;
        folderMetrics.documentationIssues += analysis.documentation.issues.length;

      } catch (error) {
        console.error(`Error analyzing file ${file.key}:`, error);
        folderMetrics.skippedFiles++;
      }
    }

    // Calculate overall folder score
    const overallScore = calculateFolderScore(folderMetrics);

    return NextResponse.json({
      success: true,
      files: results,
      metrics: {
        ...folderMetrics,
        overallScore,
        passRate: folderMetrics.analyzedFiles > 0
          ? ((folderMetrics.passedFiles / folderMetrics.analyzedFiles) * 100).toFixed(1)
          : 0,
      },
    });

  } catch (error) {
    console.error('Error in folder analysis:', error);
    return NextResponse.json(
      { error: 'Failed to analyze folder', details: error.message },
      { status: 500 }
    );
  }
};

/**
 * Get language name from file extension
 */
function getLanguage(extension) {
  const languageMap = {
    js: 'JavaScript',
    jsx: 'React',
    ts: 'TypeScript',
    tsx: 'React TypeScript',
    py: 'Python',
    java: 'Java',
    css: 'CSS',
    scss: 'SCSS',
    html: 'HTML',
    json: 'JSON',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
  };
  return languageMap[extension] || extension.toUpperCase();
}

/**
 * Calculate quality score (0-10 scale) based on analysis
 */
function calculateQualityScore(analysis) {
  let score = 10;

  // Deduct points based on issues
  const criticalCount = analysis.issues.filter(i => i.severity === 'critical').length;
  const warningCount = analysis.issues.filter(i => i.severity === 'warning').length;
  const infoCount = analysis.issues.filter(i => i.severity === 'info').length;

  score -= criticalCount * 2; // -2 points per critical
  score -= warningCount * 0.5; // -0.5 points per warning
  score -= infoCount * 0.1; // -0.1 points per info

  // Security issues are critical
  score -= analysis.security.issues.length * 2;

  // Architecture issues impact score
  score -= analysis.architecture.issues.length * 0.5;

  // Quality issues
  score -= analysis.quality.issues.length * 0.3;

  // Documentation issues (minor impact)
  score -= analysis.documentation.issues.length * 0.2;

  return Math.max(0, Math.min(10, parseFloat(score.toFixed(1))));
}

/**
 * Calculate overall folder score
 */
function calculateFolderScore(metrics) {
  if (metrics.analyzedFiles === 0) return 10;

  let score = 10;

  const issuesPerFile = metrics.totalIssues / metrics.analyzedFiles;
  const criticalPerFile = metrics.criticalIssues / metrics.analyzedFiles;
  const securityPerFile = metrics.securityIssues / metrics.analyzedFiles;

  score -= issuesPerFile * 0.5;
  score -= criticalPerFile * 2;
  score -= securityPerFile * 2;

  return Math.max(0, Math.min(10, parseFloat(score.toFixed(1))));
}


import { NextResponse } from 'next/server';
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getLatestFileVersion } from '@/lib/version-tracker';
import { calculateDiff, getChangedLines } from '@/lib/diff-engine';
import { getFileContent } from '@/lib/s3';
import { analyzeCode } from '../route';

/**
 * Perform incremental code review (only on changed lines)
 */
export async function POST(request) {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileKey, fileName } = await request.json();

    if (!fileKey) {
      return NextResponse.json({ error: 'fileKey is required' }, { status: 400 });
    }

    // Get current content
    const currentContent = await getFileContent(fileKey);

    // Get latest stored version
    const previousVersion = await getLatestFileVersion(fileKey);

    if (!previousVersion) {
      return NextResponse.json({
        success: false,
        message: 'No previous version found. Please run a full review first.',
        requiresFullReview: true,
      });
    }

    // Calculate diff
    const diff = calculateDiff(previousVersion.content, currentContent);
    const changedLines = getChangedLines(diff);

    if (changedLines.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes detected',
        fileName: fileName || fileKey.split('/').pop(),
        fileKey,
        content: currentContent,
        changedLines: [],
        analysis: {
          issues: [],
          metrics: {
            totalLines: currentContent.split('\n').length,
            codeLines: 0,
            commentLines: 0,
            blankLines: 0,
            errorCount: 0,
            warningCount: 0,
            infoCount: 0,
            qualityScore: 100,
            incrementalData: {
              linesChanged: 0,
              linesAdded: 0,
              linesDeleted: 0,
              issuesFound: 0,
            },
          },
        },
      });
    }

    // Run analysis only on changed lines
    const fullAnalysis = analyzeCode(currentContent, fileName);

    // Filter issues to only those on or near changed lines
    const changedLineNumbers = new Set(changedLines.map(c => c.lineNumber));
    const incrementalIssues = fullAnalysis.issues.filter(issue => {
      // Include issues on changed lines or within 2 lines of changes
      return Array.from(changedLineNumbers).some(lineNum =>
        Math.abs(issue.line - lineNum) <= 2
      );
    });

    // Store the review
    const prisma = (await import('@/lib/prisma')).default;
    await prisma.review.create({
      data: {
        userId: user.id,
        fileVersionId: previousVersion.id,
        reviewType: 'incremental',
        linesReviewed: changedLines,
        issues: incrementalIssues,
        metrics: {
          ...fullAnalysis.metrics,
          incrementalData: {
            linesChanged: changedLines.length,
            linesAdded: changedLines.filter(c => c.type === 'added').length,
            linesDeleted: changedLines.filter(c => c.type === 'deleted').length,
            issuesFound: incrementalIssues.length,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      reviewType: 'incremental',
      fileName: fileName || fileKey.split('/').pop(),
      fileKey,
      content: currentContent,
      changedLines,
      analysis: {
        issues: incrementalIssues,
        metrics: {
          ...fullAnalysis.metrics,
          incrementalData: {
            linesChanged: changedLines.length,
            linesAdded: changedLines.filter(c => c.type === 'added').length,
            linesDeleted: changedLines.filter(c => c.type === 'deleted').length,
            issuesFound: incrementalIssues.length,
          },
        },
      },
    });
  } catch (error) {
    console.error('Incremental review API error:', error);
    return NextResponse.json(
      { error: 'Failed to perform incremental review', details: error.message },
      { status: 500 }
    );
  }
}


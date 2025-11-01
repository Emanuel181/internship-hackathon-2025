import { NextResponse } from 'next/server';
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getFileVersion, getLatestFileVersion } from '@/lib/version-tracker';
import { generateDiff } from '@/lib/diff-engine';
import prisma from '@/lib/prisma';

/**
 * GET /api/file-version/[id]/diff?compareWith=...
 * Get diff between two file versions
 */
export const GET = async (req, { params }) => {
  try {
    const { user } = await withAuth();
    
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const compareWith = searchParams.get('compareWith'); // 'latest' or version ID

    const currentVersion = await getFileVersion(id);

    if (!currentVersion) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    let compareVersion;

    if (compareWith === 'latest') {
      compareVersion = await getLatestFileVersion(currentVersion.fileKey);
    } else if (compareWith) {
      compareVersion = await getFileVersion(compareWith);
    } else {
      // Compare with previous version
      compareVersion = await prisma.fileVersion.findFirst({
        where: {
          fileKey: currentVersion.fileKey,
          version: { lt: currentVersion.version },
        },
        orderBy: { version: 'desc' },
      });
    }

    if (!compareVersion) {
      return NextResponse.json(
        { error: 'No version to compare with' },
        { status: 404 }
      );
    }

    // Generate diff
    const diff = generateDiff(compareVersion.content, currentVersion.content);

    return NextResponse.json({
      success: true,
      currentVersion: {
        id: currentVersion.id,
        version: currentVersion.version,
        createdAt: currentVersion.createdAt,
        size: currentVersion.size,
      },
      compareVersion: {
        id: compareVersion.id,
        version: compareVersion.version,
        createdAt: compareVersion.createdAt,
        size: compareVersion.size,
      },
      diff,
      stats: {
        linesAdded: diff.filter(d => d.type === 'added').length,
        linesRemoved: diff.filter(d => d.type === 'deleted').length,
        linesChanged: diff.filter(d => d.type === 'modified').length,
      },
    });

  } catch (error) {
    console.error('Error generating diff:', error);
    return NextResponse.json(
      { error: 'Failed to generate diff', details: error.message },
      { status: 500 }
    );
  }
};


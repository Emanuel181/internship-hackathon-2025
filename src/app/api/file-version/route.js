import { NextResponse } from 'next/server';
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getFileVersionHistory, getVersionStats, storeFileVersion } from '@/lib/version-tracker';
import { getFileContent } from '@/lib/s3';

/**
 * GET /api/file-version?fileKey=...
 * Get version history for a specific file
 */
export const GET = async (req) => {
  try {
    const { user } = await withAuth();

    const { searchParams } = new URL(req.url);
    const fileKey = searchParams.get('fileKey');

    if (!fileKey) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      );
    }

    const [history, stats] = await Promise.all([
      getFileVersionHistory(fileKey),
      getVersionStats(fileKey),
    ]);

    return NextResponse.json({
      success: true,
      fileKey,
      history,
      stats,
    });

  } catch (error) {
    console.error('Error fetching file version history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch version history', details: error.message },
      { status: 500 }
    );
  }
};

/**
 * POST /api/file-version
 * Store a new version of a file
 */
export const POST = async (req) => {
  try {
    const { user } = await withAuth();

    const { fileKey, fileName } = await req.json();

    if (!fileKey) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    // Get file content from S3
    const content = await getFileContent(fileKey);

    if (!content) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Store file version
    const result = await storeFileVersion(user.id, fileKey, fileName, content);

    return NextResponse.json({
      success: true,
      version: result.version,
      changed: result.changed,
      ...(result.id && { id: result.id }),
    });

  } catch (error) {
    console.error('Error storing file version:', error);
    return NextResponse.json(
      { error: 'Failed to store file version', details: error.message },
      { status: 500 }
    );
  }
};


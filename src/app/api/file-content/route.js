import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { uploadFileContent } from '@/lib/s3';

/**
 * GET /api/file-content?fileKey=...
 * Get file content from S3
 */
export const GET = async (req) => {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fileKey = searchParams.get('fileKey');

    if (!fileKey) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      );
    }

    // Import here to avoid circular dependencies
    const { getFileContent } = await import('@/lib/s3');

    const content = await getFileContent(fileKey);

    if (content === null || content === undefined) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      fileKey,
      content,
    });
  } catch (error) {
    console.error('Error fetching file content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file content', details: error.message },
      { status: 500 }
    );
  }
};

/**
 * POST /api/file-content
 * Save/update file content in S3
 */
export const POST = async (req) => {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileKey, content, fileName } = await req.json();

    if (!fileKey || content === undefined) {
      return NextResponse.json(
        { error: 'File key and content are required' },
        { status: 400 }
      );
    }

    // Upload updated content to S3
    await uploadFileContent(fileKey, content);

    return NextResponse.json({
      success: true,
      fileKey,
      fileName,
      size: Buffer.byteLength(content, 'utf-8'),
      message: 'File content updated successfully',
    });
  } catch (error) {
    console.error('Error saving file content:', error);
    return NextResponse.json(
      { error: 'Failed to save file content', details: error.message },
      { status: 500 }
    );
  }
};


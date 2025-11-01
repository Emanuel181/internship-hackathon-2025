import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';

/**
 * GET /api/file-version/[id]/content
 * Get the file content for a specific version
 */
export const GET = async (req, { params }) => {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Version ID is required' },
        { status: 400 }
      );
    }

    // Fetch the file version from database
    const fileVersion = await prisma.fileVersion.findUnique({
      where: { id },
    });

    if (!fileVersion) {
      return NextResponse.json(
        { error: 'File version not found' },
        { status: 404 }
      );
    }

    // Check if user owns this version (via userId or fileKey)
    if (fileVersion.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this version' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      id: fileVersion.id,
      fileKey: fileVersion.fileKey,
      content: fileVersion.content,
      version: fileVersion.version,
      createdAt: fileVersion.createdAt,
      size: fileVersion.size,
    });
  } catch (error) {
    console.error('Error fetching file version content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file version content', details: error.message },
      { status: 500 }
    );
  }
};


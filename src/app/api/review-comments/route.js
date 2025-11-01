import { NextResponse } from 'next/server';
import { withAuth } from "@workos-inc/authkit-nextjs";
import prisma from '@/lib/prisma';
import { syncUser } from '@/lib/sync-user';

/**
 * Create a review comment
 */
export async function POST(request) {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure user exists in database
    await syncUser(user);

    const { reviewId, fileKey, fileName, lineNumber, content, type, parentId, issueId } = await request.json();

    if (!fileKey || !content) {
      return NextResponse.json(
        { error: 'fileKey and content are required' },
        { status: 400 }
      );
    }

    // Build data object, only include optional fields if they have values
    const commentData = {
      userId: user.id,
      fileKey,
      fileName: fileName || '',
      lineNumber: lineNumber || 0,
      content,
      type: type || 'comment',
    };

    // Only add optional foreign keys if they have values
    if (reviewId) commentData.reviewId = reviewId;
    if (issueId) commentData.issueId = issueId;
    if (parentId) commentData.parentId = parentId;

    const comment = await prisma.reviewComment.create({
      data: commentData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        replies: true,
      },
    });

    return NextResponse.json({
      success: true,
      comment,
    });
  } catch (error) {
    console.error('Create comment API error:', error);
    return NextResponse.json(
      { error: 'Failed to create comment', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get comments for a file
 */
export async function GET(request) {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get('fileKey');
    const status = searchParams.get('status'); // 'open', 'resolved', 'dismissed'

    if (!fileKey) {
      return NextResponse.json({ error: 'fileKey is required' }, { status: 400 });
    }

    const where = {
      fileKey,
      parentId: null, // Only get top-level comments
    };

    if (status) {
      where.status = status;
    }

    const comments = await prisma.reviewComment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      comments,
      count: comments.length,
    });
  } catch (error) {
    console.error('Get comments API error:', error);
    return NextResponse.json(
      { error: 'Failed to get comments', details: error.message },
      { status: 500 }
    );
  }
}


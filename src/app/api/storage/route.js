import { NextResponse } from 'next/server';
import { withAuth } from "@workos-inc/authkit-nextjs";
import { listUserFiles } from '@/lib/s3';

export const GET = async (req) => {
  try {
    const { user } = await withAuth();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get files from S3
    const files = await listUserFiles(user.id);

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
};


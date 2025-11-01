// src/app/api/upload/route.js
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import { generateUploadUrl } from '@/lib/s3';

export const POST = async (req) => {
    try {
        const { user } = await withAuth();
        
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fileName, folderPath = '' } = await req.json();

        const { uploadUrl, key } = await generateUploadUrl(user.id, fileName, folderPath);
        return NextResponse.json({ uploadUrl, key });
    } catch (error) {
        console.error('Upload URL generation failed:', error);
        return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }
};

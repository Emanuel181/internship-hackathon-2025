// src/app/api/files/route.js
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import { listUserFiles, getFileUrl, getCleanFileName, getFolderPath } from '@/lib/s3';

export const GET = async (req) => {
    try {
        const { user } = await withAuth();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const files = await listUserFiles(user.id);

        const filesWithUrls = await Promise.all(
            files.map(async (file) => ({
                key: file.Key,
                name: getCleanFileName(file.Key), // Use clean filename without timestamps
                folderPath: getFolderPath(file.Key), // Extract folder path
                size: file.Size,
                lastModified: file.LastModified,
                url: await getFileUrl(file.Key),
            }))
        );

        return NextResponse.json({ files: filesWithUrls });
    } catch (error) {
        console.error('Failed to list files:', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
};

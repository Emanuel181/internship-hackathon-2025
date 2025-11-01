// src/app/api/folders/route.js
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import { listUserFiles } from '@/lib/s3';

// GET - List all folders for a user
export const GET = async (req) => {
    try {
        const { user } = await withAuth();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all files to extract folder structure
        const files = await listUserFiles(user.id);

        // Extract unique folders from file keys
        const folders = new Set();
        files.forEach(file => {
            const parts = file.Key.split('/');
            // Remove userId and filename to get folder path
            if (parts.length > 2) {
                const folderPath = parts.slice(1, -1).join('/');
                if (folderPath) {
                    folders.add(folderPath);
                    // Also add parent folders
                    const pathParts = folderPath.split('/');
                    for (let i = 1; i <= pathParts.length; i++) {
                        folders.add(pathParts.slice(0, i).join('/'));
                    }
                }
            }
        });

        return NextResponse.json({
            folders: Array.from(folders).sort()
        });
    } catch (error) {
        console.error('Failed to list folders:', error);
        return NextResponse.json({ error: 'Failed to list folders' }, { status: 500 });
    }
};

// POST - Create a new folder
export const POST = async (req) => {
    try {
        const { user } = await withAuth();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { folderPath } = await req.json();

        if (!folderPath) {
            return NextResponse.json({ error: 'Folder path is required' }, { status: 400 });
        }

        // Folders are virtual in S3, created when files are uploaded to them
        // Just return success
        return NextResponse.json({
            success: true,
            folderPath
        });
    } catch (error) {
        console.error('Failed to create folder:', error);
        return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }
};


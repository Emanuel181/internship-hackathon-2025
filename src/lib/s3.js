// src/lib/s3.js
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Helper function to extract original filename by removing timestamp prefixes
export function getCleanFileName(key) {
    const parts = key.split('/');
    const fileName = parts[parts.length - 1];

    // Remove all timestamp prefixes (13-digit numbers followed by dash)
    // Pattern: 1234567890123-1234567890123-filename.txt -> filename.txt
    return fileName.replace(/^(\d{13}-)+/, '');
}

// Helper function to extract folder path from file key
export function getFolderPath(key) {
    const parts = key.split('/');
    // Remove userId (first part) and filename (last part)
    if (parts.length > 2) {
        return parts.slice(1, -1).join('/');
    }
    return '';
}

export async function generateUploadUrl(userId, fileName, folderPath = '') {
    // Build key with optional folder path
    const folderPrefix = folderPath ? `${folderPath}/` : '';
    const key = `${userId}/${folderPrefix}${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        ContentType: 'application/octet-stream',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return { uploadUrl, key };
}

export async function listUserFiles(userId) {
    const command = new ListObjectsV2Command({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Prefix: `${userId}/`,
    });

    const response = await s3Client.send(command);
    return response.Contents || [];
}

export async function getFileUrl(key) {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteFile(key) {
    const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
    });

    await s3Client.send(command);
    return { success: true };
}

export async function getFileContent(key) {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
        });

        const response = await s3Client.send(command);

        // Convert stream to string
        const stream = response.Body;
        const chunks = [];

        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);

        // Try to convert to text (for text files)
        try {
            return buffer.toString('utf-8');
        } catch (error) {
            // If not text, return base64
            return buffer.toString('base64');
        }
    } catch (error) {
        console.error('Error in getFileContent:', error.message);
        throw error;
    }
}

/**
 * Upload file content directly to S3
 */
export async function uploadFile(key, content) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'application/octet-stream',
    });

    await s3Client.send(command);
    return { success: true, key };
}

/**
 * Upload/update file content directly to S3 (overwrites existing content)
 */
export async function uploadFileContent(key, content) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'application/octet-stream',
    });

    await s3Client.send(command);
    return { success: true, key, size: buffer.length };
}

/**
 * List all files in a folder (recursively)
 */
export async function listFilesInFolder(folderPath) {
    // folderPath format: userId/folder/subfolder
    const command = new ListObjectsV2Command({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Prefix: folderPath.endsWith('/') ? folderPath : `${folderPath}/`,
    });

    const response = await s3Client.send(command);
    return (response.Contents || []).map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
    }));
}

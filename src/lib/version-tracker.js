import { createHash } from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Generate a hash of file content for change detection
 */
export function generateContentHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Store a new version of a file
 */
export async function storeFileVersion(userId, fileKey, fileName, content) {
  try {
    const hash = generateContentHash(content);
    const size = Buffer.byteLength(content, 'utf-8');

    // Get the latest version number for this file
    const latestVersion = await prisma.fileVersion.findFirst({
      where: { fileKey },
      orderBy: { version: 'desc' },
      select: { version: true, hash: true },
    });

    // Check if content has changed
    if (latestVersion && latestVersion.hash === hash) {
      return { changed: false, version: latestVersion.version };
    }

    // Create new version
    const newVersion = (latestVersion?.version || 0) + 1;

    const fileVersion = await prisma.fileVersion.create({
      data: {
        userId,
        fileKey,
        fileName,
        version: newVersion,
        content,
        hash,
        size,
      },
    });

    return { changed: true, version: newVersion, id: fileVersion.id };
  } catch (error) {
    console.error('Error storing file version:', error);
    throw error;
  }
}

/**
 * Get a specific file version
 */
export async function getFileVersion(id) {
  try {
    return await prisma.fileVersion.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error('Error getting file version:', error);
    throw error;
  }
}

/**
 * Get all versions of a file
 */
export async function getFileVersions(fileKey) {
  try {
    return await prisma.fileVersion.findMany({
      where: { fileKey },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        createdAt: true,
        size: true,
        hash: true,
      },
    });
  } catch (error) {
    console.error('Error getting file versions:', error);
    throw error;
  }
}

/**
 * Get the latest version of a file
 */
export async function getLatestFileVersion(fileKey) {
  try {
    return await prisma.fileVersion.findFirst({
      where: { fileKey },
      orderBy: { version: 'desc' },
    });
  } catch (error) {
    console.error('Error getting latest file version:', error);
    throw error;
  }
}

/**
 * Check if file content has changed
 */
export async function hasFileChanged(fileKey, content) {
  try {
    const hash = generateContentHash(content);
    const latestVersion = await prisma.fileVersion.findFirst({
      where: { fileKey },
      orderBy: { version: 'desc' },
      select: { hash: true },
    });

    return !latestVersion || latestVersion.hash !== hash;
  } catch (error) {
    console.error('Error checking file change:', error);
    throw error;
  }
}

/**
 * Get version statistics for a file
 */
export async function getVersionStats(fileKey) {
  try {
    const versions = await prisma.fileVersion.findMany({
      where: { fileKey },
      orderBy: { version: 'asc' },
      select: {
        version: true,
        createdAt: true,
        size: true,
      },
    });

    if (versions.length === 0) {
      return null;
    }

    return {
      totalVersions: versions.length,
      firstCreated: versions[0].createdAt,
      lastModified: versions[versions.length - 1].createdAt,
      currentSize: versions[versions.length - 1].size,
      initialSize: versions[0].size,
    };
  } catch (error) {
    console.error('Error getting version stats:', error);
    throw error;
  }
}

/**
 * Get file version history with details
 */
export async function getFileVersionHistory(fileKey) {
  try {
    return await prisma.fileVersion.findMany({
      where: { fileKey },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        createdAt: true,
        size: true,
        hash: true,
        fileName: true,
      },
    });
  } catch (error) {
    console.error('Error getting file version history:', error);
    throw error;
  }
}

/**
 * Compare two file versions
 */
export async function compareFileVersions(versionId1, versionId2) {
  try {
    const [version1, version2] = await Promise.all([
      prisma.fileVersion.findUnique({ where: { id: versionId1 } }),
      prisma.fileVersion.findUnique({ where: { id: versionId2 } }),
    ]);

    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }

    return {
      version1: {
        id: version1.id,
        version: version1.version,
        createdAt: version1.createdAt,
        size: version1.size,
        content: version1.content,
      },
      version2: {
        id: version2.id,
        version: version2.version,
        createdAt: version2.createdAt,
        size: version2.size,
        content: version2.content,
      },
      sizeDiff: version2.size - version1.size,
      hashChanged: version1.hash !== version2.hash,
    };
  } catch (error) {
    console.error('Error comparing file versions:', error);
    throw error;
  }
}


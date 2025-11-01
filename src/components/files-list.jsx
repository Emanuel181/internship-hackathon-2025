'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Download, FileIcon, Trash2, Upload, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileEditor } from '@/components/file-editor';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Helper function to format file size based on scale
const formatFileSize = (bytes, scale) => {
    switch (scale) {
        case 'bytes':
            return `${bytes} bytes`;
        case 'KB':
            return `${(bytes / 1024).toFixed(2)} KB`;
        case 'MB':
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        case 'GB':
            return `${(bytes / (1024 * 1024 * 1024)).toFixed(4)} GB`;
        default:
            return `${bytes} bytes`;
    }
};

export function FilesList({ refreshTrigger, currentFolder = '' }) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(null);
    const [sizeScale, setSizeScale] = useState('KB');
    const [deleteDialog, setDeleteDialog] = useState({ open: false, file: null });
    const [overwriteDialog, setOverwriteDialog] = useState({ open: false, file: null, newFile: null });
    const [uploading, setUploading] = useState(null);
    const [customFileName, setCustomFileName] = useState('');
    const fileInputRefs = useRef({});
    const [showEditor, setShowEditor] = useState(false);
    const [editingFile, setEditingFile] = useState(null);
    const [fileContent, setFileContent] = useState('');

    // Helper function to get file extension
    const getFileExtension = (filename) => {
        const lastDot = filename.lastIndexOf('.');
        return lastDot === -1 ? '' : filename.substring(lastDot);
    };

    // Helper function to get filename without extension
    const getFileNameWithoutExtension = (filename) => {
        const lastDot = filename.lastIndexOf('.');
        return lastDot === -1 ? filename : filename.substring(0, lastDot);
    };

    // Helper function to build full filename with extension
    const buildFullFileName = (nameWithoutExt, originalFileName) => {
        const ext = getFileExtension(originalFileName);
        return nameWithoutExt.trim() + ext;
    };

    const loadFiles = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/files');
            const data = await response.json();
            setFiles(data.files || []);
        } catch (error) {
            console.error('Failed to load files:', error);
        } finally {
            setLoading(false);
        }
    };

    const openDeleteDialog = (file) => {
        setDeleteDialog({ open: true, file });
    };

    const handleEdit = async (file) => {
        try {
            const response = await fetch(`/api/file-content?fileKey=${encodeURIComponent(file.key)}`);
            if (!response.ok) {
                throw new Error('Failed to load file content');
            }
            const data = await response.json();
            setFileContent(data.content);
            setEditingFile(file);
            setShowEditor(true);
        } catch (error) {
            console.error('Error loading file:', error);
            toast.error('Failed to load file for editing', {
                description: error.message,
            });
        }
    };

    const handleOverwriteClick = (file) => {
        // Trigger file input for this specific file
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
            const newFile = e.target.files?.[0];
            if (newFile) {
                // Set custom filename to the original file name without extension
                setCustomFileName(getFileNameWithoutExtension(file.name));
                setOverwriteDialog({ open: true, file, newFile });
            }
        };
        input.click();
    };

    const handleOverwriteConfirm = async () => {
        const { file, newFile } = overwriteDialog;
        if (!file || !newFile || !customFileName.trim()) {
            toast.error('Invalid filename', {
                description: 'Please provide a valid filename.',
            });
            return;
        }

        // Build full filename with original extension preserved
        const fullFileName = buildFullFileName(customFileName, file.name);

        setOverwriteDialog({ open: false, file: null, newFile: null });
        setUploading(file.key);

        try {
            // Step 1: Delete the old file first
            const deleteResponse = await fetch('/api/files/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: file.key }),
            });

            if (!deleteResponse.ok) {
                throw new Error('Failed to delete old file');
            }

            // Step 2: Get presigned URL for upload with custom filename
            const uploadUrlResponse = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: fullFileName, folderPath: currentFolder }),
            });

            if (!uploadUrlResponse.ok) {
                throw new Error('Failed to get upload URL');
            }

            const { uploadUrl } = await uploadUrlResponse.json();

            // Step 3: Upload new file to S3 with the custom filename
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: newFile,
                headers: {
                    'Content-Type': newFile.type || 'application/octet-stream',
                },
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file to S3');
            }

            await loadFiles();

            toast.success('File overwritten successfully', {
                description: `File has been replaced as ${fullFileName}.`,
            });
        } catch (error) {
            console.error('Overwrite failed:', error);
            toast.error('Failed to overwrite file', {
                description: 'Something went wrong. Please try again.',
            });
        } finally {
            setUploading(null);
            setCustomFileName('');
        }
    };

    const handleDelete = async () => {
        const { file } = deleteDialog;
        if (!file) return;

        setDeleteDialog({ open: false, file: null });
        setDeleting(file.key);

        try {
            const response = await fetch('/api/files/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: file.key }),
            });

            if (!response.ok) {
                throw new Error('Failed to delete file');
            }

            // Remove the file from the list
            setFiles(files.filter(f => f.key !== file.key));

            // Show success toast
            toast.success('File deleted successfully', {
                description: `${file.name} has been permanently deleted from your storage.`,
            });
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error('Failed to delete file', {
                description: 'Something went wrong. Please try again.',
            });
        } finally {
            setDeleting(null);
        }
    };

    useEffect(() => {
        loadFiles();
    }, [refreshTrigger]);

    // Filter files based on current folder
    const filteredFiles = files.filter(file => {
        // If no folder selected (root), show all files
        if (currentFolder === '') {
            return true;
        }
        // Otherwise, show only files in the current folder
        return file.folderPath === currentFolder;
    });

    if (loading) {
        return <p className="text-muted-foreground">Loading files...</p>;
    }

    if (filteredFiles.length === 0) {
        return (
            <Card className="p-8">
                <p className="text-center text-muted-foreground">
                    {currentFolder ? `No files in this folder yet.` : 'No files uploaded yet.'}
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Scale selector */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Size scale:</span>
                <div className="flex gap-1">
                    {['bytes', 'KB', 'MB', 'GB'].map((scale) => (
                        <Button
                            key={scale}
                            variant={sizeScale === scale ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSizeScale(scale)}
                            className="h-8"
                        >
                            {scale}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Files list */}
            <div className="grid gap-4">
                {filteredFiles.map((file) => (
                    <Card
                        key={file.key}
                        className="p-4 cursor-move"
                        draggable={true}
                        onDragStart={(e) => {
                            e.dataTransfer.setData('fileKey', file.key);
                            e.dataTransfer.setData('fileName', file.name);
                        }}
                    >
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <FileIcon className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">{file.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatFileSize(file.size, sizeScale)} • {new Date(file.lastModified).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(file)}
                                    disabled={uploading === file.key || deleting === file.key}
                                    className="text-blue-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                                <Button asChild variant="ghost" size="sm">
                                    <a
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                    </a>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOverwriteClick(file)}
                                    disabled={uploading === file.key || deleting === file.key}
                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {uploading === file.key ? 'Uploading...' : 'Overwrite'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDeleteDialog(file)}
                                    disabled={deleting === file.key || uploading === file.key}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {deleting === file.key ? 'Deleting...' : 'Delete'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, file: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <strong>{deleteDialog.file?.name}</strong>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Overwrite Confirmation Dialog */}
            <AlertDialog open={overwriteDialog.open} onOpenChange={(open) => {
                if (!open) {
                    setOverwriteDialog({ open: false, file: null, newFile: null });
                    setCustomFileName('');
                }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Replace File</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are replacing <strong>{overwriteDialog.file?.name}</strong> with a new file.
                            <br />
                            Choose the filename for the uploaded file:
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2 py-4">
                        <label className="text-sm font-medium">Filename:</label>
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={customFileName}
                                onChange={(e) => setCustomFileName(e.target.value)}
                                className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Enter filename..."
                            />
                            <span className="text-sm text-muted-foreground font-mono">
                                {overwriteDialog.file ? getFileExtension(overwriteDialog.file.name) : ''}
                            </span>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleOverwriteConfirm}
                            disabled={!customFileName.trim()}
                        >
                            Upload File
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* File Editor Modal */}
            {showEditor && editingFile && (
                <FileEditor
                    fileKey={editingFile.key}
                    fileName={editingFile.name}
                    initialContent={fileContent}
                    onClose={() => {
                        setShowEditor(false);
                        setEditingFile(null);
                        setFileContent('');
                    }}
                    onSave={() => {
                        setShowEditor(false);
                        setEditingFile(null);
                        setFileContent('');
                        // Reload files to reflect changes
                        loadFiles();
                    }}
                />
            )}
        </div>
    );
}


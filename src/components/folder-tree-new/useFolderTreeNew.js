import { useState } from 'react';
import { toast } from 'sonner';

const getFileExtension = (fileName) => {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex !== -1 ? fileName.slice(lastDotIndex) : '';
};

const getFileNameWithoutExtension = (fileName) => {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex !== -1 ? fileName.slice(0, lastDotIndex) : fileName;
};

const buildFullFileName = (customName, originalName) => {
    const extension = getFileExtension(originalName);
    return `${customName}${extension}`;
};

export function useFolderTreeNew({ onFolderCreated, onFolderSelect, selectedFolder }) {
    const [expandedFolders, setExpandedFolders] = useState(['root']);
    const [createDialog, setCreateDialog] = useState({ open: false, parentPath: '' });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, folderPath: '', folderName: '' });
    const [newFolderName, setNewFolderName] = useState('');
    const [hoveredFolder, setHoveredFolder] = useState(null);
    const [deleteFileDialog, setDeleteFileDialog] = useState({ open: false, file: null });
    const [overwriteDialog, setOverwriteDialog] = useState({ open: false, file: null, newFile: null });
    const [customFileName, setCustomFileName] = useState('');
    const [uploading, setUploading] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [dragOverFolder, setDragOverFolder] = useState(null);
    const [dropSuccessFolder, setDropSuccessFolder] = useState(null);

    const openCreateDialog = (parentPath) => {
        setCreateDialog({ open: true, parentPath });
        setNewFolderName('');
    };

    const openDeleteDialog = (folderPath, folderName) => {
        setDeleteDialog({ open: true, folderPath, folderName });
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) {
            toast.error('Invalid folder name', {
                description: 'Please provide a valid folder name.',
            });
            return;
        }

        if (!/^[a-zA-Z0-9\-_\s]+$/.test(newFolderName)) {
            toast.error('Invalid folder name', {
                description: 'Folder name can only contain letters, numbers, spaces, hyphens, and underscores.',
            });
            return;
        }

        const parentPath = createDialog.parentPath;
        const newFolderPath = parentPath ? `${parentPath}/${newFolderName.trim()}` : newFolderName.trim();

        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: newFolderPath }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create folder');
            }

            toast.success('Folder created successfully', {
                description: `${newFolderName} has been created.`,
            });

            setCreateDialog({ open: false, parentPath: '' });
            setNewFolderName('');

            if (parentPath) {
                setExpandedFolders(prev => [...new Set([...prev, `folder-${parentPath}`])]);
            } else {
                setExpandedFolders(prev => [...new Set([...prev, 'root'])]);
            }

            onFolderCreated?.();
        } catch (error) {
            console.error('Failed to create folder:', error);
            toast.error('Failed to create folder', {
                description: error.message || 'Something went wrong. Please try again.',
            });
        }
    };

    const handleDeleteFolder = async () => {
        const { folderPath } = deleteDialog;

        try {
            const response = await fetch('/api/folders/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete folder');
            }

            const data = await response.json();

            toast.success('Folder deleted successfully', {
                description: `${deleteDialog.folderName} and ${data.deletedCount} item(s) have been deleted.`,
            });

            setDeleteDialog({ open: false, folderPath: '', folderName: '' });

            if (selectedFolder === folderPath || selectedFolder.startsWith(folderPath + '/')) {
                onFolderSelect('');
            }

            onFolderCreated?.();
        } catch (error) {
            console.error('Failed to delete folder:', error);
            toast.error('Failed to delete folder', {
                description: error.message || 'Something went wrong. Please try again.',
            });
        }
    };

    const handleDeleteFile = async () => {
        const { file } = deleteFileDialog;
        if (!file) return;

        setDeleteFileDialog({ open: false, file: null });
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

            toast.success('File deleted successfully', {
                description: `${file.name} has been permanently deleted from your storage.`,
            });

            onFolderCreated?.();
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error('Failed to delete file', {
                description: 'Something went wrong. Please try again.',
            });
        } finally {
            setDeleting(null);
        }
    };

    const handleOverwriteClick = (file) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
            const newFile = e.target.files?.[0];
            if (newFile) {
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

        const fullFileName = buildFullFileName(customFileName, file.name);
        setOverwriteDialog({ open: false, file: null, newFile: null });
        setUploading(file.key);

        try {
            const deleteResponse = await fetch('/api/files/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: file.key }),
            });

            if (!deleteResponse.ok) {
                throw new Error('Failed to delete old file');
            }

            const uploadUrlResponse = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: fullFileName, folderPath: file.folderPath }),
            });

            if (!uploadUrlResponse.ok) {
                throw new Error('Failed to get upload URL');
            }

            const { uploadUrl } = await uploadUrlResponse.json();

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

            toast.success('File overwritten successfully', {
                description: `File has been replaced as ${fullFileName}.`,
            });

            onFolderCreated?.();
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

    const handleDrop = async (e, targetPath) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolder(null);

        const fileKey = e.dataTransfer.getData('fileKey');
        const fileName = e.dataTransfer.getData('fileName');
        const folderPath = e.dataTransfer.getData('folderPath');
        const folderName = e.dataTransfer.getData('folderName');

        // Handle file drop
        if (fileKey) {
            try {
                const response = await fetch('/api/files/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileKey,
                        targetFolderPath: targetPath
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to move file');
                }

                setDropSuccessFolder(targetPath);
                setTimeout(() => setDropSuccessFolder(null), 1000);

                toast.success('File moved successfully', {
                    description: `${fileName} has been moved to ${targetPath || 'All Files'}.`,
                });

                onFolderCreated?.();
            } catch (error) {
                console.error('Failed to move file:', error);
                toast.error('Failed to move file', {
                    description: 'Something went wrong. Please try again.',
                });
            }
        }
        // Handle folder drop
        else if (folderPath) {
            // Prevent moving a folder into itself or its subfolder
            if (targetPath === folderPath || targetPath.startsWith(folderPath + '/')) {
                toast.error('Invalid move', {
                    description: 'Cannot move a folder into itself or its subfolder.',
                });
                return;
            }

            // Check if folder is already at the target location
            const currentParentPath = folderPath.includes('/')
                ? folderPath.substring(0, folderPath.lastIndexOf('/'))
                : '';

            if (currentParentPath === targetPath) {
                toast.info('Folder is already here', {
                    description: `${folderName} is already in this location.`,
                });
                return;
            }

            try {
                const response = await fetch('/api/folders/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sourceFolderPath: folderPath,
                        targetFolderPath: targetPath
                    }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to move folder');
                }

                const data = await response.json();

                setDropSuccessFolder(targetPath);
                setTimeout(() => setDropSuccessFolder(null), 1000);

                toast.success('Folder moved successfully', {
                    description: `${folderName} has been moved to ${targetPath || 'All Files'}.`,
                });

                // If the selected folder was moved, reset selection
                if (selectedFolder === folderPath || selectedFolder.startsWith(folderPath + '/')) {
                    onFolderSelect('');
                }

                onFolderCreated?.();
            } catch (error) {
                console.error('Failed to move folder:', error);
                toast.error('Failed to move folder', {
                    description: error.message || 'Something went wrong. Please try again.',
                });
            }
        }
    };

    const handleDragOver = (e, folderPath) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolder(folderPath);
    };

    const handleDragLeave = (e, folderPath) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragOverFolder === folderPath) {
            setDragOverFolder(null);
        }
    };

    return {
        // State
        expandedFolders,
        setExpandedFolders,
        createDialog,
        deleteDialog,
        newFolderName,
        hoveredFolder,
        deleteFileDialog,
        overwriteDialog,
        customFileName,
        uploading,
        deleting,
        dragOverFolder,
        dropSuccessFolder,

        // Setters
        setNewFolderName,
        setHoveredFolder,
        setDeleteFileDialog,
        setCreateDialog,
        setDeleteDialog,
        setOverwriteDialog,
        setCustomFileName,

        // Handlers
        openCreateDialog,
        openDeleteDialog,
        handleCreateFolder,
        handleDeleteFolder,
        handleDeleteFile,
        handleOverwriteClick,
        handleOverwriteConfirm,
        handleDrop,
        handleDragOver,
        handleDragLeave,
    };
}


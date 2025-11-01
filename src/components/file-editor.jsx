'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileCode,
  X,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  History as HistoryIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { FileVersionHistory } from '@/components/file-version-history';

export function FileEditor({ fileKey, fileName, initialContent, onClose, onSave }) {
  const [content, setContent] = useState(initialContent || '');
  const [originalContent, setOriginalContent] = useState(initialContent || '');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);

  useEffect(() => {
    setHasChanges(content !== originalContent);
  }, [content, originalContent]);

  const handleSave = async () => {
    if (!hasChanges) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    try {
      // Save the file content
      const response = await fetch('/api/file-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileKey,
          content,
          fileName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save file');
      }

      // Store file version after successful save
      const versionResponse = await fetch('/api/file-version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileKey,
          fileName,
        }),
      });

      if (!versionResponse.ok) {
        console.warn('Failed to store file version');
      }

      setOriginalContent(content);
      setLastSaveTime(new Date());
      toast.success('File saved successfully', {
        description: `${fileName} has been saved and added to version history`,
      });

      if (onSave) {
        onSave({ fileKey, fileName, content });
      }
    } catch (error) {
      console.error('Error saving file:', error);
      toast.error('Failed to save file', {
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        setContent(originalContent);
      }
    }
  };

  const getLanguageFromFileName = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    const languageMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      css: 'css',
      html: 'html',
      json: 'json',
      xml: 'xml',
      sql: 'sql',
      md: 'markdown',
      yml: 'yaml',
      yaml: 'yaml',
    };
    return languageMap[ext] || 'plaintext';
  };

  return (
    <>
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <FileVersionHistory
            fileKey={fileKey}
            fileName={fileName}
            onClose={() => setShowHistory(false)}
            onSelectVersion={(version) => {
              toast.info(`Selected version ${version.version}`);
              setShowHistory(false);
            }}
          />
        </div>
      )}

      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <FileCode className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">{fileName}</h2>
                <p className="text-xs text-muted-foreground font-mono">{fileKey}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Unsaved
                </Badge>
              )}
              {lastSaveTime && !hasChanges && (
                <Badge variant="outline" className="gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span className="text-xs">
                    Saved {lastSaveTime.toLocaleTimeString()}
                  </span>
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(true)}
                className="gap-2"
              >
                <HistoryIcon className="h-4 w-4" />
                History
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (hasChanges) {
                    handleDiscard();
                  } else {
                    onClose();
                  }
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 p-4 font-mono text-sm resize-none border-0 focus:outline-none focus:ring-2 focus:ring-primary rounded-none bg-slate-950 text-slate-50"
              placeholder="Edit file content here..."
              spellCheck="false"
            />
          </div>

          {/* Footer */}
          <div className="border-t p-4 bg-muted/50 text-xs text-muted-foreground flex justify-between">
            <div>
              Language: {getLanguageFromFileName(fileName)} • Size: {(content.length / 1024).toFixed(2)} KB
            </div>
            <div className="flex gap-4">
              <span>Lines: {content.split('\n').length}</span>
              <span>Characters: {content.length}</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  History,
  Clock,
  FileText,
  GitCompare,
  X,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

export function FileVersionHistory({ fileKey, fileName, onClose, onSelectVersion }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedVersions, setSelectedVersions] = useState([]);

  const fetchVersionHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/file-version?fileKey=${encodeURIComponent(fileKey)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch version history');
      }

      const data = await response.json();
      setHistory(data.history);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching version history:', error);
      toast.error('Failed to load version history', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersionHistory();
  }, [fileKey]); // eslint-disable-line react-hooks/exhaustive-deps


  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toggleVersionSelection = (versionId) => {
    if (selectedVersions.includes(versionId)) {
      setSelectedVersions(selectedVersions.filter(id => id !== versionId));
    } else {
      if (selectedVersions.length >= 2) {
        toast.info('You can only compare 2 versions at a time');
        return;
      }
      setSelectedVersions([...selectedVersions, versionId]);
    }
  };

  const compareVersions = () => {
    if (selectedVersions.length !== 2) {
      toast.error('Please select exactly 2 versions to compare');
      return;
    }
    // Navigate to diff view
    window.open(`/api/file-version/${selectedVersions[0]}/diff?compareWith=${selectedVersions[1]}`, '_blank');
  };

  return (
    <Card className="w-full p-6 shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <History className="h-8 w-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold">Version History</h2>
            <p className="text-sm text-muted-foreground font-mono">{fileName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {selectedVersions.length === 2 && (
            <Button onClick={compareVersions} size="sm" className="gap-2">
              <GitCompare className="h-4 w-4" />
              Compare
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.totalVersions}</p>
              <p className="text-xs text-muted-foreground">Total Versions</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm font-bold">{formatDate(stats.firstCreated)}</p>
              <p className="text-xs text-muted-foreground">First Created</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm font-bold">{formatDate(stats.lastModified)}</p>
              <p className="text-xs text-muted-foreground">Last Modified</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm font-bold">{formatSize(stats.currentSize)}</p>
              <p className="text-xs text-muted-foreground">Current Size</p>
            </div>
          </Card>
        </div>
      )}

      {/* Version List */}
      <ScrollArea className="flex-1 pr-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-muted-foreground">No version history found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((version, index) => (
              <Card
                key={version.id}
                className={`p-4 cursor-pointer transition-all ${
                  selectedVersions.includes(version.id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'hover:border-gray-400'
                }`}
                onClick={() => toggleVersionSelection(version.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <Badge className="bg-green-500">Latest</Badge>
                      )}
                      <Badge variant="outline">v{version.version}</Badge>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(version.createdAt)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Size: {formatSize(version.size)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedVersions.includes(version.id) && (
                      <Badge className="bg-blue-500">Selected</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectVersion) {
                          onSelectVersion(version);
                        }
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {selectedVersions.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground text-center">
            {selectedVersions.length === 1
              ? 'Select one more version to compare'
              : 'Click "Compare" to see differences'}
          </p>
        </div>
      )}
    </Card>
  );
}


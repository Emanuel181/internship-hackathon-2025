'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Shield,
  FileSearch,
  Code2,
  Layers,
  History
} from 'lucide-react';
import { toast } from 'sonner';

export function FolderAnalysisPanel({ folderPath, folderName, onClose }) {
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const [progress, setProgress] = useState(0);

  const startAnalysis = async () => {
    setLoading(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      const response = await fetch('/api/folder-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to analyze folder');
      }

      const data = await response.json();
      setAnalysisData(data);

      toast.success('Folder analysis completed', {
        description: `${data.metrics.passedFiles} passed, ${data.metrics.failedFiles} failed`,
      });
    } catch (error) {
      console.error('Folder analysis failed:', error);
      clearInterval(progressInterval);
      toast.error('Folder analysis failed', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFile = (index) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFiles(newExpanded);
  };

  const getScoreBadge = (score) => {
    if (score > 8) {
      return <Badge className="bg-green-500">✓ Pass ({score}/10)</Badge>;
    }
    return <Badge variant="destructive">✗ Fail ({score}/10)</Badge>;
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'border-l-red-600 bg-red-50 dark:bg-red-950/20';
      case 'error':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 'info':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20';
    }
  };

  // Initial state
  if (!loading && !analysisData) {
    return (
      <Card className="w-full p-8 shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <Layers className="h-8 w-8 text-purple-600" />
            <div>
              <h2 className="text-2xl font-bold">Folder Analysis</h2>
              <p className="text-sm text-muted-foreground">{folderName || folderPath}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="text-center py-12">
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
            <div className="flex flex-col items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <FileSearch className="h-6 w-6 text-blue-600" />
              <span className="text-xs font-medium">Linting</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <Shield className="h-6 w-6 text-red-600" />
              <span className="text-xs font-medium">Security</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Code2 className="h-6 w-6 text-green-600" />
              <span className="text-xs font-medium">Quality</span>
            </div>
          </div>
          <Button onClick={startAnalysis} size="lg" className="gap-2">
            <FileSearch className="h-5 w-5" />
            Start Analysis
          </Button>
        </div>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card className="w-full p-8 shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <div>
              <h2 className="text-2xl font-bold">Analyzing...</h2>
              <p className="text-sm text-muted-foreground">{folderName || folderPath}</p>
            </div>
          </div>
        </div>

        <div className="text-center py-12">
          <Progress value={progress} className="h-3 mb-2" />
          <p className="text-sm text-muted-foreground">{progress}% complete</p>
        </div>
      </Card>
    );
  }

  // Results state
  const metrics = analysisData.metrics;

  return (
    <Card className="w-full p-6 shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <Layers className="h-8 w-8 text-purple-600" />
          <div>
            <h2 className="text-2xl font-bold">Analysis Results</h2>
            <p className="text-sm text-muted-foreground">{folderName || folderPath}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={startAnalysis} variant="outline" size="sm">
            Reanalyze
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{metrics.passedFiles}</p>
            <p className="text-sm text-muted-foreground">Passed (&gt;8)</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-red-600">{metrics.failedFiles}</p>
            <p className="text-sm text-muted-foreground">Failed (&le;8)</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold">{metrics.analyzedFiles}</p>
            <p className="text-sm text-muted-foreground">Files Analyzed</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{metrics.passRate}%</p>
            <p className="text-sm text-muted-foreground">Pass Rate</p>
          </div>
        </Card>
      </div>

      {/* Files List */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-3">
          {analysisData.files.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-muted-foreground">No files to analyze</p>
            </div>
          ) : (
            analysisData.files.map((file, fileIndex) => (
              <Card key={fileIndex} className="p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleFile(fileIndex)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {expandedFiles.has(fileIndex) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <div className="flex-1">
                      <p className="font-mono text-sm font-medium">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground">{file.language}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getScoreBadge(file.qualityScore)}
                    <Badge variant="secondary">
                      {file.analysis.issues.length} issues
                    </Badge>
                  </div>
                </div>

                {expandedFiles.has(fileIndex) && file.analysis.issues.length > 0 && (
                  <div className="mt-4 space-y-2 pl-7">
                    {file.analysis.issues.slice(0, 10).map((issue, issueIndex) => (
                      <div
                        key={issueIndex}
                        className={`p-3 rounded-lg border-l-4 ${getSeverityColor(issue.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {issue.category}
                              </Badge>
                              {issue.line && (
                                <span className="text-xs text-muted-foreground">
                                  Line {issue.line}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium mb-1">{issue.message}</p>
                            {issue.suggestion && (
                              <p className="text-xs text-muted-foreground">{issue.suggestion}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {file.analysis.issues.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        +{file.analysis.issues.length - 10} more issues
                      </p>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}


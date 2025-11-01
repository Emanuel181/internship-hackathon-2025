'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  GitCompare,
  TrendingUp,
  X,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

export function IncrementalHistoryAnalysis({ fileKey, fileName, onClose }) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [analyses, setAnalyses] = useState({});
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);

  useEffect(() => {
    const init = async () => {
      await fetchVersionHistory();
    };
    init();
  }, [fileKey]);

  const fetchVersionHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/file-version?fileKey=${encodeURIComponent(fileKey)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch version history');
      }
      const data = await response.json();
      const versions = data.history || [];

      // Check if there are at least 2 versions
      if (versions.length < 2) {
        toast.warning('Insufficient version history', {
          description: 'You need at least 2 versions to compare. Save the file again to create a new version.',
        });
        setHistory(versions);
        setLoading(false);
        return;
      }

      setHistory(versions);

      // Run analysis on each version
      await analyzeAllVersions(versions);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load version history', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const analyzeAllVersions = async (versions) => {
    const results = {};

    for (const version of versions) {
      try {
        const response = await fetch(
          `/api/file-version/${version.id}/content`,
          { method: 'GET' }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.content) {
            // Run incremental analysis on this version
            const analysis = await runIncrementalAnalysis(
              data.content,
              fileName,
              version
            );
            results[version.id] = analysis;
          }
        } else {
          console.warn(`Could not fetch content for version ${version.id}`);
        }
      } catch (error) {
        console.error(`Error analyzing version ${version.id}:`, error);
      }
    }

    setAnalyses(results);
  };

  const runIncrementalAnalysis = async (content, name, version) => {
    try {
      const response = await fetch('/api/code-review/incremental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileKey,
          fileName: name,
          versionId: version.id,
          content,
        }),
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error running analysis:', error);
      return null;
    }
  };

  const toggleVersionSelection = (versionId) => {
    if (selectedVersions.includes(versionId)) {
      setSelectedVersions(selectedVersions.filter(id => id !== versionId));
    } else {
      if (selectedVersions.length >= 2) {
        toast.info('Select up to 2 versions to compare');
        return;
      }
      setSelectedVersions([...selectedVersions, versionId]);
    }
  };

  const compareVersions = async () => {
    if (selectedVersions.length !== 2) {
      toast.error('Please select exactly 2 versions to compare');
      return;
    }

    setComparing(true);
    try {
      const [v1, v2] = selectedVersions;
      const analysis1 = analyses[v1];
      const analysis2 = analyses[v2];

      if (!analysis1 || !analysis2) {
        throw new Error('Analysis data not available for selected versions');
      }

      // Compare the analyses
      const comparison = {
        version1: history.find(h => h.id === v1),
        version2: history.find(h => h.id === v2),
        analysis1,
        analysis2,
        changes: {
          issuesAdded: analysis2.analysis?.issues?.length - (analysis1.analysis?.issues?.length || 0),
          issuesResolved: (analysis1.analysis?.issues?.length || 0) - analysis2.analysis?.issues?.length,
          qualityImproved: (analysis2.analysis?.metrics?.qualityScore || 0) > (analysis1.analysis?.metrics?.qualityScore || 0),
          qualityDelta: (analysis2.analysis?.metrics?.qualityScore || 0) - (analysis1.analysis?.metrics?.qualityScore || 0),
        },
      };

      setComparisonResult(comparison);
      toast.success('Versions compared', {
        description: 'Analysis comparison ready',
      });
    } catch (error) {
      console.error('Error comparing versions:', error);
      toast.error('Failed to compare versions', {
        description: error.message,
      });
    } finally {
      setComparing(false);
    }
  };

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

  return (
    <Card className="w-full p-6 shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <History className="h-8 w-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold">Incremental History Analysis</h2>
            <p className="text-sm text-muted-foreground font-mono">{fileName}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="ml-3">Analyzing version history...</span>
        </div>
      ) : history.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertCircle className="h-12 w-12 text-yellow-600" />
          <div className="text-center">
            <h3 className="font-semibold text-lg mb-2">Insufficient Version History</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              You need at least 2 versions to compare and analyze.
              <br />
              Save your file again to create a new version, then return here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Version List */}
          <ScrollArea className="flex-1 pr-4 mb-6">
            <div className="space-y-3">
              {history.map((version) => {
                const analysis = analyses[version.id];
                const isSelected = selectedVersions.includes(version.id);

                return (
                  <Card
                    key={version.id}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'hover:border-gray-400'
                    }`}
                    onClick={() => toggleVersionSelection(version.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">v{version.version}</Badge>
                          {version.version === history[0].version && (
                            <Badge className="bg-green-500">Latest</Badge>
                          )}
                          {isSelected && (
                            <Badge className="bg-blue-500">Selected</Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          {formatDate(version.createdAt)}
                        </p>

                        {analysis && (
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 text-red-500" />
                              <span>{analysis.analysis?.issues?.length || 0} issues</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-blue-500" />
                              <span>
                                Score: {(analysis.analysis?.metrics?.qualityScore || 0).toFixed(1)}/10
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Info className="h-3 w-3 text-gray-500" />
                              <span>{version.size} bytes</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <span>Analyzed</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>

          {/* Comparison Result */}
          {comparisonResult && (
            <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Version Comparison
              </h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-mono text-xs mb-1">
                    {comparisonResult.version1.version === comparisonResult.version2.version ? 'From' : 'Version'} {comparisonResult.version1.version}
                  </p>
                  <p className="text-xs">{formatDate(comparisonResult.version1.createdAt)}</p>
                  <div className="mt-2">
                    <span className="text-lg font-bold">
                      {comparisonResult.analysis1.analysis?.metrics?.qualityScore?.toFixed(1) || '0'}/10
                    </span>
                    <span className="text-muted-foreground ml-2">quality score</span>
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground font-mono text-xs mb-1">
                    {comparisonResult.version2.version === comparisonResult.version1.version ? 'To' : 'Version'} {comparisonResult.version2.version}
                  </p>
                  <p className="text-xs">{formatDate(comparisonResult.version2.createdAt)}</p>
                  <div className="mt-2">
                    <span className="text-lg font-bold">
                      {comparisonResult.analysis2.analysis?.metrics?.qualityScore?.toFixed(1) || '0'}/10
                    </span>
                    <span className={`text-muted-foreground ml-2 ${
                      comparisonResult.changes.qualityDelta > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {comparisonResult.changes.qualityDelta > 0 ? '+' : ''}
                      {comparisonResult.changes.qualityDelta.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs">
                  Issues: {comparisonResult.analysis1.analysis?.issues?.length || 0} → {comparisonResult.analysis2.analysis?.issues?.length || 0}
                  {comparisonResult.changes.issuesAdded > 0 && (
                    <span className="text-red-600 ml-2">+{comparisonResult.changes.issuesAdded}</span>
                  )}
                  {comparisonResult.changes.issuesResolved > 0 && (
                    <span className="text-green-600 ml-2">-{comparisonResult.changes.issuesResolved}</span>
                  )}
                </p>
              </div>
            </Card>
          )}

          {/* Compare Button */}
          <Button
            onClick={compareVersions}
            disabled={selectedVersions.length !== 2 || comparing}
            className="w-full"
          >
            {comparing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <GitCompare className="h-4 w-4 mr-2" />
                Compare Selected Versions
              </>
            )}
          </Button>
        </>
      )}
    </Card>
  );
}


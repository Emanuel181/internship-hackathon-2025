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
  FileCode,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Zap,
  MessageSquare,
  Wrench,
  Clock,
  TrendingUp,
  GitCompare,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { ReviewComments } from '@/components/review-comments';
import { FileVersionHistory } from '@/components/file-version-history';
import { IncrementalHistoryAnalysis } from '@/components/incremental-history-analysis';

export function CodeReviewPanel({ fileKey, fileName, onClose }) {
  const [loading, setLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [expandedIssues, setExpandedIssues] = useState(new Set());
  const [aiReviewData, setAiReviewData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [expandedAiSections, setExpandedAiSections] = useState(new Set());

  // New feature states
  const [reviewMode, setReviewMode] = useState('full'); // 'full' or 'incremental'
  const [effortEstimation, setEffortEstimation] = useState(null);
  const [availableFixes, setAvailableFixes] = useState({});
  const [showComments, setShowComments] = useState(false);
  const [applyingFix, setApplyingFix] = useState(null);
  const [showIncrementalHistoryAnalysis, setShowIncrementalHistoryAnalysis] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const startReview = async () => {
    // If in incremental mode, open the history analysis instead
    if (reviewMode === 'incremental') {
      setShowIncrementalHistoryAnalysis(true);
      return;
    }

    setLoading(true);
    try {
      // First, store file version for incremental review support
      const versionResponse = await fetch('/api/file-version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey, fileName }),
      });

      // If file version storage fails, warn user
      if (!versionResponse.ok) {
        const errorData = await versionResponse.json();
        console.warn('File version storage failed:', errorData);
      }

      const endpoint = '/api/code-review';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to perform code review');
      }

      const data = await response.json();


      // Validate response data structure
      if (!data.analysis || !data.analysis.issues) {
        throw new Error('Invalid response format from code review API');
      }

      setReviewData(data);

      // Fetch effort estimation
      fetchEffortEstimation(data.analysis.issues);

      // Fetch available fixes
      fetchAvailableFixes(data.analysis.issues);

      toast.success('Code review completed', {
        description: `Found ${data.analysis.metrics.errorCount + data.analysis.metrics.warningCount} issues`,
      });
    } catch (error) {
      console.error('Code review failed:', error);
      toast.error('Code review failed', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEffortEstimation = async (issues) => {
    try {
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issues }),
      });

      if (response.ok) {
        const data = await response.json();
        setEffortEstimation(data);
      }
    } catch (error) {
      console.error('Failed to fetch effort estimation:', error);
    }
  };

  const fetchAvailableFixes = async (issues) => {
    const fixesMap = {};

    for (const issue of issues.slice(0, 20)) { // Limit to avoid too many requests
      try {
        const response = await fetch('/api/fixes/available', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.fixes && data.fixes.length > 0) {
            const issueKey = `${issue.type}-${issue.line}`;
            fixesMap[issueKey] = {
              issue,
              fixes: data.fixes,
            };
          }
        }
      } catch (error) {
        console.error('Failed to fetch fixes for issue:', error);
      }
    }

    setAvailableFixes(fixesMap);
  };

  const applyQuickFix = async (issue, fixId) => {
    setApplyingFix(`${issue.type}-${issue.line}`);
    try {
      const response = await fetch('/api/fixes/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: reviewData.content,
          issue,
          fixId,
          fileKey,
        }),
      });

      if (response.ok) {
        toast.success('Fix applied', {
          description: 'File updated successfully',
        });
        // Refresh review
        setTimeout(() => startReview(), 1000);
      } else {
        throw new Error('Failed to apply fix');
      }
    } catch (error) {
      console.error('Failed to apply fix:', error);
      toast.error('Failed to apply fix');
    } finally {
      setApplyingFix(null);
    }
  };

  const toggleIssue = (index) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedIssues(newExpanded);
  };

  const toggleAiSection = (index) => {
    const newExpanded = new Set(expandedAiSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedAiSections(newExpanded);
  };

  const startAiReview = async () => {
    if (!reviewData) {
      toast.error('Please run static analysis first');
      return;
    }

    setAiLoading(true);
    try {
      const response = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: reviewData.fileName,
          content: reviewData.content,
          staticAnalysis: reviewData.analysis,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503) {
          setAiAvailable(false);
          toast.error('Ollama not available', {
            description: 'Please ensure Ollama is running locally on port 11434',
          });
        } else {
          throw new Error(data.error || 'Failed to perform AI review');
        }
        return;
      }

      setAiReviewData(data.aiReview);
      setAiAvailable(true);

      toast.success('AI analysis completed', {
        description: 'Deep insights generated successfully',
      });
    } catch (error) {
      console.error('AI review failed:', error);
      toast.error('AI review failed', {
        description: error.message,
      });
    } finally {
      setAiLoading(false);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
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

  const getTypeLabel = (type) => {
    const labels = {
      'syntax': 'Syntax',
      'style': 'Style',
      'quality': 'Quality',
      'performance': 'Performance',
      'best-practice': 'Best Practice',
      'complexity': 'Complexity',
      'accessibility': 'Accessibility',
    };
    return labels[type] || type;
  };

  const getQualityColor = (score) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 50) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getEffortIcon = (effort) => {
    const icons = {
      low: '⚡',
      medium: '⏱️',
      high: '🔨',
      'very-high': '🏗️',
    };
    return icons[effort] || '📝';
  };

  return (
    <>
      {showVersionHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <FileVersionHistory
            fileKey={fileKey}
            fileName={fileName}
            onClose={() => setShowVersionHistory(false)}
            onSelectVersion={(version) => {
              toast.info(`Selected version ${version.version}`);
              setShowVersionHistory(false);
            }}
          />
        </div>
      )}

      {showIncrementalHistoryAnalysis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <IncrementalHistoryAnalysis
            fileKey={fileKey}
            fileName={fileName}
            onClose={() => setShowIncrementalHistoryAnalysis(false)}
          />
        </div>
      )}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Code Review</h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVersionHistory(true)}
                className="gap-2"
              >
                <History className="h-4 w-4" />
                History
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
            {/* File Info */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">File</h3>
              <p className="text-sm font-mono bg-muted p-2 rounded">{fileName}</p>
            </div>

            {/* Review Mode Toggle */}
            {!reviewData && !loading && (
              <Card className="p-3 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Review Mode</span>
                  <Badge variant={reviewMode === 'incremental' ? 'default' : 'secondary'}>
                    {reviewMode === 'incremental' ? 'Changes Only' : 'Full File'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={reviewMode === 'full' ? 'default' : 'outline'}
                    onClick={() => setReviewMode('full')}
                    className="flex-1"
                  >
                    <FileCode className="h-3 w-3 mr-1" />
                    Full Review
                  </Button>
                  <Button
                    size="sm"
                    variant={reviewMode === 'incremental' ? 'default' : 'outline'}
                    onClick={() => setReviewMode('incremental')}
                    className="flex-1"
                  >
                    <GitCompare className="h-3 w-3 mr-1" />
                    Incremental
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {reviewMode === 'incremental'
                    ? 'Review only changed code since last version'
                    : 'Review entire file'}
                </p>
              </Card>
            )}

            {/* Start Review Button */}
            {!reviewData && !loading && (
              <Button onClick={startReview} className="w-full" size="lg">
                <FileCode className="mr-2 h-4 w-4" />
                Start {reviewMode === 'incremental' ? 'Incremental' : 'Full'} Review
              </Button>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analyzing code...</p>
              </div>
            )}

            {/* Review Results */}
            {reviewData && (
              <>
                {/* Metrics Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="text-2xl font-bold">{reviewData.analysis.metrics.totalLines}</div>
                    <div className="text-xs text-muted-foreground">Total Lines</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold">{reviewData.analysis.metrics.codeLines}</div>
                    <div className="text-xs text-muted-foreground">Code Lines</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold">{reviewData.analysis.metrics.commentLines}</div>
                    <div className="text-xs text-muted-foreground">Comments</div>
                  </Card>
                  <Card className="p-4">
                    <div className={`text-2xl font-bold ${getQualityColor(reviewData.analysis.metrics.qualityScore)}`}>
                      {reviewData.analysis.metrics.qualityScore}
                    </div>
                    <div className="text-xs text-muted-foreground">Quality Score</div>
                  </Card>
                </div>

                {/* Quality Score Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Code Quality</span>
                    <span className={`font-bold ${getQualityColor(reviewData.analysis.metrics.qualityScore)}`}>
                      {reviewData.analysis.metrics.qualityScore}/100
                    </span>
                  </div>
                  <Progress value={reviewData.analysis.metrics.qualityScore} className="h-2" />
                </div>

                {/* Effort Estimation Summary */}
                {effortEstimation && (
                  <Card className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <h3 className="font-semibold text-sm">Effort Estimation</h3>
                      </div>
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-xl font-bold text-blue-600">
                          {effortEstimation.summary.timeEstimate.formatted}
                        </div>
                        <div className="text-xs text-muted-foreground">Est. Time</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">
                          {effortEstimation.summary.autoFixable}
                        </div>
                        <div className="text-xs text-muted-foreground">Auto-fixable</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-purple-600">
                          {effortEstimation.recommended?.[0]?.priority || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Top Priority</div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Issues Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4 border-l-4 border-l-red-500">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-2xl font-bold">{reviewData.analysis.metrics.errorCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Errors</div>
                  </Card>
                  <Card className="p-4 border-l-4 border-l-yellow-500">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-2xl font-bold">{reviewData.analysis.metrics.warningCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Warnings</div>
                  </Card>
                  <Card className="p-4 border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      <span className="text-2xl font-bold">{reviewData.analysis.metrics.infoCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Info</div>
                  </Card>
                </div>

                {/* Issues List */}
                {reviewData.analysis.issues.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Issues Found ({reviewData.analysis.issues.length})</h3>
                    <div className="space-y-2">
                      {reviewData.analysis.issues.map((issue, index) => (
                        <Card
                          key={index}
                          className={`border-l-4 ${getSeverityColor(issue.severity)} overflow-hidden`}
                        >
                          <button
                            onClick={() => toggleIssue(index)}
                            className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              {getSeverityIcon(issue.severity)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{issue.message}</span>
                                  <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                                    {getTypeLabel(issue.type)}
                                  </span>
                                  {issue.line > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      Line {issue.line}
                                    </span>
                                  )}
                                  {/* Effort Badge */}
                                  {effortEstimation?.estimations?.[index] && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {getEffortIcon(effortEstimation.estimations[index].effort)} {effortEstimation.estimations[index].timeEstimate.average}m
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {expandedIssues.has(index) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                            </div>
                          </button>
                          {expandedIssues.has(index) && (
                            <div className="px-4 pb-4 pt-0 pl-11 space-y-3">
                              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                                <strong className="block mb-1 text-foreground">Suggestion:</strong>
                                {issue.suggestion}
                              </div>

                              {/* Effort Details */}
                              {effortEstimation?.estimations?.[index] && (
                                <div className="text-xs space-y-1 bg-blue-50 dark:bg-blue-950/20 p-3 rounded">
                                  <div className="font-semibold mb-2 flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    Effort Estimation
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary">
                                      {effortEstimation.estimations[index].complexity} complexity
                                    </Badge>
                                    <Badge variant="outline">
                                      {effortEstimation.estimations[index].riskLevel} risk
                                    </Badge>
                                    <Badge>
                                      Priority: {effortEstimation.estimations[index].priority}
                                    </Badge>
                                  </div>
                                </div>
                              )}

                              {/* Available Fixes */}
                              {availableFixes[`${issue.type}-${issue.line}`] && (
                                <div className="space-y-2">
                                  <div className="font-semibold text-xs flex items-center gap-2">
                                    <Wrench className="h-3 w-3" />
                                    Available Fixes
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {availableFixes[`${issue.type}-${issue.line}`].fixes.map((fix) => (
                                      <Button
                                        key={fix.id}
                                        size="sm"
                                        variant="outline"
                                        onClick={() => applyQuickFix(issue, fix.id)}
                                        disabled={applyingFix === `${issue.type}-${issue.line}`}
                                        className="text-xs"
                                      >
                                        {applyingFix === `${issue.type}-${issue.line}` ? (
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        ) : (
                                          <Zap className="h-3 w-3 mr-1" />
                                        )}
                                        {fix.label}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Card className="p-8 text-center border-2 border-green-500 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No Issues Found!</h3>
                    <p className="text-sm text-muted-foreground">
                      Your code looks great! No issues detected during the review.
                    </p>
                  </Card>
                )}

                {/* Re-run Button */}
                <Button onClick={startReview} variant="outline" className="w-full">
                  Run Review Again
                </Button>

                {/* AI Analysis Section */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">AI Analysis</h3>
                    <span className="text-xs text-muted-foreground">(Optional)</span>
                  </div>

                  {!aiReviewData && !aiLoading && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Get deeper insights using Ollama llama3:8b
                      </p>
                      <Button
                        onClick={startAiReview}
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={!aiAvailable}
                      >
                        <Sparkles className="mr-2 h-3 w-3" />
                        Run AI Analysis
                      </Button>
                      {!aiAvailable && (
                        <p className="text-xs text-red-500">
                          Ollama not available on localhost:11434
                        </p>
                      )}
                    </div>
                  )}

                  {aiLoading && (
                    <div className="flex items-center gap-3 py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Analyzing...</span>
                    </div>
                  )}

                  {aiReviewData && (
                    <div className="space-y-3">
                      {/* AI Summary */}
                      <div className="p-3 border rounded-md bg-muted/30">
                        <p className="text-sm leading-relaxed">
                          {aiReviewData.insights.summary}
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {aiReviewData.model}
                        </div>
                      </div>

                      {/* AI Insights Sections */}
                      {aiReviewData.insights.sections.length > 0 && (
                        <div className="space-y-1">
                          {aiReviewData.insights.sections.map((section, index) => (
                            <div key={index} className="border rounded-md overflow-hidden">
                              <button
                                onClick={() => toggleAiSection(index)}
                                className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium">{section.title}</span>
                                  {expandedAiSections.has(index) ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  )}
                                </div>
                              </button>
                              {expandedAiSections.has(index) && (
                                <div className="px-3 pb-3 border-t bg-muted/20">
                                  {section.content && (
                                    <p className="text-xs text-muted-foreground pt-2 pb-2">
                                      {section.content}
                                    </p>
                                  )}
                                  {section.points.length > 0 && (
                                    <ul className="space-y-1.5 pt-1">
                                      {section.points.map((point, pointIndex) => (
                                        <li key={pointIndex} className="text-xs text-muted-foreground flex gap-2">
                                          <span className="shrink-0">•</span>
                                          <span>{point}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Re-run AI Button */}
                      <Button
                        onClick={startAiReview}
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                      >
                        Run Again
                      </Button>
                    </div>
                  )}
                </div>

                {/* Comments Section */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium text-muted-foreground">Discussion</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowComments(!showComments)}
                    >
                      {showComments ? 'Hide' : 'Show'}
                    </Button>
                  </div>

                  {showComments && (
                    <ReviewComments fileKey={fileKey} fileName={fileName} />
                  )}
                </div>
              </>
            )}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
    </>
  );
}


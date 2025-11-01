'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export function CodeReviewPanel({ fileKey, fileName, onClose }) {
  const [loading, setLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [expandedIssues, setExpandedIssues] = useState(new Set());
  const [aiReviewData, setAiReviewData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [expandedAiSections, setExpandedAiSections] = useState(new Set());

  const startReview = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/code-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to perform code review');
      }

      const data = await response.json();
      setReviewData(data);

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Code Review</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
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

            {/* Start Review Button */}
            {!reviewData && !loading && (
              <Button onClick={startReview} className="w-full" size="lg">
                <FileCode className="mr-2 h-4 w-4" />
                Start Code Review
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
                            <div className="px-4 pb-4 pt-0 pl-11">
                              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                                <strong className="block mb-1 text-foreground">Suggestion:</strong>
                                {issue.suggestion}
                              </div>
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
              </>
            )}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}


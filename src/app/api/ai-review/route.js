import { NextResponse } from 'next/server';
import { withAuth } from "@workos-inc/authkit-nextjs";
import { callLLM, getLLMConfig, checkLLMHealth } from '@/lib/llm-config';

/**
 * Generate AI-powered code review using LLM (local or cloud-hosted)
 */
async function generateAIReview(fileName, content, staticAnalysis) {
  try {
    const config = getLLMConfig();

    // Prepare context for the AI
    const prompt = `You are an expert code reviewer. Analyze the following code and provide detailed insights.

File: ${fileName}

Static Analysis Summary:
- Total Lines: ${staticAnalysis.metrics.totalLines}
- Code Lines: ${staticAnalysis.metrics.codeLines}
- Quality Score: ${staticAnalysis.metrics.qualityScore}/100
- Errors: ${staticAnalysis.metrics.errorCount}
- Warnings: ${staticAnalysis.metrics.warningCount}

Code:
\`\`\`
${content}
\`\`\`

Please provide:
1. Overall code quality assessment
2. Architecture and design patterns observations
3. Security considerations
4. Performance optimization suggestions
5. Best practices and maintainability recommendations

Format your response as a structured analysis with clear sections.`;

    // Call LLM API (dynamically selected based on environment)
    const llmResponse = await callLLM(prompt, {
      model: config.model,
      stream: false,
      temperature: 0.7,
    });

    // Parse the AI response
    return {
      rawResponse: llmResponse.response,
      insights: parseAIResponse(llmResponse.response),
      model: llmResponse.model,
      endpoint: llmResponse.endpoint,
      type: llmResponse.type,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('AI review error:', error);
    throw error;
  }
}

/**
 * Parse AI response into structured insights
 */
function parseAIResponse(response) {
  const insights = {
    summary: '',
    sections: [],
  };

  // Extract sections from the response
  const lines = response.split('\n');
  let currentSection = null;
  let summaryText = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section headers (numbered or bold)
    if (trimmed.match(/^\d+\.\s+(.+)/) || trimmed.match(/^\*\*(.+)\*\*/) || trimmed.match(/^#+\s+(.+)/)) {
      if (currentSection) {
        insights.sections.push(currentSection);
      }

      const title = trimmed
        .replace(/^\d+\.\s+/, '')
        .replace(/^\*\*/, '')
        .replace(/\*\*$/, '')
        .replace(/^#+\s+/, '')
        .trim();

      currentSection = {
        title: title,
        content: '',
        points: [],
      };
    } else if (currentSection && trimmed) {
      // Add content to current section
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        currentSection.points.push(trimmed.replace(/^[-*]\s*/, ''));
      } else {
        currentSection.content += (currentSection.content ? ' ' : '') + trimmed;
      }
    } else if (!currentSection && trimmed) {
      // Content before any section headers is treated as summary
      summaryText += (summaryText ? ' ' : '') + trimmed;
    }
  }

  // Add the last section
  if (currentSection) {
    insights.sections.push(currentSection);
  }

  insights.summary = summaryText || 'AI analysis completed successfully.';

  return insights;
}

export async function POST(request) {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileName, content, staticAnalysis } = await request.json();

    if (!fileName || !content || !staticAnalysis) {
      return NextResponse.json(
        { error: 'fileName, content, and staticAnalysis are required' },
        { status: 400 }
      );
    }

    // Check if LLM service is available
    const healthCheck = await checkLLMHealth();

    if (!healthCheck.available) {
      const config = getLLMConfig();
      return NextResponse.json(
        {
          error: 'LLM service is not available',
          message: `Please ensure the LLM service is running at ${config.endpoint}`,
          details: healthCheck.error,
          available: false,
        },
        { status: 503 }
      );
    }

    // Generate AI review
    const aiReview = await generateAIReview(fileName, content, staticAnalysis);

    return NextResponse.json({
      success: true,
      aiReview,
      fileName,
    });
  } catch (error) {
    console.error('AI review API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform AI review',
        details: error.message,
        available: false,
      },
      { status: 500 }
    );
  }
}


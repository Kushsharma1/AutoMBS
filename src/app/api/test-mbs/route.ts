import { NextRequest, NextResponse } from 'next/server';
import { mbsAnalyzer } from '@/libs/mbs-analyzer';
import { PROMPT_TEMPLATES } from '@/libs/prompt-templates';

export async function POST(request: NextRequest) {
  try {
    const { action, testCase, promptUpdates, formData } = await request.json();

    switch (action) {
      case 'test_gold_standard':
        if (!testCase) {
          return NextResponse.json({ error: 'Test case required' }, { status: 400 });
        }
        
        const testResult = mbsAnalyzer.testAgainstGoldStandard(testCase);
        return NextResponse.json({
          success: true,
          result: testResult,
          message: `Accuracy: ${(testResult.accuracy * 100).toFixed(1)}%, Coverage: ${(testResult.coverage * 100).toFixed(1)}%`
        });

      case 'analyze_case':
        if (!formData) {
          return NextResponse.json({ error: 'Form data required' }, { status: 400 });
        }
        
        const analysisResult = mbsAnalyzer.analyzeCase(formData);
        return NextResponse.json({
          success: true,
          result: analysisResult
        });

      case 'update_prompts':
        if (!promptUpdates) {
          return NextResponse.json({ error: 'Prompt updates required' }, { status: 400 });
        }
        
        mbsAnalyzer.updatePrompts(promptUpdates);
        return NextResponse.json({
          success: true,
          message: 'Prompts updated successfully',
          currentVersion: PROMPT_TEMPLATES.version
        });

      case 'get_prompts':
        return NextResponse.json({
          success: true,
          prompts: PROMPT_TEMPLATES
        });

      case 'benchmark_all':
        // Run all available test cases
        const allResults = {};
        const testCases = ['facial_foot_injury']; // Add more as available
        
        for (const testCaseName of testCases) {
          try {
            const result = mbsAnalyzer.testAgainstGoldStandard(testCaseName);
            allResults[testCaseName] = result;
          } catch (error) {
            allResults[testCaseName] = { error: error instanceof Error ? error.message : 'Unknown error' };
          }
        }

        // Calculate overall metrics
        const validResults = Object.values(allResults).filter(r => !('error' in r)) as any[];
        const avgAccuracy = validResults.reduce((sum, r) => sum + r.accuracy, 0) / validResults.length;
        const avgCoverage = validResults.reduce((sum, r) => sum + r.coverage, 0) / validResults.length;

        return NextResponse.json({
          success: true,
          results: allResults,
          summary: {
            totalTests: testCases.length,
            validTests: validResults.length,
            averageAccuracy: avgAccuracy,
            averageCoverage: avgCoverage,
            overallScore: (avgAccuracy + avgCoverage) / 2
          }
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json(
      { error: 'Failed to process test request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'health') {
    return NextResponse.json({
      status: 'healthy',
      version: PROMPT_TEMPLATES.version,
      timestamp: new Date().toISOString()
    });
  }

  return NextResponse.json({
    message: 'MBS Testing API',
    availableActions: [
      'test_gold_standard',
      'analyze_case', 
      'update_prompts',
      'get_prompts',
      'benchmark_all'
    ],
    usage: {
      POST: '/api/test-mbs with action and parameters',
      GET: '/api/test-mbs?action=health for status'
    }
  });
}

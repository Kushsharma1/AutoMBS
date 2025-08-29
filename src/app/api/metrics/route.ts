import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { suggestedCodes, goldStandardCodes, clinicalNotes } = await request.json();

    // Calculate accuracy metrics
    const accuracy = calculateAccuracy(suggestedCodes, goldStandardCodes);
    const coverage = calculateCoverage(suggestedCodes, goldStandardCodes);
    
    // Store metrics in database
    const { data, error } = await supabase
      .from('coding_metrics')
      .insert({
        suggested_codes: suggestedCodes,
        gold_standard_codes: goldStandardCodes,
        accuracy_score: accuracy,
        coverage_score: coverage,
        clinical_notes_hash: hashString(clinicalNotes),
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to store metrics' }, { status: 500 });
    }

    return NextResponse.json({
      accuracy,
      coverage,
      metrics: {
        totalSuggested: suggestedCodes.length,
        totalGoldStandard: goldStandardCodes.length,
        correctSuggestions: accuracy.correctCount,
        missedCodes: coverage.missedCount
      }
    });

  } catch (error: any) {
    console.error('Metrics API error:', error);
    return NextResponse.json({ 
      error: 'Failed to calculate metrics',
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get overall performance metrics
    const { data: metrics, error } = await supabase
      .from('coding_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    // Calculate aggregate statistics
    const totalTests = metrics.length;
    const avgAccuracy = metrics.reduce((sum, m) => sum + m.accuracy_score.percentage, 0) / totalTests;
    const avgCoverage = metrics.reduce((sum, m) => sum + m.coverage_score.percentage, 0) / totalTests;

    return NextResponse.json({
      totalTests,
      averageAccuracy: avgAccuracy,
      averageCoverage: avgCoverage,
      recentTests: metrics.slice(0, 10),
      performanceTrend: calculateTrend(metrics)
    });

  } catch (error: any) {
    console.error('Get metrics error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch metrics',
      details: error.message 
    }, { status: 500 });
  }
}

function calculateAccuracy(suggested: any[], goldStandard: any[]) {
  const goldStandardCodes = new Set(goldStandard.map(code => code.item_number));
  const suggestedCodes = new Set(suggested.map(code => code.item_number));
  
  let correctCount = 0;
  let falsePositives = 0;
  
  suggested.forEach(code => {
    if (goldStandardCodes.has(code.item_number)) {
      correctCount++;
    } else {
      falsePositives++;
    }
  });
  
  const precision = suggested.length > 0 ? correctCount / suggested.length : 0;
  const recall = goldStandard.length > 0 ? correctCount / goldStandard.length : 0;
  const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  
  return {
    correctCount,
    falsePositives,
    precision: precision * 100,
    recall: recall * 100,
    f1Score: f1Score * 100,
    percentage: precision * 100
  };
}

function calculateCoverage(suggested: any[], goldStandard: any[]) {
  const goldStandardCodes = new Set(goldStandard.map(code => code.item_number));
  const suggestedCodes = new Set(suggested.map(code => code.item_number));
  
  let coveredCount = 0;
  let missedCodes: string[] = [];
  
  goldStandard.forEach(code => {
    if (suggestedCodes.has(code.item_number)) {
      coveredCount++;
    } else {
      missedCodes.push(code.item_number);
    }
  });
  
  const coveragePercentage = goldStandard.length > 0 ? (coveredCount / goldStandard.length) * 100 : 0;
  
  return {
    coveredCount,
    missedCount: missedCodes.length,
    missedCodes,
    totalEligible: goldStandard.length,
    percentage: coveragePercentage
  };
}

function calculateTrend(metrics: any[]) {
  if (metrics.length < 2) return 'insufficient_data';
  
  const recent = metrics.slice(0, 10);
  const older = metrics.slice(10, 20);
  
  if (older.length === 0) return 'insufficient_data';
  
  const recentAvg = recent.reduce((sum, m) => sum + m.accuracy_score.percentage, 0) / recent.length;
  const olderAvg = older.reduce((sum, m) => sum + m.accuracy_score.percentage, 0) / older.length;
  
  const improvement = recentAvg - olderAvg;
  
  if (improvement > 5) return 'improving';
  if (improvement < -5) return 'declining';
  return 'stable';
}

function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString();
}

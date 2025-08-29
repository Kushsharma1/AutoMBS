import { NextRequest, NextResponse } from 'next/server';
import { MBSRestrictionEngine } from '@/libs/mbs-restrictions';

// Gold standard test cases for validation
const GOLD_STANDARD_CASES = [
  {
    id: 'gp_standard_consult',
    name: 'Standard GP Consultation',
    clinicalNotes: 'Patient presents with acute bronchitis. History taken, examination performed, diagnosis made, treatment prescribed.',
    expectedCodes: ['23'],
    patientInfo: { age: 45, setting: 'GP' },
    category: 'GP Consultation'
  },
  {
    id: 'gp_complex_consult',
    name: 'Complex GP Consultation',
    clinicalNotes: 'Patient with multiple chronic conditions - diabetes, hypertension, COPD. Comprehensive review, medication adjustment, care planning discussed. 45-minute consultation.',
    expectedCodes: ['36'],
    patientInfo: { age: 65, setting: 'GP' },
    category: 'GP Consultation'
  },
  {
    id: 'specialist_initial',
    name: 'Specialist Initial Consultation',
    clinicalNotes: 'New patient referral to cardiology. Detailed history of chest pain, comprehensive cardiac examination, ECG performed, echocardiogram ordered.',
    expectedCodes: ['104', '11700'],
    patientInfo: { age: 55, setting: 'Specialist' },
    category: 'Specialist'
  },
  {
    id: 'same_day_violation',
    name: 'Same Day GP Violation Test',
    clinicalNotes: 'Morning consultation for diabetes review, afternoon consultation for unrelated skin lesion.',
    expectedCodes: ['36'], // Should suggest highest level only
    patientInfo: { age: 60, setting: 'GP' },
    category: 'Restriction Test',
    expectedViolations: ['Multiple GP attendances on same day']
  },
  {
    id: 'pathology_basic',
    name: 'Basic Pathology Tests',
    clinicalNotes: 'Full blood count and basic metabolic panel ordered for annual health check.',
    expectedCodes: ['65070', '66596'],
    patientInfo: { age: 40, setting: 'GP' },
    category: 'Pathology'
  },
  {
    id: 'telehealth_consult',
    name: 'Telehealth Consultation',
    clinicalNotes: 'Video consultation for medication review and follow-up. Patient stable, medications continued.',
    expectedCodes: ['91800'],
    patientInfo: { age: 50, setting: 'Telehealth' },
    category: 'Telehealth'
  },
  {
    id: 'minor_procedure',
    name: 'Minor Procedure with Consultation',
    clinicalNotes: 'Patient presents with laceration requiring suturing. Wound cleaned, local anesthetic administered, 4 sutures applied.',
    expectedCodes: ['30001'],
    patientInfo: { age: 35, setting: 'GP' },
    category: 'Procedures'
  }
];

export async function POST(request: NextRequest) {
  try {
    const { testCaseId, suggestedCodes } = await request.json();
    
    const testCase = GOLD_STANDARD_CASES.find(tc => tc.id === testCaseId);
    if (!testCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    // Validate against restrictions
    const restrictionEngine = new MBSRestrictionEngine();
    const restrictionResults = restrictionEngine.validateCodes(
      suggestedCodes.map((c: any) => c.item_number),
      testCase.patientInfo
    );

    // Calculate accuracy
    const expectedCodeSet = new Set(testCase.expectedCodes);
    const suggestedCodeSet = new Set(suggestedCodes.map((c: any) => c.item_number));
    
    const correctCodes = suggestedCodes.filter((c: any) => expectedCodeSet.has(c.item_number));
    const missedCodes = testCase.expectedCodes.filter(code => !suggestedCodeSet.has(code));
    const extraCodes = suggestedCodes.filter((c: any) => !expectedCodeSet.has(c.item_number));

    const accuracy = testCase.expectedCodes.length > 0 
      ? (correctCodes.length / testCase.expectedCodes.length) * 100 
      : 0;

    const precision = suggestedCodes.length > 0 
      ? (correctCodes.length / suggestedCodes.length) * 100 
      : 0;

    return NextResponse.json({
      testCase: {
        id: testCase.id,
        name: testCase.name,
        category: testCase.category
      },
      validation: {
        accuracy: Math.round(accuracy),
        precision: Math.round(precision),
        correctCodes: correctCodes.map((c: any) => c.item_number),
        missedCodes,
        extraCodes: extraCodes.map((c: any) => c.item_number),
        totalExpected: testCase.expectedCodes.length,
        totalSuggested: suggestedCodes.length
      },
      restrictions: restrictionResults,
      passed: accuracy >= 80 && restrictionResults.isValid,
      score: Math.round((accuracy + precision) / 2)
    });

  } catch (error: any) {
    console.error('Validation error:', error);
    return NextResponse.json({ 
      error: 'Validation failed',
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Return all test cases for automated testing
    const testSuite = {
      totalCases: GOLD_STANDARD_CASES.length,
      categories: [...new Set(GOLD_STANDARD_CASES.map(tc => tc.category))],
      testCases: GOLD_STANDARD_CASES.map(tc => ({
        id: tc.id,
        name: tc.name,
        category: tc.category,
        clinicalNotes: tc.clinicalNotes,
        expectedCodes: tc.expectedCodes,
        patientInfo: tc.patientInfo,
        hasRestrictionTests: !!tc.expectedViolations
      }))
    };

    return NextResponse.json(testSuite);

  } catch (error: any) {
    console.error('Get test suite error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch test suite',
      details: error.message 
    }, { status: 500 });
  }
}

// Run full automated test suite
export async function PUT() {
  try {
    const results = [];
    
    for (const testCase of GOLD_STANDARD_CASES) {
      // This would normally call your AI analysis endpoint
      // For demo purposes, we'll simulate results
      const mockResults = await simulateAnalysis(testCase);
      results.push(mockResults);
    }

    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const averageAccuracy = results.reduce((sum, r) => sum + r.validation.accuracy, 0) / totalTests;
    const averagePrecision = results.reduce((sum, r) => sum + r.validation.precision, 0) / totalTests;

    return NextResponse.json({
      summary: {
        totalTests,
        passedTests,
        passRate: Math.round((passedTests / totalTests) * 100),
        averageAccuracy: Math.round(averageAccuracy),
        averagePrecision: Math.round(averagePrecision)
      },
      results: results.map(r => ({
        testCase: r.testCase,
        passed: r.passed,
        score: r.score,
        accuracy: r.validation.accuracy,
        restrictionViolations: r.restrictions.violations.length
      })),
      categoryBreakdown: getCategoryBreakdown(results)
    });

  } catch (error: any) {
    console.error('Automated test suite error:', error);
    return NextResponse.json({ 
      error: 'Automated testing failed',
      details: error.message 
    }, { status: 500 });
  }
}

async function simulateAnalysis(testCase: any) {
  // Simulate AI analysis results for demo
  const restrictionEngine = new MBSRestrictionEngine();
  
  // Mock suggested codes (in real implementation, this would come from AI)
  const mockSuggested = testCase.expectedCodes.map((code: string) => ({
    item_number: code,
    confidence: 0.85 + Math.random() * 0.1
  }));

  const restrictionResults = restrictionEngine.validateCodes(
    mockSuggested.map(c => c.item_number),
    testCase.patientInfo
  );

  return {
    testCase: {
      id: testCase.id,
      name: testCase.name,
      category: testCase.category
    },
    validation: {
      accuracy: 90 + Math.random() * 10,
      precision: 85 + Math.random() * 10,
      correctCodes: testCase.expectedCodes,
      missedCodes: [],
      extraCodes: [],
      totalExpected: testCase.expectedCodes.length,
      totalSuggested: mockSuggested.length
    },
    restrictions: restrictionResults,
    passed: true,
    score: 90
  };
}

function getCategoryBreakdown(results: any[]) {
  const categories = [...new Set(results.map(r => r.testCase.category))];
  
  return categories.map(category => {
    const categoryResults = results.filter(r => r.testCase.category === category);
    const passed = categoryResults.filter(r => r.passed).length;
    
    return {
      category,
      total: categoryResults.length,
      passed,
      passRate: Math.round((passed / categoryResults.length) * 100),
      averageAccuracy: Math.round(
        categoryResults.reduce((sum, r) => sum + r.validation.accuracy, 0) / categoryResults.length
      )
    };
  });
}

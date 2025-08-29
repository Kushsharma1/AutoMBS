'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, Cross1Icon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TitleBar } from '@/features/dashboard/TitleBar';

interface AnalysisResult {
  mbs_item: string;
  title: string;
  confidence: number;
  reason: string;
  evidence: string[];
  restrictions_checked: {
    role_ok: boolean;
    setting_ok: boolean;
    same_day_exclusion_ok: boolean;
    must_pair_ok: boolean;
    requires_with_ok: boolean;
  };
  schedule_fee?: number;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  suggestions?: AnalysisResult[];
  timestamp: Date;
}

const ChatPage = () => {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [analysisData, setAnalysisData] = useState<any>(null);

  useEffect(() => {
    // Load initial analysis data from sessionStorage
    const storedAnalysis = sessionStorage.getItem('currentAnalysis');
    const storedResults = sessionStorage.getItem('analysisResults');
    
    if (storedAnalysis && storedResults) {
      const analysis = JSON.parse(storedAnalysis);
      const results = JSON.parse(storedResults);
      
      setAnalysisData(analysis);
      
      // Create initial assistant message with suggestions
      const initialMessage: ChatMessage = {
        role: 'assistant',
        content: `I've analyzed the clinical case for ${analysis.patient.name || 'the patient'} (age ${analysis.patient.age_years}). Based on the clinical details provided, here are my MBS code suggestions:`,
        suggestions: results.items || [],
        timestamp: new Date()
      };
      
      setMessages([initialMessage]);
    } else {
      // Redirect back if no data
      router.push('/records/new');
    }
  }, [router]);

  const handleSendMessage = async () => {
    if (!currentInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: currentInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentInput('');
    setIsLoading(true);

    try {
      // TODO: Call API with follow-up question and context
      // For now, just acknowledge the message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: 'Thank you for the additional information. Let me reconsider the MBS codes based on this update.',
        timestamp: new Date()
      };

      setTimeout(() => {
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 1000);

    } catch (error) {
      console.error('Chat error:', error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleCodeSelection = (mbs_item: string) => {
    const newSelected = new Set(selectedCodes);
    if (newSelected.has(mbs_item)) {
      newSelected.delete(mbs_item);
    } else {
      newSelected.add(mbs_item);
    }
    setSelectedCodes(newSelected);
  };

  const handleFinalizeCodes = () => {
    if (selectedCodes.size === 0) {
      alert('Please select at least one MBS code to finalize.');
      return;
    }

    // Store finalized codes
    const finalizedCodes = Array.from(selectedCodes);
    sessionStorage.setItem('finalizedCodes', JSON.stringify(finalizedCodes));
    
    // Show success toast
    alert(`Codes finalized! Selected ${finalizedCodes.length} MBS codes. PDF generation coming next.`);
    
    // Navigate back to dashboard
    router.push('/dashboard');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-200px)] flex flex-col">
      {/* Header with Finalize Button */}
      <div className="flex justify-between items-center mb-6">
        <TitleBar
          title="MBS Code Analysis"
          description="Review AI suggestions and finalize your MBS codes"
        />
        <Button 
          onClick={handleFinalizeCodes}
          disabled={selectedCodes.size === 0}
          className="ml-4"
        >
          Finalize Codes ({selectedCodes.size})
        </Button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-4 mb-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-4xl ${
              message.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white border'
            } rounded-lg p-4`}>
              <p className="mb-2">{message.content}</p>
              
              {/* Render suggestions if present */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-4 space-y-3">
                  {message.suggestions.map((suggestion) => (
                    <div 
                      key={suggestion.mbs_item}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedCodes.has(suggestion.mbs_item)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleCodeSelection(suggestion.mbs_item)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          <h4 className="font-semibold text-lg">
                            MBS {suggestion.mbs_item}
                          </h4>
                          {selectedCodes.has(suggestion.mbs_item) && (
                            <CheckIcon className="ml-2 h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                            {getConfidenceLabel(suggestion.confidence)} ({Math.round(suggestion.confidence * 100)}%)
                          </span>
                          {suggestion.schedule_fee && (
                            <span className="text-sm font-medium text-gray-600">
                              ${suggestion.schedule_fee}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-700 mb-2">{suggestion.title}</p>
                      <p className="text-sm text-gray-600 mb-2">{suggestion.reason}</p>
                      
                      {suggestion.evidence.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-gray-500 mb-1">Supporting Evidence:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {suggestion.evidence.map((evidence, idx) => (
                              <li key={idx} className="bg-gray-100 px-2 py-1 rounded">"{evidence}"</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Restrictions Status */}
                      <div className="flex space-x-2 text-xs">
                        {Object.entries(suggestion.restrictions_checked).map(([key, value]) => (
                          <span key={key} className={`flex items-center ${value ? 'text-green-600' : 'text-red-600'}`}>
                            {value ? <CheckIcon className="h-3 w-3 mr-1" /> : <Cross1Icon className="h-3 w-3 mr-1" />}
                            {key.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-lg p-4">
              <p className="text-gray-500">Analyzing...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex space-x-2">
        <Input
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask questions or provide additional clinical details..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button 
          onClick={handleSendMessage}
          disabled={isLoading || !currentInput.trim()}
        >
          Send
        </Button>
      </div>
    </div>
  );
};

export default ChatPage;

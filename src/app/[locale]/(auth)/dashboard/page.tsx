'use client';

import { useState, useRef, useEffect } from 'react';
import { FileTextIcon, ClockIcon, ArrowLeftIcon, DownloadIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buttonVariants } from '@/components/ui/buttonVariants';
// Removed imports - using new API approach

type DashboardView = 'home' | 'new-analysis' | 'chat' | 'records';

interface FormData {
  patientName: string;
  age: number | '';
  sex: 'female' | 'male' | 'other' | 'unknown';
  clinicianRole: 'EmergencyPhysician' | 'GP' | 'Specialist' | '';
  clinicalNotes: string;
  uploadedFiles: File[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AnalysisResult {
  items: Array<{
    mbs_item: string;
    title: string;
    confidence: number;
    reason: string;
  }>;
}

// Function to format assistant message with beautiful MBS codes
const formatAssistantMessage = (content: string) => {
  if (!content.includes('CODE:')) {
    return <div className="whitespace-pre-wrap text-sm leading-relaxed">{content}</div>;
  }

  // Parse the codes from the content
  const codeBlocks = content.split(/(?=CODE:)/g).filter(block => block.trim());
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">📋 MBS Code Analysis</h3>
        <p className="text-sm text-gray-600">Based on your clinical notes, here are the most appropriate MBS codes:</p>
      </div>

      {/* Codes Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-700">
            <div>CODE</div>
            <div>CONFIDENCE</div>
            <div>TITLE</div>
            <div>FEE</div>
          </div>
        </div>
        
        {codeBlocks.map((block, index) => {
          const lines = block.trim().split('\n');
          const codeLine = lines.find(line => line.startsWith('CODE:'));
          const titleLine = lines.find(line => line.startsWith('TITLE:'));
          const referenceLine = lines.find(line => line.startsWith('REFERENCE:'));
          const whyLine = lines.find(line => line.startsWith('WHY:'));
          const evidenceStart = lines.findIndex(line => line.startsWith('EVIDENCE:'));
          
          if (!codeLine) return null;
          
          // Extract data
          const codeMatch = codeLine.match(/CODE:\s*(\d+)\s*CONF:\s*([\d.]+)/);
          const code = codeMatch?.[1] || 'N/A';
          const confidence = codeMatch?.[2] ? `${Math.round(parseFloat(codeMatch[2]) * 100)}%` : 'N/A';
          
          const title = titleLine?.replace('TITLE:', '').trim() || 'N/A';
          const feeMatch = referenceLine?.match(/\$[\d.]+/);
          const fee = feeMatch?.[0] || 'N/A';
          
          const why = whyLine?.replace('WHY:', '').trim() || '';
          const evidenceLines = evidenceStart >= 0 ? lines.slice(evidenceStart + 1).filter(line => line.trim()) : [];
          
          return (
            <div key={index} className="border-b border-gray-100 last:border-b-0">
              {/* Code Row */}
              <div className="px-4 py-3 bg-blue-50">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="font-bold text-blue-900 text-lg">{code}</div>
                  <div>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      parseFloat(confidence) >= 80 ? 'bg-green-100 text-green-800' :
                      parseFloat(confidence) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {confidence}
                    </span>
                  </div>
                  <div className="text-gray-800 font-medium">{title.substring(0, 50)}{title.length > 50 ? '...' : ''}</div>
                  <div className="text-green-600 font-bold">{fee}</div>
                </div>
              </div>
              
              {/* Details */}
              <div className="px-4 py-3 space-y-3">
                {/* Full Title */}
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Full Description</span>
                  <p className="text-sm text-gray-800 mt-1">{title}</p>
                </div>
                
                {/* Why */}
                {why && (
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reasoning</span>
                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">{why.substring(0, 200)}{why.length > 200 ? '...' : ''}</p>
                  </div>
                )}
                
                {/* Evidence */}
                {evidenceLines.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Supporting Evidence</span>
                    <div className="mt-1 space-y-1">
                      {evidenceLines.slice(0, 3).map((evidence, idx) => (
                        <div key={idx} className="flex items-start text-sm text-gray-700">
                          <span className="text-blue-500 mr-2 mt-1">•</span>
                          <span>{evidence.replace(/^[•"'\s]+|[•"'\s]+$/g, '')}</span>
                        </div>
                      ))}
                      {evidenceLines.length > 3 && (
                        <div className="text-xs text-gray-500 italic">+ {evidenceLines.length - 3} more evidence items</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

// Records Component
const RecordsComponent = ({ onBack, user }: { onBack: () => void, user: any }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Loading records...');
      
      const response = await fetch('/api/records');
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Data received:', data);
      
      setRecords(data.records || []);
      
    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] p-6">
      <Button
        onClick={onBack}
        className="mb-6 bg-black text-white hover:bg-gray-800"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <h1 className="text-3xl font-bold mb-6">Existing Records</h1>

      {/* LOADING STATE */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Loading records...</p>
        </div>
      )}

      {/* ERROR STATE */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* NO RECORDS STATE */}
      {!loading && !error && records.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">No records found</p>
          <Button onClick={() => onBack()}>
            Create New Analysis
          </Button>
        </div>
      )}

      {/* RECORDS LIST */}
      {!loading && records.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{records.length} Records Found</h2>
          
          {records.map((record, index) => (
            <div key={record.id || index} className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
              {/* Header with Patient Name and Date */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {record.patient_info?.name || record.patient_info?.patientName || `${record.patient_info?.age}yo ${record.patient_info?.sex}`}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {record.patient_info?.age} years old • {record.patient_info?.sex} • {record.patient_info?.clinician_role || record.patient_info?.clinicianRole}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {new Date(record.created_at).toLocaleDateString('en-AU', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(record.created_at).toLocaleTimeString('en-AU', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              
              {/* MBS Codes */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">MBS Codes Generated:</p>
                <div className="flex flex-wrap gap-2">
                  {record.final_codes?.slice(0, 4).map((code: any, idx: number) => (
                    <span key={idx} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                      {code.item_number} ({Math.round(code.confidence * 100)}%)
                    </span>
                  ))}
                  {record.final_codes?.length > 4 && (
                    <span className="text-gray-500 text-sm">+{record.final_codes.length - 4} more</span>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2 border-t border-gray-100">
                <Button 
                  size="sm" 
                  className="bg-black text-white hover:bg-gray-800 flex-1"
                  onClick={() => {
                    sessionStorage.setItem('reopenRecord', JSON.stringify(record));
                    sessionStorage.setItem('cameFromRecords', 'true');
                    window.location.href = '/dashboard?reopen=true';
                  }}
                >
                  Reopen
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  className="flex-1"
                  onClick={async () => {
                    if (confirm('Delete this record permanently?')) {
                      try {
                        const response = await fetch(`/api/records?id=${record.id}`, {
                          method: 'DELETE'
                        });
                        if (response.ok) {
                          loadRecords(); // Reload the list
                          alert('Record deleted successfully');
                        } else {
                          alert('Failed to delete record');
                        }
                      } catch (err) {
                        alert('Delete error');
                      }
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DashboardIndexPage = () => {
  const t = useTranslations('DashboardIndex');
  const { user } = useUser();
  const [currentView, setCurrentView] = useState<DashboardView>('home');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [cameFromRecords, setCameFromRecords] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: ''
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<FormData>({
    patientName: '',
    age: '',
    sex: 'unknown',
    clinicianRole: '',
    clinicalNotes: '',
    uploadedFiles: [],
  });

  const handleInputChange = (field: keyof FormData, value: string | number | File[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleInputChange('uploadedFiles', files);
  };

  const validateForm = () => {
    if (!formData.age || !formData.clinicianRole) {
      showAlert('Missing Required Fields', 'Please fill in Age and Clinician Role (required fields)');
      return false;
    }
    if (!formData.clinicalNotes.trim()) {
      showAlert('Missing Clinical Notes', 'Please provide clinical notes');
      return false;
    }
    return true;
  };

  const streamChatResponse = async (message: string, isInitial = false) => {
    setIsStreaming(true);
    
    let messagesToAdd: ChatMessage[] = [];
    
    if (!isInitial) {
      // For follow-up questions, add user message
      const newUserMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      messagesToAdd.push(newUserMessage);
    }
    
    // Always add assistant message (either initial analysis or response)
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: isInitial ? 'Collecting information...' : '',
      timestamp: new Date()
    };
    
    messagesToAdd.push(assistantMessage);
    setChatMessages(prev => [...prev, ...messagesToAdd]);
    
    try {
      const response = await fetch('/api/chat-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          isInitialAnalysis: isInitial,
          formData: isInitial ? formData : null,
          conversationHistory: chatMessages
        })
      });
      
      if (!response.body) throw new Error('No response body');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsStreaming(false);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.stage) {
                // Update with loading stage
                setChatMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: parsed.stage }
                      : msg
                  )
                );
              } else if (parsed.content !== undefined) {
                // Handle actual content
                if (parsed.isActualResponse) {
                  // Start of actual response, replace loading text
                  setChatMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: '' }
                        : msg
                    )
                  );
                } else {
                  // Append streaming content
                  setChatMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: msg.content + parsed.content }
                        : msg
                    )
                  );
                }
              }
            } catch (e) {
              // Ignore parse errors for streaming
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: 'Sorry, I encountered an error. Please try again.' }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setCurrentView('chat');
    
    // Start streaming analysis
    await streamChatResponse('Initial analysis', true);
    setIsLoading(false);
  };
  
  const handleFollowUpQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    
    await streamChatResponse(newQuestion);
    setNewQuestion('');
  };

  const handleSaveAndGenerateReport = async () => {
    if (!user) {
      showAlert('Authentication Required', 'Please sign in to save records');
      return;
    }

    if (chatMessages.length === 0) {
      showAlert('No Data to Save', 'No chat messages to save');
      return;
    }

    setIsSaving(true);

    try {
      // Extract ALL codes from ALL assistant messages in the conversation
      const allAssistantMessages = chatMessages.filter(msg => msg.role === 'assistant');

      if (allAssistantMessages.length === 0) {
        showAlert('No AI Responses', 'No AI responses found to save');
        return;
      }

      // Parse codes from ALL assistant messages and combine them
      let allCodes: any[] = [];
      const seenCodes = new Set<string>();
      
      allAssistantMessages.forEach(message => {
        const codesFromMessage = parseMBSCodesFromMessage(message.content);
        codesFromMessage.forEach(code => {
          // Avoid duplicates based on item_number
          if (!seenCodes.has(code.item_number)) {
            seenCodes.add(code.item_number);
            allCodes.push(code);
          }
        });
      });

      const finalCodes = allCodes;
      
      console.log('Debug save data:', {
        hasFormData: !!formData,
        hasChatMessages: !!chatMessages,
        chatMessagesLength: chatMessages.length,
        hasFinalCodes: !!finalCodes,
        finalCodesLength: finalCodes.length,
        hasUser: !!user,
        userId: user?.id,
        finalCodes: finalCodes
      });

      // Call the save API
      const response = await fetch('/api/save-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientInfo: formData,
          chatMessages,
          finalCodes,
          userId: user.id,
          userEmail: user.emailAddresses[0]?.emailAddress
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Save failed');
      }

      const result = await response.json();

      // Download PDF if available
      if (result.pdfData) {
        const pdfBytes = Uint8Array.from(atob(result.pdfData), c => c.charCodeAt(0));
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showAlert('Success!', 'Record saved and report generated successfully!');
        // Don't reset immediately - let user see the success message
      } else {
        showAlert('Saved Successfully', 'Record saved successfully! (PDF generation was skipped)');
        // Don't reset immediately - let user see the success message
      }

    } catch (error: any) {
      console.error('Save error:', error);
      showAlert('Save Failed', `Failed to save record and generate report: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const parseMBSCodesFromMessage = (message: string) => {
    const codes = [];
    const codeRegex = /CODE:\s*(\d+)\s*CONF:\s*([\d.]+)/g;
    let match;

    console.log('Parsing message:', message.substring(0, 200) + '...');

    while ((match = codeRegex.exec(message)) !== null) {
      const codeNumber = match[1];
      const confidence = parseFloat(match[2]);
      
      // Extract title, reasoning, and evidence for this code
      const codeSection = message.substring(match.index, message.indexOf('CODE:', match.index + 1) || message.length);
      const titleMatch = codeSection.match(/TITLE:\s*([^\n]+)/);
      const whyMatch = codeSection.match(/WHY:\s*([^\n]+)/);
      const evidenceMatches = codeSection.match(/EVIDENCE:\s*([\s\S]*?)(?=\n\n|\nCODE:|$)/);
      
      const code = {
        item_number: codeNumber,
        title: titleMatch?.[1]?.trim() || 'Unknown',
        confidence,
        reasoning: whyMatch?.[1]?.trim() || 'No reasoning provided',
        evidence: evidenceMatches?.[1]?.split('\n').filter(line => line.trim().startsWith('•')).map(line => line.trim().replace('•', '').trim()) || [],
        schedule_fee: 89.15 // Default fee
      };
      
      codes.push(code);
      console.log('Parsed code:', code);
    }

    // If no codes found, create a default one
    if (codes.length === 0) {
      console.log('No codes found in message, creating default');
      codes.push({
        item_number: '5012',
        title: 'More than ordinary complexity',
        confidence: 0.75,
        reasoning: 'Default code based on consultation complexity',
        evidence: ['Clinical consultation provided'],
        schedule_fee: 89.15
      });
    }

    console.log('Final parsed codes:', codes);
    return codes;
  };

  const resetToHome = () => {
    setCurrentView('home');
    setFormData({
      patientName: '',
      age: '',
      sex: 'unknown',
      clinicianRole: '',
      clinicalNotes: '',
      uploadedFiles: [],
    });
    setAnalysisResult(null);
    setChatMessages([]);
    setCurrentMessage('');
    setNewQuestion('');
  };

  // Custom modal functions
  const showAlert = (title: string, message: string) => {
    setModalState({
      isOpen: true,
      type: 'alert',
      title,
      message
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalState({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm,
      onCancel: () => setModalState(prev => ({ ...prev, isOpen: false }))
    });
  };

  const closeModal = () => {
    const wasSuccessMessage = modalState.title === 'Success!' || modalState.title === 'Saved Successfully';
    setModalState(prev => ({ ...prev, isOpen: false }));
    
    // Reset to home after success message
    if (wasSuccessMessage) {
      resetToHome();
    }
  };
  
  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle reopening saved records
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reopen') === 'true') {
      const recordData = sessionStorage.getItem('reopenRecord');
      const cameFromRecordsFlag = sessionStorage.getItem('cameFromRecords');
      
      if (recordData) {
        try {
          const record = JSON.parse(recordData);
          // Restore form data
          setFormData({
            patientName: record.patient_info.name || record.patient_info.patientName || '',
            age: record.patient_info.age.toString(),
            sex: record.patient_info.sex,
            clinicianRole: record.patient_info.clinician_role || record.patient_info.clinicianRole,
            clinicalNotes: record.patient_info.clinical_notes || record.patient_info.clinicalNotes,
            uploadedFiles: record.patient_info.uploaded_files || []
          });
          
          // Restore chat messages
          setChatMessages(record.chat_messages);
          
          // Set flag if came from records
          setCameFromRecords(cameFromRecordsFlag === 'true');
          
          // Switch to chat view
          setCurrentView('chat');
          
          // Clean up
          sessionStorage.removeItem('reopenRecord');
          sessionStorage.removeItem('cameFromRecords');
          
          // Update URL without reopen parameter
          window.history.replaceState({}, '', '/dashboard');
        } catch (error) {
          console.error('Failed to reopen record:', error);
          sessionStorage.removeItem('reopenRecord');
          sessionStorage.removeItem('cameFromRecords');
        }
      }
    }
  }, []);

  // HOME VIEW
  if (currentView === 'home') {
  return (
      <div className="min-h-[calc(100vh-200px)] flex flex-col">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3">{t('title_bar')}</h1>
          <p className="text-lg text-muted-foreground">{t('title_bar_description')}</p>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full px-4">
            {/* Generate Codes Card */}
            <div className="bg-white rounded-xl border shadow-lg p-8 hover:shadow-xl transition-all duration-200 hover:scale-105">
              <div className="flex items-center mb-6">
                <div className="bg-primary/10 p-4 rounded-xl mr-5">
                  <FileTextIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">{t('generate_card_title')}</h3>
              </div>
              <p className="text-muted-foreground mb-6 text-base leading-relaxed">
                {t('generate_card_description')}
              </p>
              <button
                onClick={() => setCurrentView('new-analysis')}
                className={buttonVariants({ className: 'w-full py-3 text-base font-semibold' })}
              >
                {t('generate_card_button')}
              </button>
            </div>

            {/* Existing Records Card */}
            <div className="bg-white rounded-xl border shadow-lg p-8 hover:shadow-xl transition-all duration-200 hover:scale-105">
              <div className="flex items-center mb-6">
                <div className="bg-blue-50 p-4 rounded-xl mr-5">
                  <ClockIcon className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold">{t('records_card_title')}</h3>
              </div>
              <p className="text-muted-foreground mb-6 text-base leading-relaxed">
                {t('records_card_description')}
              </p>
              <button
                onClick={() => setCurrentView('records')}
                className={buttonVariants({ variant: 'outline', className: 'w-full py-3 text-base font-semibold border-2 hover:bg-gray-50' })}
              >
                {t('records_card_button')}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-12 pb-8 border-t text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} AutoMBS. Built for NexGenAI Hackathon by Kush Sharma.</p>
        </div>
      </div>
    );
  }

  // NEW ANALYSIS FORM VIEW
  if (currentView === 'new-analysis') {
    return (
      <div className="min-h-[calc(100vh-200px)] flex flex-col">
        {/* Header with back button */}
        <div className="mb-8">
          <Button
            onClick={resetToHome}
            className="mb-4 bg-black text-white hover:bg-gray-800"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-3">New MBS Analysis</h1>
            <p className="text-lg text-muted-foreground">Enter patient details and clinical notes to generate Medicare Benefits Schedule codes</p>
          </div>
        </div>

        <div className="flex-1">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Patient Info - Same styling as cards */}
              <div className="bg-white rounded-xl border shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Patient Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="patientName">Patient Name</Label>
                    <Input
                      id="patientName"
                      value={formData.patientName}
                      onChange={(e) => handleInputChange('patientName', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="age">Age *</Label>
                    <Input
                      id="age"
                      type="number"
                      required
                      value={formData.age}
                      onChange={(e) => handleInputChange('age', e.target.value ? Number(e.target.value) : '')}
                      placeholder="Years"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sex">Sex</Label>
                    <select
                      id="sex"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.sex}
                      onChange={(e) => handleInputChange('sex', e.target.value as FormData['sex'])}
                    >
                      <option value="unknown">Unknown</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                  </div>


                </div>

                <div className="mt-4">
                  <Label htmlFor="clinicianRole">Clinician Role *</Label>
                  <select
                    id="clinicianRole"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.clinicianRole}
                    onChange={(e) => handleInputChange('clinicianRole', e.target.value as FormData['clinicianRole'])}
                  >
                    <option value="">Select your role</option>
                    <option value="EmergencyPhysician">Emergency Physician</option>
                    <option value="GP">General Practitioner</option>
                    <option value="Specialist">Specialist</option>
                  </select>
                </div>
              </div>

              {/* Clinical Notes */}
              <div className="bg-white rounded-xl border shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Clinical Notes</h3>
                <div>
                  <Label htmlFor="clinicalNotes">Complete Clinical Documentation *</Label>
                  <Textarea
                    id="clinicalNotes"
                    required
                    value={formData.clinicalNotes}
                    onChange={(e) => handleInputChange('clinicalNotes', e.target.value)}
                    placeholder="Enter complete clinical notes including presenting complaint, history, examination, diagnoses, procedures, investigations, medications, and plan..."
                    rows={8}
                    className="w-full mt-2"
                  />
                </div>
              </div>

              {/* File Upload */}
              <div className="bg-white rounded-xl border shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Supporting Documents</h3>
                <div>
                  <Label htmlFor="fileUpload">Upload Images, PDFs, Test Results (Optional)</Label>
                  <Input
                    id="fileUpload"
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="mt-2"
                  />
                  {formData.uploadedFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {formData.uploadedFiles.map((file, index) => (
                        <div key={index} className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                          {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end pb-8">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="px-8 py-3 text-lg"
                >
                  {isLoading ? 'Analyzing Clinical Notes...' : 'Generate MBS Codes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // CHAT VIEW
  if (currentView === 'chat') {
    return (
      <div className="min-h-[calc(100vh-200px)] flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <div className="flex gap-3 mb-4">
            <Button
              onClick={resetToHome}
              className="bg-black text-white hover:bg-gray-800"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            {cameFromRecords && (
              <Button
                onClick={() => setCurrentView('records')}
                variant="outline"
                className="border-gray-300 hover:bg-gray-50"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Records
              </Button>
            )}
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-3">MBS Analysis Chat</h1>
            <p className="text-lg text-muted-foreground">AI-powered Medicare Benefits Schedule coding assistant</p>
          </div>
        </div>

        <div className="flex-1 flex gap-6">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 bg-white rounded-xl border shadow-lg p-6 overflow-y-auto max-h-[600px]">
              {chatMessages.length === 0 && (
                <div className="text-center text-muted-foreground">
                  <p>Starting analysis...</p>
                </div>
              )}
              
              <div className="space-y-4">
                {chatMessages.map((message) => (
                  <div key={message.id} className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}>
                    <div className={`${
                      message.role === 'user' ? 'max-w-[80%]' : 'max-w-[95%]'
                    } p-4 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      {message.role === 'assistant' && (
                        message.content.includes('...') && !message.content.includes('CODE:') ? (
                          // Loading stage
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                            </div>
                            <span className="text-blue-600 font-medium">{message.content}</span>
                          </div>
                        ) : (
                          // Use beautiful formatting for MBS codes
                          formatAssistantMessage(message.content)
                        )
                      )}
                      
                      {message.role === 'user' && (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}
                      
                      {message.role === 'assistant' && isStreaming && message.content === '' && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Chat Input */}
            <div className="mt-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
              <form onSubmit={handleFollowUpQuestion} className="flex gap-3">
                <Input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Ask a follow-up question about the MBS codes..."
                  disabled={isStreaming}
                  className="flex-1 bg-white border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 px-4 py-3 text-base"
                />
                <Button 
                  type="submit" 
                  disabled={isStreaming || !newQuestion.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {isStreaming ? 'Sending...' : 'Send'}
                </Button>
              </form>
            </div>
          </div>

          {/* Sidebar - Patient Info */}
          <div className="w-80">
            <div className="bg-white rounded-xl border shadow-lg p-6 sticky top-0">
              <h3 className="text-lg font-semibold mb-4">Patient Information</h3>
              
              <div className="space-y-3 text-sm">
                {formData.patientName && (
                  <div><strong>Name:</strong> {formData.patientName}</div>
                )}
                <div><strong>Age:</strong> {formData.age} years</div>
                <div><strong>Sex:</strong> {formData.sex}</div>
                <div><strong>Clinician:</strong> {formData.clinicianRole}</div>
              </div>
              
              <div className="mt-4">
                <strong className="text-sm">Clinical Notes:</strong>
                <div className="mt-2 text-xs text-gray-700 bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
                  {formData.clinicalNotes}
                </div>
              </div>
              
              {formData.uploadedFiles.length > 0 && (
                <div className="mt-4">
                  <strong className="text-sm">Uploaded Files:</strong>
                  <div className="mt-2 space-y-1">
                    {formData.uploadedFiles.map((file, index) => (
                      <div key={index} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                        {file.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Save & Generate Report Button */}
              {chatMessages.length > 0 && !isStreaming && (
                <div className="mt-6 pt-4 border-t">
                  <Button
                    onClick={handleSaveAndGenerateReport}
                    disabled={isSaving}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving & Generating...' : 'Save & Generate Report'}
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    This will save the chat and generate a professional PDF report
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} AutoMBS. Built for NexGenAI Hackathon by Kush Sharma.</p>
        </div>
      </div>
    );
  }

  // RECORDS VIEW (placeholder)
  if (currentView === 'records') {
    return <RecordsComponent onBack={resetToHome} user={user} />;
  }

  return (
    <>
      {/* Custom Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {modalState.title}
            </h3>
            <p className="text-gray-600 mb-6">
              {modalState.message}
            </p>
            <div className="flex gap-3 justify-end">
              {modalState.type === 'confirm' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    modalState.onCancel?.();
                    closeModal();
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button
                className="bg-black text-white hover:bg-gray-800"
                onClick={() => {
                  if (modalState.type === 'confirm') {
                    modalState.onConfirm?.();
                  }
                  closeModal();
                }}
              >
                {modalState.type === 'confirm' ? 'Confirm' : 'OK'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardIndexPage;
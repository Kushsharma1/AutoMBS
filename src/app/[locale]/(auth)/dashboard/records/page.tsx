'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

const RecordsPage = () => {
  const { user } = useUser();
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

  console.log('Render - Loading:', loading, 'Records:', records.length, 'Error:', error);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Existing Records</h1>
      
      {/* DEBUG INFO */}
      <div className="mb-6 p-4 bg-yellow-100 border rounded">
        <h3 className="font-bold">DEBUG INFO:</h3>
        <p>User ID: {user?.id || 'Loading...'}</p>
        <p>Loading: {loading ? 'Yes' : 'No'}</p>
        <p>Records Count: {records.length}</p>
        <p>Error: {error || 'None'}</p>
        <Button onClick={loadRecords} className="mt-2">Reload</Button>
      </div>

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
          <Button onClick={() => window.location.href = '/dashboard'}>
            Create New Analysis
          </Button>
        </div>
      )}

      {/* RECORDS LIST */}
      {!loading && records.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{records.length} Records Found</h2>
          
          {records.map((record, index) => (
            <div key={record.id || index} className="border rounded p-4 bg-white shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{record.title || 'Untitled'}</h3>
                <span className="text-sm text-gray-500">
                  {new Date(record.created_at).toLocaleDateString()}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 mb-2">
                <p><strong>Age:</strong> {record.patient_info?.age} years</p>
                <p><strong>Sex:</strong> {record.patient_info?.sex}</p>
                <p><strong>Setting:</strong> {record.patient_info?.setting}</p>
              </div>
              
              <div className="mb-3">
                <p className="text-sm font-medium mb-1">Clinical Notes:</p>
                <p className="text-sm bg-gray-50 p-2 rounded">
                  {record.patient_info?.clinical_notes?.substring(0, 200)}...
                </p>
              </div>
              
              <div className="mb-3">
                <p className="text-sm font-medium mb-1">Codes:</p>
                <div className="flex flex-wrap gap-2">
                  {record.final_codes?.map((code: any, idx: number) => (
                    <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {code.item_number} ({Math.round(code.confidence * 100)}%)
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  size="sm" 
                  onClick={() => {
                    sessionStorage.setItem('reopenRecord', JSON.stringify(record));
                    window.location.href = '/dashboard?reopen=true';
                  }}
                >
                  Reopen
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={async () => {
                    if (confirm('Delete this record?')) {
                      try {
                        const response = await fetch(`/api/records?id=${record.id}`, {
                          method: 'DELETE'
                        });
                        if (response.ok) {
                          loadRecords(); // Reload the list
                        } else {
                          alert('Failed to delete');
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

export default RecordsPage;
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types
export interface ChatRecord {
  id: string;
  user_id: string;
  title: string;
  patient_info: {
    name?: string;
    age: number;
    sex: string;
    setting: string;
    clinician_role: string;
    clinical_notes: string;
    uploaded_files?: any[];
  };
  chat_messages: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }[];
  final_codes: {
    item_number: string;
    title: string;
    confidence: number;
    reasoning: string;
    evidence: string[];
    schedule_fee?: number;
  }[];
  report_generated: boolean;
  report_url?: string;
  created_at: string;
  updated_at: string;
}

// Database operations
export class DatabaseService {
  static async createChatRecord(userId: string, patientInfo: any, chatMessages: any[], finalCodes: any[]) {
    const { data, error } = await supabase
      .from('chat_records')
      .insert({
        user_id: userId,
        title: `${patientInfo.age}yo ${patientInfo.sex} - ${patientInfo.setting}`,
        patient_info: patientInfo,
        chat_messages: chatMessages,
        final_codes: finalCodes,
        report_generated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getChatRecords(userId: string) {
    const { data, error } = await supabase
      .from('chat_records')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async getChatRecord(recordId: string, userId: string) {
    const { data, error } = await supabase
      .from('chat_records')
      .select('*')
      .eq('id', recordId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateChatRecord(recordId: string, updates: Partial<ChatRecord>) {
    const { data, error } = await supabase
      .from('chat_records')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteChatRecord(recordId: string, userId: string) {
    const { error } = await supabase
      .from('chat_records')
      .delete()
      .eq('id', recordId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  static async markReportGenerated(recordId: string, reportUrl: string) {
    const { data, error } = await supabase
      .from('chat_records')
      .update({
        report_generated: true,
        report_url: reportUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Initialize database tables
export async function initializeDatabase() {
  // This would typically be done via Supabase SQL editor
  // But we can also create tables programmatically if needed
  console.log('Database initialized - tables should be created via Supabase dashboard');
}
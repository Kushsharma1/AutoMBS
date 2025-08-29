import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a server-side Supabase client that can bypass RLS when needed
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create an authenticated client for the current user
export async function createAuthenticatedSupabaseClient() {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('User not authenticated');
  }

  // For now, we'll use the service client and manually check user ID
  // In production, you'd want to use JWT tokens properly
  return {
    client: supabaseServer,
    userId
  };
}

// Database operations with proper authentication
export class AuthenticatedDatabaseService {
  static async createChatRecord(patientInfo: any, chatMessages: any[], finalCodes: any[]) {
    const { client, userId } = await createAuthenticatedSupabaseClient();
    
    const { data, error } = await client
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

  static async getChatRecords() {
    const { client, userId } = await createAuthenticatedSupabaseClient();
    
    const { data, error } = await client
      .from('chat_records')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async getChatRecord(recordId: string) {
    const { client, userId } = await createAuthenticatedSupabaseClient();
    
    const { data, error } = await client
      .from('chat_records')
      .select('*')
      .eq('id', recordId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateChatRecord(recordId: string, updates: any) {
    const { client, userId } = await createAuthenticatedSupabaseClient();
    
    const { data, error } = await client
      .from('chat_records')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteChatRecord(recordId: string) {
    const { client, userId } = await createAuthenticatedSupabaseClient();
    
    const { error } = await client
      .from('chat_records')
      .delete()
      .eq('id', recordId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  static async markReportGenerated(recordId: string, reportUrl: string) {
    const { client, userId } = await createAuthenticatedSupabaseClient();
    
    const { data, error } = await client
      .from('chat_records')
      .update({
        report_generated: true,
        report_url: reportUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

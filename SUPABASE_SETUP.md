# Supabase Setup for AutoMBS

This guide will help you set up Supabase for the AutoMBS project.

## Option 1: Using Supabase Cloud (Recommended for Hackathon)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" and sign up/sign in
3. Click "New Project"
4. Choose your organization
5. Name your project "AutoMBS"
6. Set a strong database password
7. Choose your region (closest to you)
8. Click "Create new project"

### 2. Get Your Project Keys

Once your project is created:

1. Go to Settings → API
2. Copy the following values:
   - **Project URL** (starts with https://xxx.supabase.co)
   - **anon/public key** (starts with eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9)
   - **service_role key** (starts with eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9) - **Keep this secret!**

### 3. Update Environment Variables

Update your `.env.local` file:

```env
# Replace with your actual Supabase values
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 4. Run the Database Schema

1. Go to your Supabase Dashboard
2. Click on "SQL Editor" in the sidebar
3. Click "New Query"
4. Copy and paste the contents of `supabase/schema.sql`
5. Click "Run" to execute the schema

## Option 2: Local Development with Supabase CLI

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Initialize and Start Local Supabase

```bash
# Initialize Supabase in your project
supabase init

# Start local Supabase (requires Docker)
supabase start
```

### 3. Apply Database Schema

```bash
# Apply the schema to your local database
supabase db reset
```

### 4. Get Local Environment Variables

After starting, you'll see output like:

```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
JWT secret: your-jwt-secret
anon key: your-anon-key
service_role key: your-service-role-key
```

Update your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
```

## Database Schema Overview

The schema includes:

- **coding_records**: Stores clinical notes, AI suggestions, and confirmed codes
- **mbs_codes**: Reference table for MBS codes with descriptions and fees
- **coding_sessions**: Tracks user workflow sessions

## Testing the Setup

1. Restart your Next.js development server:
   ```bash
   npm run dev
   ```

2. Check the browser console for any Supabase connection errors

3. You can test the connection by going to your Supabase Studio and checking if the tables were created successfully

## Next Steps

Once Supabase is set up, you can:

1. Create forms to input clinical notes
2. Build the AI integration for code suggestions
3. Implement the dashboard to view coding records
4. Add user authentication integration with Clerk + Supabase RLS

# Smart Interview - Frontend

Next.js 15 frontend for the Smart Interview application. Provides a full-stack UI for AI-powered interview practice with support for English, Spanish, and Arabic.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: Custom UI components (shadcn/ui style)
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **State Management**: Zustand
- **Icons**: Lucide React

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/           # Login page
│   │   │   └── signup/          # Signup page
│   │   ├── (dashboard)/
│   │   │   ├── setup/           # Resume upload & config
│   │   │   ├── dashboard/       # Main dashboard
│   │   │   └── interview/       # Interview session
│   │   ├── api/
│   │   │   ├── parse-resume/    # Resume parsing endpoint
│   │   │   ├── generate-questions/  # Question generation
│   │   │   └── interview/       # Interview API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx             # Landing page
│   ├── components/
│   │   └── ui/                  # Reusable UI components
│   ├── lib/
│   │   ├── supabase/            # Supabase client config
│   │   └── utils.ts             # Utility functions
│   └── types/
│       └── database.ts          # TypeScript types
├── public/                      # Static assets
├── .env.local.example           # Environment variables template
├── SUPABASE_SETUP.md           # Supabase setup instructions
└── package.json
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Set Up Supabase

Follow the detailed instructions in `../SUPABASE_SETUP.md` to:
- Create a Supabase project
- Set up database tables
- Configure storage buckets
- Enable authentication

### 3. Configure Environment Variables

All environment variables are in the **root `.env` file**:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
LLM_PROVIDER=huggingface
LLM_API_BASE=https://router.huggingface.co/v1
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct:fastest
LLM_API_KEY=your_huggingface_token
ELEVEN_API=your_elevenlabs_key
MONGODB_URI=your_mongodb_atlas_uri
MONGODB_DB=smart_interview
S3_BUCKET=your_recordings_bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
```

The frontend automatically reads `NEXT_PUBLIC_*` variables from this file.

### 4. Run the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Features

### Implemented ✅

1. **Authentication System**
   - Email/password signup and login
   - Supabase Auth integration
   - Protected routes
   - Session management

2. **User Onboarding**
   - Resume upload (PDF)
   - Language selection (English/Spanish/Arabic)
   - Field detection display
   - Profile creation

3. **Dashboard**
   - User profile display
   - Interview language indicator
   - Detected field showcase
   - Start interview button

4. **Interview Session**
   - Microphone permission request (Voice mode)
   - Permission error handling

5. **UI Components**
   - Button, Card, Input, Label, Select
   - Consistent design system
   - Dark mode support (via Tailwind)
   - Responsive layouts

### Pending Integration 🔄

Your teammates need to implement:

1. **Resume Parsing** (`/api/parse-resume`)
   - Connect to Python RAG backend
   - Parse PDF and extract sections
   - Detect candidate's field using ML
   - Store parsed data in database

2. **Question Generation** (`/api/generate-questions`)
   - Call RAG API for technical questions
   - Fetch behavioral questions from database
   - Return combined question set

3. **Interview Logic** (`/api/interview`)
   - ElevenLabs TTS for question audio
   - Speech-to-text for voice responses
   - Follow-up question generation
   - Session data storage

## API Routes

### POST `/api/parse-resume`

Parses uploaded resume and detects candidate's field.

**Request:**
```typescript
FormData {
  file: File (PDF)
  user_id: string
}
```

**Response:**
```typescript
{
  field: string
  parsed_data: {
    sections: string[]
    chunks: any[]
  }
}
```

### POST `/api/generate-questions`

Generates interview questions based on resume and field.

**Request:**
```typescript
{
  userId: string
  field: string
  language: "english" | "spanish" | "arabic"
}
```

**Response:**
```typescript
{
  questions: string[]
}
```

### POST `/api/interview`

Processes interview responses and generates follow-ups.

**Request:**
```typescript
{
  question: string
  answer: string
  userId: string
  language: "english" | "spanish" | "arabic"
}
```

**Response:**
```typescript
{
  followup_question: string
  audio_url?: string
}
```

## Database Schema

See `src/types/database.ts` for TypeScript definitions.

### Tables

**profiles**
- `id` (UUID)
- `user_id` (UUID, FK to auth.users)
- `full_name` (TEXT)
- `field` (TEXT)
- `language_preference` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**resumes**
- `id` (UUID)
- `user_id` (UUID, FK to auth.users)
- `file_path` (TEXT)
- `parsed_data` (JSONB)
- `detected_field` (TEXT)
- `upload_date` (TIMESTAMP)

**interview_sessions**
- `id` (UUID)
- `user_id` (UUID, FK to auth.users)
- `session_date` (TIMESTAMP)
- `questions` (JSONB)
- `answers` (JSONB)
- `feedback` (JSONB)
- `created_at` (TIMESTAMP)

## Development Notes

### Mock Data

The API routes currently return mock data. Replace with actual backend calls:

```typescript
// Current (mock):
const mockField = detectFieldFromResume(file.name);

// Production:
const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL;
const response = await fetch(`${pythonApiUrl}/parse-resume`, {
  method: "POST",
  body: formData,
});
const { field, parsed_data } = await response.json();
```

### Speech Input

The interview page uses the browser Speech Recognition API for optional answer dictation.
Ensure HTTPS in production for microphone permissions to work.

## Deployment

### Vercel (Recommended)

```bash
npm run build
vercel --prod
```

Add environment variables in Vercel dashboard.

### Environment Variables for Production

```env
NEXT_PUBLIC_SUPABASE_URL=<production_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production_key>
NEXT_PUBLIC_API_URL=<python_backend_url>
```

## Troubleshooting

### "Invalid API key" error
- Check root `.env` has correct Supabase credentials
- Restart dev server after changing env vars

### Microphone not working
- Use HTTPS (required for media permissions)
- Check browser permissions
- Ensure not blocked by browser policy

### Resume upload fails
- Verify Supabase storage bucket is created
- Check storage policies are set up correctly
- Ensure file is a valid PDF

## Next Steps for Your Team

1. **Backend Integration**
   - Deploy Python backend (RAG + APIs)
   - Update `NEXT_PUBLIC_API_URL` in `.env.local`
   - Replace mock API responses with real calls

2. **ElevenLabs Integration**
   - Add ElevenLabs API calls in `/api/interview`
   - Generate audio for questions
   - Stream audio to frontend

3. **Behavioral Questions**
   - Load from `../data/behavioral_questions.json`
   - Mix with technical questions
   - Implement question randomization

## Contributing

This is the UI branch. Your teammates are working on:
- **Backend APIs**: RAG, question generation, TTS
- **Data**: Behavioral questions, resume parsing

Coordinate integration points via the API routes.

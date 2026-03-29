# Quick Start Guide

## What's Been Built

A complete Next.js frontend for the Smart Interview app is ready on the `ui` branch. Here's what works:

### ✅ Completed Features
1. **Authentication** - Login/signup with Supabase
2. **User Setup** - Resume upload + language selection
3. **Dashboard** - Shows user profile and starts interviews
4. **Interview Session** - Camera/mic permissions based on language
5. **API Routes** - Ready for your teammates to connect the backend

## Getting Started

### 1. Set Up Supabase

Follow the detailed guide: **`SUPABASE_SETUP.md`**

Quick version:
- Create project at https://supabase.com
- Run the SQL migrations
- Set up storage bucket
- Copy your credentials

### 2. Configure Environment

All environment variables are in the **root `.env` file** (already configured):

```env
RAG_API=your_groq_key
ELEVEN_API=your_elevenlabs_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The frontend automatically reads `NEXT_PUBLIC_*` variables from this file.

```bash
cd frontend
npm install
npm run dev
```

Visit: http://localhost:3000

### 3. Test the Frontend

You can test everything except API calls (those return mock data):

1. **Sign up** - Create account at `/signup`
2. **Upload resume** - Go through setup at `/setup`
3. **Dashboard** - See your profile at `/dashboard`
4. **Start interview** - Test permissions at `/interview`

## What Your Teammates Need to Do

The frontend is **complete** and waiting for backend integration. See **`INTEGRATION_GUIDE.md`** for detailed instructions.

### Backend Tasks

1. **Create FastAPI server** (`backend/main.py`)
2. **Implement endpoints**:
   - `POST /parse-resume` - Use existing `rag/parser.py`
   - `POST /generate-questions` - Use `rag/interviewer.py` + behavioral questions
   - `POST /interview/process` - Add ElevenLabs TTS
   - `WebSocket /asl/recognize` - Connect ASL classifier

3. **Start backend**:
```bash
pip install fastapi uvicorn websockets python-multipart
python backend/main.py
```

### API Integration Points

The frontend makes these calls (currently return mock data):

```typescript
// Resume parsing
fetch('http://localhost:8000/parse-resume', {
  method: 'POST',
  body: formData  // Contains PDF file
})

// Question generation
fetch('http://localhost:8000/generate-questions', {
  method: 'POST',
  body: JSON.stringify({ user_id, field, language })
})

// Interview processing
fetch('http://localhost:8000/interview/process', {
  method: 'POST',
  body: JSON.stringify({ question, answer, user_id, language })
})
```

Replace the mock responses in:
- `frontend/src/app/api/parse-resume/route.ts`
- `frontend/src/app/api/generate-questions/route.ts`
- `frontend/src/app/api/interview/route.ts`

## Project Structure

```
smart_interview/
├── frontend/                # ✅ Next.js app (COMPLETE)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/      # Login/signup pages
│   │   │   ├── (dashboard)/ # Setup, dashboard, interview
│   │   │   └── api/         # API routes (need backend)
│   │   ├── components/ui/   # UI components
│   │   └── lib/supabase/    # Supabase client
│   └── README.md
│
├── rag/                     # 🔄 Existing Python RAG system
│   ├── parser.py
│   ├── vectorstore.py
│   └── interviewer.py
│
├── asl/                     # 🔄 Existing ASL recognition
│   ├── detector.py
│   ├── classifier.py
│   └── buffer.py
│
├── data/                    # 🔄 Behavioral questions
│   └── behavioral_questions.json
│
└── backend/                 # ❌ NEEDS TO BE CREATED
    └── main.py              # FastAPI server
```

## Environment Variables

**All environment variables are in the root `.env` file:**

```env
RAG_API=your_groq_api_key
ELEVEN_API=your_elevenlabs_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Both frontend and backend read from this single file.

## Testing the Full Stack

Once your teammates implement the backend:

### Terminal 1: Backend
```bash
python backend/main.py
# Should see: "Uvicorn running on http://0.0.0.0:8000"
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
# Should see: "ready - started server on 0.0.0.0:3000"
```

### Test Flow
1. Go to http://localhost:3000
2. Sign up → Upload resume → See field detected
3. Start interview → Grant permissions
4. (Once backend is connected) See real questions with audio

## Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```

Add environment variables in Vercel dashboard.

### Backend (Your choice)
- Railway
- Render
- AWS Lambda
- Google Cloud Run

Update `NEXT_PUBLIC_API_URL` to production backend URL.

## Troubleshooting

### "Invalid API key" error
- Check `.env.local` has correct Supabase credentials
- Restart dev server after changing env vars

### Camera/Mic not working
- Must use HTTPS in production
- Check browser permissions
- Test in Chrome/Firefox

### Build fails
- Run `npm run build` to test
- Check TypeScript errors
- Verify all imports are correct

## Documentation

- **`SUPABASE_SETUP.md`** - Database setup instructions
- **`INTEGRATION_GUIDE.md`** - Backend integration details
- **`frontend/README.md`** - Frontend documentation

## Current Branch

You're on the `ui` branch. The frontend is production-ready and waiting for:
- Backend API implementation
- ElevenLabs TTS integration
- ASL recognition WebSocket
- Behavioral questions loading

**The UI is done. Time for your teammates to connect the backend!** 🚀

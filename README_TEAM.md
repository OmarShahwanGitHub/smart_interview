# Smart Interview - Team Coordination Guide

## 🎯 Project Status

### ✅ COMPLETE - Frontend UI (Your Work)
The entire Next.js frontend is production-ready with:
- Authentication system (login/signup)
- Resume upload and configuration
- Dashboard and interview session pages
- Camera/microphone permission handling
- API routes ready for backend integration

### 🔄 IN PROGRESS - Backend Integration (Your Teammates)
Need to create FastAPI server with 4 endpoints:
- Resume parsing (connects to existing `rag/parser.py`)
- Question generation (uses `rag/interviewer.py` + behavioral questions)
- Interview processing (ElevenLabs TTS integration)
- ASL recognition (WebSocket with existing `asl/` modules)

---

## 📋 Documentation Files

### For Everyone
- **`README_TEAM.md`** (this file) - Overview and coordination
- **`QUICK_START.md`** - Get started in 5 minutes
- **`SUPABASE_SETUP.md`** - Database setup (do this first!)

### For Backend Team
- **`BACKEND_IMPLEMENTATION.md`** - ⭐ **START HERE** - Complete implementation guide with code
- **`INTEGRATION_GUIDE.md`** - Integration points and architecture

### For Frontend Team
- **`frontend/README.md`** - Frontend documentation

---

## 🚀 Quick Start for Your Team

### Step 1: Set Up Database (Everyone)
```bash
# Follow this guide first:
cat SUPABASE_SETUP.md

# Summary:
# 1. Create Supabase project
# 2. Run SQL migrations
# 3. Create storage buckets
# 4. Update .env file
```

### Step 2: Test Frontend (Your Work)
```bash
cd frontend
npm install
npm run dev

# Visit: http://localhost:3000
# Test: Signup → Upload resume → Dashboard
# Note: Questions will be mock data until backend is ready
```

### Step 3: Build Backend (Your Teammates)
```bash
# Read the complete guide:
cat BACKEND_IMPLEMENTATION.md

# Summary:
# 1. Create backend/main.py
# 2. Implement 4 API endpoints
# 3. Connect existing rag/ and asl/ modules
# 4. Test with curl commands
```

### Step 4: Connect Everything
```bash
# Terminal 1: Backend
python backend/main.py

# Terminal 2: Frontend
cd frontend && npm run dev

# Test full flow: Signup → Upload → Interview
```

---

## 🔑 Environment Variables

**Everything is in ONE file: root `.env`**

```env
# Set in your local .env (never commit real keys):
RAG_API=your_groq_api_key
ELEVEN_API=your_elevenlabs_api_key

# You need to add (from Supabase):
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Backend URL (default):
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Both frontend and backend read from this single file - no need for multiple env files!

---

## 🏗️ Project Structure

```
smart_interview/
├── .env                          # ✅ Single source of truth for all env vars
│
├── SUPABASE_SETUP.md            # ⭐ Start here - database setup
├── BACKEND_IMPLEMENTATION.md     # ⭐ Complete backend guide with code
├── QUICK_START.md               # Quick reference
├── INTEGRATION_GUIDE.md         # Architecture overview
│
├── frontend/                    # ✅ COMPLETE (Next.js 15)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/          # Login, signup
│   │   │   ├── (dashboard)/     # Setup, dashboard, interview
│   │   │   └── api/             # Proxy routes (call backend)
│   │   ├── components/ui/       # Reusable UI components
│   │   └── lib/                 # Supabase client, utilities
│   └── package.json
│
├── backend/                     # ❌ CREATE THIS
│   └── main.py                  # FastAPI server (see BACKEND_IMPLEMENTATION.md)
│
├── rag/                         # ✅ Exists - use in backend
│   ├── parser.py                # Resume parsing
│   ├── interviewer.py           # Question generation
│   └── vectorstore.py           # ChromaDB
│
├── asl/                         # ✅ Exists - use in backend
│   ├── detector.py              # Hand detection
│   ├── classifier.py            # Sign classification
│   └── buffer.py                # Text building
│
├── data/                        # ✅ Exists - load in backend
│   └── behavioral_questions.json
│
└── model/                       # ⚠️ Train if needed
    └── asl_classifier.pkl       # Run: python train_classifier.py
```

---

## 🔗 What Your Teammates Need to Implement

### 1. Parse Resume
**Endpoint**: `POST /parse-resume`
**What it does**: Receives PDF, extracts text, detects field
**Uses**: Existing `rag/parser.py` + Groq LLM
**Returns**: Field + structured resume data

### 2. Generate Questions
**Endpoint**: `POST /generate-questions`
**What it does**: Creates 8 questions (4 technical + 4 behavioral)
**Uses**: Existing `rag/interviewer.py` + `data/behavioral_questions.json`
**Returns**: Array of question strings

### 3. Process Interview
**Endpoint**: `POST /interview/process`
**What it does**: Generates follow-up + TTS audio
**Uses**: Existing `rag/interviewer.py` + ElevenLabs API
**Returns**: Follow-up question + audio URL

### 4. ASL Recognition
**Endpoint**: `WebSocket /asl/recognize`
**What it does**: Real-time sign language recognition
**Uses**: Existing `asl/detector.py` + `asl/classifier.py` + `asl/buffer.py`
**Returns**: Recognized text stream

**Full implementation with copy-paste code: `BACKEND_IMPLEMENTATION.md`**

---

## 📊 Current Capabilities

### What Works Now (Frontend Only)
- ✅ User signup and login
- ✅ Resume upload UI
- ✅ Language selection (English/Spanish/ASL)
- ✅ Dashboard display
- ✅ Camera/mic permissions
- ✅ Mock field detection
- ✅ Mock questions

### What Needs Backend
- ⚠️ Real resume parsing
- ⚠️ Real field detection
- ⚠️ Real question generation
- ⚠️ TTS audio playback
- ⚠️ ASL sign recognition
- ⚠️ Follow-up questions

---

## 🧪 Testing Strategy

### Frontend Testing (You)
```bash
cd frontend
npm run dev

# Test:
# 1. Signup at /signup
# 2. Upload resume at /setup (see mock field)
# 3. View dashboard at /dashboard
# 4. Start interview at /interview (test permissions)
# 5. See mock questions
```

### Backend Testing (Teammates)
```bash
python backend/main.py

# Test each endpoint:
curl http://localhost:8000                         # Health check
curl -X POST http://localhost:8000/parse-resume -F "file=@resume.pdf"
curl -X POST http://localhost:8000/generate-questions -d '{...}'
curl -X POST http://localhost:8000/interview/process -d '{...}'

# See BACKEND_IMPLEMENTATION.md for full test commands
```

### Integration Testing (Together)
```bash
# Terminal 1:
python backend/main.py

# Terminal 2:
cd frontend && npm run dev

# Browser:
# 1. Signup
# 2. Upload resume
# 3. Should see REAL field (not mock)
# 4. Start interview
# 5. Should see REAL questions
# 6. Should hear TTS audio
```

---

## 🐛 Common Issues

### "Invalid API key"
- Check root `.env` has correct credentials
- No spaces, no quotes around values
- Restart both frontend and backend after changes

### "Module not found" (backend)
```bash
# Make sure you're in project root:
cd smart_interview
python backend/main.py
```

### "Cannot connect to backend"
- Check backend is running: `curl http://localhost:8000`
- Check `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env`
- Check CORS is enabled in backend

### "ASL model not found"
```bash
# Train the classifier first:
python train_classifier.py
# Creates model/asl_classifier.pkl
```

### Camera/Mic not working
- Must use HTTPS in production (HTTP is fine for localhost)
- Check browser permissions (allow camera/mic)
- Try Chrome or Firefox

---

## 📞 Communication

### Backend Team Checklist
- [ ] Read `BACKEND_IMPLEMENTATION.md` (has all the code!)
- [ ] Create `backend/main.py`
- [ ] Implement 4 endpoints
- [ ] Test with curl commands
- [ ] Notify frontend team when ready

### Frontend Team Checklist (You)
- [ ] Set up Supabase (follow `SUPABASE_SETUP.md`)
- [ ] Update `.env` with Supabase credentials
- [ ] Test frontend in isolation
- [ ] When backend is ready, update API routes

### Integration Checklist (Both Teams)
- [ ] Backend running on port 8000
- [ ] Frontend running on port 3000
- [ ] Test full signup → upload → interview flow
- [ ] Verify TTS audio plays
- [ ] Test ASL recognition (if applicable)

---

## 🚢 Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel --prod

# Add env vars in Vercel dashboard:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - NEXT_PUBLIC_API_URL (production backend URL)
```

### Backend (Railway/Render/AWS)
```bash
# Your teammates choose platform
# Make sure to set all env vars from .env file
# Update NEXT_PUBLIC_API_URL to production URL
```

---

## 📚 Additional Resources

- **Next.js Docs**: https://nextjs.org/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **Supabase Docs**: https://supabase.com/docs
- **ElevenLabs Docs**: https://elevenlabs.io/docs
- **Groq Docs**: https://console.groq.com/docs

---

## 🎯 Success Criteria

Your app is ready when:
- ✅ User can sign up and log in
- ✅ User can upload PDF resume
- ✅ System detects field correctly
- ✅ System generates relevant questions
- ✅ Questions have TTS audio (English/Spanish)
- ✅ System recognizes ASL signs (ASL mode)
- ✅ Follow-up questions are generated
- ✅ Full interview flow works end-to-end

---

## 🤝 Next Steps

1. **You**: Set up Supabase (30 min)
2. **Teammates**: Read `BACKEND_IMPLEMENTATION.md` (1 hour)
3. **Teammates**: Create backend (2-3 hours)
4. **Everyone**: Test integration (30 min)
5. **Everyone**: Deploy to production (1 hour)

**The frontend is done. Time to connect the backend!** 🚀

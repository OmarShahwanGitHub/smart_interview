# API Setup & "Uncommenting for Production" - Explained

## 🔑 Understanding NEXT_PUBLIC_API_URL

### What is it?
`NEXT_PUBLIC_API_URL` is the URL where your **Python FastAPI backend** runs.

### It's NOT from Supabase!
- ❌ **Not** the Supabase URL
- ❌ **Not** the Site URL in Supabase
- ✅ **It's your Python backend server URL**

### Values:

#### Local Development
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```
This is when you run: `python backend/main.py`

#### Production (After deployment)
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
# or
NEXT_PUBLIC_API_URL=https://your-backend.render.com
# or
NEXT_PUBLIC_API_URL=https://your-api.yourdomain.com
```

---

## 🔄 What I Meant by "Uncommenting for Production"

### Current State (Mock Data)

Right now, the frontend API routes return **fake/mock data** for testing:

**File**: `frontend/src/app/api/parse-resume/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // Lines 16-25 are COMMENTED OUT (production code)
  // For now, return mock data

  // In production, this would call your Python backend:
  // const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL;
  // const response = await fetch(`${pythonApiUrl}/parse-resume`, {
  //   method: "POST",
  //   body: formData,
  // });
  // const data = await response.json();

  // MOCK DATA (lines 27-37)
  const mockField = detectFieldFromResume(file.name);
  return NextResponse.json({
    field: mockField,
    parsed_data: { ... }
  });
}
```

### After Backend is Ready (Real Data)

When your teammates finish the backend, you:

1. **Delete the mock code** (lines 27-37)
2. **Uncomment the production code** (lines 19-25)
3. **Return real data from backend**

**Updated code**:

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const userId = formData.get("user_id") as string;

  // UNCOMMENT THIS (remove the //)
  const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const response = await fetch(`${pythonApiUrl}/parse-resume`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json();

  // DELETE THIS (mock code)
  // const mockField = detectFieldFromResume(file.name);

  // Return real data
  return NextResponse.json({
    field: data.field,
    parsed_data: data.parsed_data
  });
}
```

---

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      USER UPLOADS RESUME                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│    Frontend (Next.js)                                        │
│    /setup page                                               │
│    - User uploads PDF                                        │
│    - Calls /api/parse-resume                                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│    Frontend API Route                                        │
│    /api/parse-resume/route.ts                                │
│                                                              │
│    [CURRENTLY: Returns mock data]                            │
│    [AFTER BACKEND: Calls Python backend]                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼ (when backend ready)
┌─────────────────────────────────────────────────────────────┐
│    Python Backend (FastAPI)                                  │
│    http://localhost:8000/parse-resume                        │
│    ← This is NEXT_PUBLIC_API_URL                             │
│                                                              │
│    - Receives PDF                                            │
│    - Uses rag/parser.py                                      │
│    - Detects field with Groq                                 │
│    - Returns structured data                                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│    Response back to frontend                                 │
│    { field: "Software Engineering", parsed_data: {...} }     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step-by-Step Setup

### Phase 1: Current (Mock Data) - You are here ✅

```env
# .env file
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
# Only frontend runs
cd frontend
npm run dev
# Visit: http://localhost:3000
# Works with mock data
```

### Phase 2: Backend Integration (Your Teammates)

**Step 1**: Teammates create `backend/main.py`

```python
from fastapi import FastAPI

app = FastAPI()

@app.post("/parse-resume")
async def parse_resume_endpoint(file: UploadFile):
    # Real implementation here
    return {"field": "...", "parsed_data": {...}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**Step 2**: Run backend

```bash
# Terminal 1
python backend/main.py
# Running on http://0.0.0.0:8000
```

**Step 3**: Test backend directly

```bash
curl -X POST http://localhost:8000/parse-resume \
  -F "file=@/path/to/resume.pdf"

# Should return real data
```

**Step 4**: Update frontend API route

```typescript
// frontend/src/app/api/parse-resume/route.ts

// REMOVE mock code
// ADD real backend call
const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL; // http://localhost:8000
const response = await fetch(`${pythonApiUrl}/parse-resume`, {
  method: "POST",
  body: formData,
});
const data = await response.json();

return NextResponse.json(data);
```

**Step 5**: Test full stack

```bash
# Terminal 1: Backend
python backend/main.py

# Terminal 2: Frontend
cd frontend && npm run dev

# Browser: http://localhost:3000
# Upload resume → See REAL field detection!
```

---

## 🚀 Production Deployment

### Deploy Backend First

**Option 1: Railway**
```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Deploy
railway login
railway init
railway up
# Get URL: https://your-app.railway.app
```

**Option 2: Render**
1. Push code to GitHub
2. Connect Render to repo
3. Deploy
4. Get URL: https://your-app.onrender.com

### Update Environment Variable

```env
# Root .env file
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### Deploy Frontend

```bash
cd frontend
vercel --prod
# Add NEXT_PUBLIC_API_URL in Vercel dashboard
```

---

## 📝 Checklist for Your Team

### Frontend Team (You)
- [x] UI complete
- [x] Mock data working
- [ ] Wait for backend team
- [ ] When ready: uncomment production code
- [ ] Test integration
- [ ] Deploy

### Backend Team (Your Teammates)
- [ ] Read `BACKEND_IMPLEMENTATION.md`
- [ ] Create `backend/main.py`
- [ ] Implement 4 endpoints
- [ ] Test with curl
- [ ] Notify frontend team
- [ ] Deploy backend
- [ ] Share production URL

---

## 🔍 How to Know Backend is Ready

Test it directly:

```bash
# Health check
curl http://localhost:8000
# Should return: {"message":"Smart Interview Backend API","status":"running"}

# Test parse-resume
curl -X POST http://localhost:8000/parse-resume -F "file=@resume.pdf"
# Should return: {"field":"...", "parsed_data":{...}}

# If these work, backend is ready!
```

---

## 💡 Quick Reference

| Environment Variable | What It Is | Example Value |
|---------------------|------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase database | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase auth key | `eyJhbGci...` |
| `NEXT_PUBLIC_API_URL` | **Your Python backend** | `http://localhost:8000` |
| `RAG_API` | Groq API key | `gsk_...` |
| `ELEVEN_API` | ElevenLabs key | `sk_...` |

**All in ONE file**: root `.env`

---

## ❓ Common Confusion

**Q: Where do I get NEXT_PUBLIC_API_URL?**
A: You don't "get" it - it's the URL where **your teammates' Python backend runs**. Locally it's `http://localhost:8000`, in production it's wherever you deploy it.

**Q: Is it the Supabase URL?**
A: No! Completely different. Supabase = database. API_URL = your FastAPI server.

**Q: How do I know what to put?**
A:
- Development: `http://localhost:8000` (when running `python backend/main.py`)
- Production: The URL from Railway/Render/AWS after deploying backend

**Q: What if I don't have a backend yet?**
A: That's fine! The frontend works with mock data. Your teammates will build the backend using `BACKEND_IMPLEMENTATION.md`.

---

## 🎯 Summary

1. **NEXT_PUBLIC_API_URL = Your Python backend URL**
2. **Currently**: Mock data (no backend needed)
3. **After backend**: Uncomment code, call real backend
4. **Local**: `http://localhost:8000`
5. **Production**: Whatever URL you deploy backend to

The frontend is complete. Your teammates build the backend. Then you connect them by uncommenting the production code. Simple! 🚀

# Launch Commands - Quick Reference

## ✅ Fixed: Environment Variables

Created symlink so frontend reads from root `.env`:
```bash
frontend/.env.local -> ../.env
```

**You don't need to do anything - it's already done!**

---

## 🚀 Launch the App

### Step 1: Restart Dev Server
```bash
# Stop current server (Ctrl+C if running)
cd frontend
npm run dev
```

**That's it!** Visit http://localhost:3000

---

## 🔍 Verify It's Working

Open browser console, you should NOT see:
- ❌ `supabaseUrl is required`

You SHOULD see:
- ✅ Login/Signup buttons work
- ✅ Can click and navigate

---

## 🐛 If Still Not Working

Run this to verify env vars are loaded:
```bash
cd frontend
node -e "require('dotenv').config({path:'../.env'}); console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

Should print: `https://karmrtgjvxlyesvlpahg.supabase.co`

---

## 📋 Complete Startup Checklist

### First Time Setup:
1. ✅ Run Supabase SQL scripts (see `SUPABASE_SETUP.md`)
2. ✅ Environment variables configured (already done)
3. ✅ Dependencies installed (`npm install`)

### Every Time You Develop:
```bash
# Terminal 1: Frontend
cd frontend
npm run dev

# Terminal 2: Backend (when ready)
python backend/main.py
```

---

## 💡 Quick Test

After restarting:
1. Go to http://localhost:3000
2. Click "Get Started"
3. Should navigate to `/signup`
4. Fill form and submit
5. Should create account (if Supabase SQL is run)

---

## 🎯 Next Steps

1. **Restart dev server**: `cd frontend && npm run dev`
2. **Test buttons**: Click login/signup
3. **Run Supabase SQL**: If not done yet, see `SUPABASE_SETUP.md` line 30
4. **Create account**: Test signup flow
5. **Upload resume**: Test setup page

The fix is done - just restart! 🚀

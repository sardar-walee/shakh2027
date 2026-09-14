# شاخ — V2

پلاتفۆرمی RTL بۆ بازاڕ، ئۆتۆمبێل، دوکاندار، کاپتن و دارایی.

## تایبەتمەندیەکان
- Supabase Auth + RLS
- ڕۆڵەکان: Super Admin / Captain / Restaurant / Supermarket / Clothing / Beauty / Auto / Customer
- داشبۆردی تایبەت
- Marketplace و ئۆردەر
- پۆستی کاڵا و ئۆتۆمبێل
- پەسەندکردن، ڕەشکردنەوە و سڕینەوە بۆ Super Admin
- Captain invite code
- دارایی: goods / delivery / platform
- Audit log و security functions
- Responsive RTL UI
- Vercel-ready

## Deploy
1. Repository ـەکە بخە GitHub.
2. Import بکە بۆ Vercel.
3. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. `supabase/schema.sql` لە Supabase SQL Editor جێبەجێ بکە.
5. لە Authentication ـەوە یەک user دروست بکە، پاشان UUID ـەکەی بە `super_admin` بگۆڕە.
6. Build command: `npm run build`
7. Output directory: `dist`

### تێبینییەکی پاراستن
تەنها Supabase **anon/publishable key** لە frontend بەکاربهێنە. Service Role Key هەرگیز لە Vercel frontend دانەنێ.

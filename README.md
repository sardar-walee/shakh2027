# شاخ (SHAKH) V5

نسخەی نوێی پلاتفۆرمی شاخ بۆ Vercel + Supabase.

## گرنگترین گۆڕانکارییەکانی V5
- **Public Feed:** پۆستە `published` ـەکان بێ چوونەژوورەوە دەبینرێن.
- **Signup تەنها بۆ Captain:** تۆمارکردن لە UI ـدا تەنها بۆ کاپتنە. ڕۆڵەکانی تر لەلایەن Super Admin دیاری دەکرێن.
- هەموو ڕۆڵەکان: `super_admin`, `captain`, `restaurant`, `supermarket`, `clothing`, `beauty`, `auto`, `customer`.
- Dashboard ـی جیاواز، Posts، Auto posts، Orders، Captain invites، Finance، Moderation، Users.
- Error boundary و Vercel-safe loading.
- Supabase RLS بۆ public published posts و داتای authenticated.
- Public search/filter بۆ پۆستەکان.

## Deploy
1. `npm install`
2. لە Vercel ئەم env ـانە دابنێ:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. `supabase/schema.sql` لە Supabase SQL Editor جێبەجێ بکە.
4. `npm run build`
5. Repository ـەکە لە Vercel deploy بکە.

**تێبینی:** Service Role Key مەخە ناو frontend.

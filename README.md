<<<<<<< HEAD
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
=======
# شاخ — V3

پلاتفۆرمی بازاڕ، گەیاندن، ئۆتۆمبێل و دارایی بە React + Vite + Supabase.

## گرنگ: چاککردنی شاشەی سپی
V3 کێشەی شاشەی سپی چارەسەر دەکات: ئەگەر Vercel Environment Variables دانەنرابن، ئەپەکە بە fallback ـی Supabase دەستپێدەکات؛ ئەگەر profile/schema کێشەی هەبێت، لەبری splash ـی بێکۆتایی، پەیامی ڕوون پیشان دەدرێت.

## Deploy لە Vercel
1. Repository ـەکە بۆ GitHub بنێرە.
2. لە Vercel Import بکە.
3. Environment Variables زیاد بکە:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. لە Supabase → SQL Editor فایل `supabase/schema.sql` جێبەجێ بکە.
5. دوای signup، UUID ـی یەک بەکارهێنەر بکە `super_admin`.

## تایبەتمەندیەکان
- Role based access: Super Admin, Captain, Restaurant, Supermarket, Clothing, Beauty, Auto, Customer
- داشبۆردی تایبەت بۆ هەر role
- پۆستی بەشەکان و پۆستی ئۆتۆمبێل بۆ هەموو کەس
- moderation: publish / blacklist / delete
- captain invite و captain management
- orders و status workflow
- finance ledger: goods / merchant, delivery / captain, platform revenue
- Supabase Auth + RLS + audit logs
- RTL و responsive UI

## Security
`anon/publishable key` تەنها بۆ frontend بەکاربهێنە. `service_role` key هەرگیز لە frontend یان Vercel client bundle مەخە.


## V4 changes
- Added React error boundary so runtime exceptions show a recovery screen instead of a blank page.
- Added PWA manifest and service worker registration.
- Keeps Supabase env variables with a public anon-key fallback for the supplied project.
- Includes the V3 role, moderation, marketplace, orders, captain, finance and RLS architecture.

### Vercel
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The app can still render without them using the configured public anon fallback, but production should use Vercel environment variables.
>>>>>>> a0a6d5464902ffa13ddfbf5199248c7766b1b556

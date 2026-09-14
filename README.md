# شاخ (Shakh)

پڕۆژەی MVP بۆ بازاڕ، پۆستکردنی ئۆتۆمبێل، ڕۆڵ و داشبۆردی تایبەت، کاپتن، و بەڕێوەبردنی دارایی.

## دامەزراندن

1. `npm install`
2. فایل `.env.local` دروست بکە و `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` دابنێ.
3. `supabase/schema.sql` لە Supabase SQL Editor جێبەجێ بکە.
4. `npm run dev`
5. بۆ Vercel: GitHub repo ـکە پەیوەست بکە، Build Command = `npm run build` و Output = `dist`. Environment Variables ـەکان زیاد بکە.

> تێبینی: تەنها anon/publishable key لە frontend بەکاربهێنە. Service Role Key هیچ کاتێک لە frontend مەخە.

## ڕۆڵەکان

- `super_admin`: دەسەڵاتی تەواو
- `captain`: کاپتنی گەیاندن
- `restaurant`
- `supermarket`
- `clothing`
- `beauty`
- `auto`
- `customer`

هەر بەشێک داشبۆردی خۆی هەیە. بەکارهێنەر دەتوانێت کاپتن دروست بکات؛ کاپتن بە `parent_id` بە خاوەنەکەیەوە پەیوەست دەبێت.

## دارایی

سیستەمەکە `orders` و `financial_transactions` هەیە بۆ:
- پارەی کاڵا / Merchant
- پارەی گەیاندن / Captain
- پارەی پلاتفۆرم / Shakh
- دۆخی settlement

بۆ production، payment gateway، storage policy، audit log، verification، و notification provider پێویستی بە زیادکردنی integration هەیە.

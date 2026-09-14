-- =================================================================
-- SHAKH Super App: All-In-One Production Schema
-- Safe, Idempotent, Complete Schema for fresh or existing Supabase instances
-- Run this once in the Supabase SQL Editor.
-- =================================================================

-- 1. UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Custom Enum Types
DO $$ 
BEGIN
  -- role_type enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
    CREATE TYPE role_type AS ENUM (
      'SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CAPTAIN', 'CUSTOMER',
      'RESTAURANT', 'SUPERMARKET', 'FASHION', 'UMRAH', 'CAR_SELLER', 'BEAUTY', 'TECH',
      'FOOD_MERCHANT', 'MARKET_MERCHANT', 'FASHION_MERCHANT', 'CARS_MERCHANT', 'TECH_MERCHANT'
    );
  ELSE
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'FOOD_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'MARKET_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'FASHION_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'CARS_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'TECH_MERCHANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'TECH'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'SUPPORT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  -- order_status enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'NEW', 'ACCEPTED', 'PREPARING', 'READY', 'CAPTAIN_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'
    );
  END IF;

  -- payment_status enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM (
      'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'
    );
  END IF;

  -- business_type enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_type') THEN
    CREATE TYPE business_type AS ENUM (
      'RESTAURANT', 'SUPERMARKET', 'FASHION', 'UMRAH', 'CAR', 'BEAUTY'
    );
  END IF;
END $$;

-- 3. Core Tables

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT UNIQUE,
    avatar TEXT,
    language TEXT DEFAULT 'ku',
    theme_preference TEXT DEFAULT 'dark',
    status TEXT DEFAULT 'active',
    fcm_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure profiles columns exist if profiles was created previously
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS fcm_token TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ku',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- USER ROLES
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role role_type NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    approved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Ensure user_roles has user_id if table existed previously with a different structure
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- BUSINESSES
CREATE TABLE IF NOT EXISTS businesses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES profiles(id),
    type business_type NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    logo TEXT,
    cover_image TEXT,
    status TEXT DEFAULT 'active',
    is_open BOOLEAN DEFAULT true,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address TEXT,
    commission_rate DECIMAL(5,2) DEFAULT 10.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_ku TEXT,
    name_ar TEXT,
    image TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    stock INTEGER DEFAULT 0,
    images TEXT[],
    is_available BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure products metadata column exists
ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES profiles(id),
    business_id UUID REFERENCES businesses(id),
    captain_id UUID REFERENCES profiles(id),
    status order_status DEFAULT 'NEW',
    payment_status payment_status DEFAULT 'PENDING',
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    platform_fee DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    commission DECIMAL(10,2) DEFAULT 0,
    address JSONB NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    notes TEXT,
    category TEXT DEFAULT 'food',
    estimated_delivery_minutes INTEGER DEFAULT 25,
    is_scheduled BOOLEAN DEFAULT false,
    scheduled_date TEXT,
    scheduled_time TEXT,
    scheduled_slot_label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure orders columns exist
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'food',
  ADD COLUMN IF NOT EXISTS estimated_delivery_minutes INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_date TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_time TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_slot_label TEXT;

-- ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DELIVERY ADDRESSES
CREATE TABLE IF NOT EXISTS delivery_addresses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    tag TEXT DEFAULT 'home',
    city TEXT NOT NULL,
    district TEXT,
    sub_district TEXT,
    street_address TEXT NOT NULL,
    building_name TEXT,
    floor_apartment TEXT,
    nearest_landmark TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    phone_contact TEXT,
    driver_instructions TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CAPTAIN LOCATIONS
CREATE TABLE IF NOT EXISTS captain_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    captain_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION DEFAULT 0,
    speed DOUBLE PRECISION DEFAULT 0,
    is_online BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CAPTAIN SETTLEMENTS
CREATE TABLE IF NOT EXISTS captain_settlements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    captain_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    amount_returned DECIMAL(12,2) NOT NULL,
    previous_balance DECIMAL(12,2) DEFAULT 0,
    new_balance DECIMAL(12,2) DEFAULT 0,
    breakdown JSONB DEFAULT '{}'::jsonb,
    payment_method TEXT NOT NULL,
    received_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reference_code TEXT UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FEED POSTS
CREATE TABLE IF NOT EXISTS posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    title TEXT,
    content TEXT NOT NULL,
    content_ku TEXT,
    content_ar TEXT,
    content_en TEXT,
    images TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    category TEXT DEFAULT 'all',
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    location_name TEXT,
    status TEXT DEFAULT 'approved',
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    deal JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMMENTS
CREATE TABLE IF NOT EXISTS comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LIKES
CREATE TABLE IF NOT EXISTS likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_post_like') THEN
    ALTER TABLE likes ADD CONSTRAINT unique_user_post_like UNIQUE (user_id, post_id);
  END IF;
END $$;

-- STORIES
CREATE TABLE IF NOT EXISTS stories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    media_url TEXT NOT NULL,
    title TEXT,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WALLETS
CREATE TABLE IF NOT EXISTS wallets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) UNIQUE,
    balance DECIMAL(12,2) DEFAULT 0,
    pending_balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) UNIQUE;

-- WALLET TRANSACTIONS
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_id UUID REFERENCES wallets(id),
    type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Automatic updated_at Trigger
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_delivery_addresses_updated_at') THEN
    CREATE TRIGGER tr_delivery_addresses_updated_at BEFORE UPDATE ON delivery_addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_posts_updated_at') THEN
    CREATE TRIGGER tr_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_wallets_updated_at') THEN
    CREATE TRIGGER tr_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END $$;

-- 5. Enable Row-Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE captain_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE captain_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 6. Row-Level Security Policies

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User Roles
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);

-- Businesses
DROP POLICY IF EXISTS "Public can view active businesses" ON businesses;
CREATE POLICY "Public can view active businesses" ON businesses FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Owners can manage own businesses" ON businesses;
CREATE POLICY "Owners can manage own businesses" ON businesses FOR ALL USING (auth.uid() = owner_id);

-- Products
DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products" ON products FOR SELECT USING (is_available = true);

DROP POLICY IF EXISTS "Business owners can manage products" ON products;
CREATE POLICY "Business owners can manage products" ON products FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.owner_id = auth.uid())
);

-- Orders
DROP POLICY IF EXISTS "Customers view own orders" ON orders;
CREATE POLICY "Customers view own orders" ON orders FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Businesses view own orders" ON orders;
CREATE POLICY "Businesses view own orders" ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = orders.business_id AND businesses.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Captains view assigned orders" ON orders;
CREATE POLICY "Captains view assigned orders" ON orders FOR SELECT USING (auth.uid() = captain_id);

-- Delivery Addresses
DROP POLICY IF EXISTS "Users can view own addresses" ON delivery_addresses;
CREATE POLICY "Users can view own addresses" ON delivery_addresses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own addresses" ON delivery_addresses;
CREATE POLICY "Users can insert own addresses" ON delivery_addresses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own addresses" ON delivery_addresses;
CREATE POLICY "Users can update own addresses" ON delivery_addresses FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own addresses" ON delivery_addresses;
CREATE POLICY "Users can delete own addresses" ON delivery_addresses FOR DELETE USING (auth.uid() = user_id);

-- Captain Locations
DROP POLICY IF EXISTS "Anyone can view online captain locations" ON captain_locations;
CREATE POLICY "Anyone can view online captain locations" ON captain_locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Captains can upsert own location" ON captain_locations;
CREATE POLICY "Captains can upsert own location" ON captain_locations FOR ALL USING (auth.uid() = captain_id);

-- Captain Settlements
DROP POLICY IF EXISTS "Captains can view own settlements" ON captain_settlements;
CREATE POLICY "Captains can view own settlements" ON captain_settlements
  FOR SELECT USING (
    auth.uid() = captain_id OR 
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'approved')
  );

DROP POLICY IF EXISTS "Admins can insert settlements" ON captain_settlements;
CREATE POLICY "Admins can insert settlements" ON captain_settlements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'approved')
  );

-- Posts
DROP POLICY IF EXISTS "Anyone can view approved posts" ON posts;
CREATE POLICY "Anyone can view approved posts" ON posts
  FOR SELECT USING (
    status = 'approved' OR 
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'approved')
  );

DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
CREATE POLICY "Authenticated users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors and admins can update posts" ON posts;
CREATE POLICY "Authors and admins can update posts" ON posts
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'approved')
  );

DROP POLICY IF EXISTS "Authors and admins can delete posts" ON posts;
CREATE POLICY "Authors and admins can delete posts" ON posts
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'approved')
  );

-- Comments
DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
CREATE POLICY "Anyone can view comments" ON comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can post comments" ON comments;
CREATE POLICY "Authenticated users can post comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Likes
DROP POLICY IF EXISTS "Anyone can view likes" ON likes;
CREATE POLICY "Anyone can view likes" ON likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own likes" ON likes;
CREATE POLICY "Users can manage own likes" ON likes FOR ALL USING (auth.uid() = user_id);

-- Stories
DROP POLICY IF EXISTS "Anyone can view active stories" ON stories;
CREATE POLICY "Anyone can view active stories" ON stories FOR SELECT USING (expires_at > NOW() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert stories" ON stories;
CREATE POLICY "Users can insert stories" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own stories" ON stories;
CREATE POLICY "Users can delete own stories" ON stories FOR DELETE USING (auth.uid() = user_id);

-- Wallets
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
CREATE POLICY "Users can view own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);

-- Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

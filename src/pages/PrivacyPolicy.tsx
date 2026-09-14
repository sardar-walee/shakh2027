import React from 'react';
import { useTranslation } from 'react-i18next';

export default function PrivacyPolicy() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'ku';
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
          {currentLang === 'ku' ? 'سیاسەتی تایبەتمەندی (Privacy Policy)' : currentLang === 'ar' ? 'سياسة الخصوصية (Privacy Policy)' : 'Privacy Policy'}
        </h1>
        
        <div className="space-y-6 text-slate-600 dark:text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-3">1. Information We Collect</h2>
            <p className="mb-2">When you use our application, especially when logging in via Google, we collect the following basic information:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your email address</li>
              <li>Your full name</li>
              <li>Your profile picture (avatar)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-3">2. How We Use Your Information</h2>
            <p>We use the collected information exclusively to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
              <li>Create and manage your user account.</li>
              <li>Provide you with the core functionalities of the application (e.g., creating posts, making orders).</li>
              <li>Identify you within the application to other users (e.g., showing your name on your posts or comments).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-3">3. Data Storage & Security</h2>
            <p>Your data is securely stored using Supabase, a secure backend-as-a-service provider. We do not share, sell, or rent your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-3">4. Deleting Your Data</h2>
            <p>If you wish to delete your account and all associated data, you can request this by contacting our support or using the delete options provided within the app (if available).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-3">5. Contact Us</h2>
            <p>If you have any questions regarding this privacy policy, please contact the administrator at <strong>sardar.xano59@gmail.com</strong>.</p>
          </section>
          
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-sm text-slate-500">
            Last updated: September 2026
          </div>
        </div>
      </div>
    </div>
  );
}

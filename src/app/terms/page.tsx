import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | IEBC',
  description: 'Terms governing your use of the IEBC Financial Infrastructure platform.',
}

export default function TermsOfServicePage() {
  const updated = 'April 23, 2026'

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Nav */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#0F4C81] rounded-lg flex items-center justify-center">
              <span className="text-white font-extrabold text-sm">I</span>
            </div>
            <span className="font-extrabold text-[#0F4C81] text-lg">IEBC</span>
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Back to Home</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {updated}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. Acceptance</h2>
            <p>
              By creating an account or using the IEBC Financial Infrastructure platform (&ldquo;Service&rdquo;), you agree to
              these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the Service.
            </p>
            <p className="mt-2">
              These Terms constitute a legally binding agreement between you and Integrated Efficiency Business
              Consultants (&ldquo;IEBC,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              IEBC provides a cloud-based financial management platform including invoicing, expense tracking, bank
              reconciliation, reporting, payroll management, and AI-powered business advisory services. The Service
              is offered on a subscription basis under the Silver, Gold, and Platinum plans.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. AI Advisory Disclaimer</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="font-semibold text-amber-900 mb-1">Important: AI Advisory is Not Professional Advice</p>
              <p className="text-amber-800">
                The IEBC AI Consultants are AI-powered tools provided for informational purposes only. They do{' '}
                <strong>not</strong> constitute legal, tax, accounting, financial, or investment advice. You should
                always consult a licensed professional (CPA, attorney, financial advisor) before making significant
                business decisions. IEBC is not liable for actions taken based on AI-generated responses.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. Account Registration</h2>
            <p>You must provide accurate and complete information when creating an account. You are responsible for:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Maintaining the confidentiality of your credentials.</li>
              <li>All activity occurring under your account.</li>
              <li>Notifying us immediately of any unauthorized access at <a href="mailto:info@iebusinessconsultants.com" className="text-[#0F4C81] underline">info@iebusinessconsultants.com</a>.</li>
            </ul>
            <p className="mt-2">You must be at least 18 years old and have legal authority to bind your business to these Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. Subscription & Billing</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>All plans include a 30-day free trial. No charge occurs until day 31.</li>
              <li>Subscriptions are billed monthly in advance via Stripe.</li>
              <li>You may cancel anytime; cancellation takes effect at the end of your current billing period.</li>
              <li>We do not issue refunds for partial months, except where required by law.</li>
              <li>We reserve the right to change pricing with 30 days&apos; written notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Use the Service for illegal activities or to process fraudulent transactions.</li>
              <li>Reverse-engineer, copy, or resell the Service.</li>
              <li>Circumvent security controls or attempt unauthorized access.</li>
              <li>Upload malicious code or interfere with the Service&apos;s infrastructure.</li>
              <li>Use the Service to process data for industries we explicitly exclude (firearms dealing, adult content, gambling) without prior written approval.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. Your Data</h2>
            <p>
              You own all financial data you enter into the Service. We process it only to provide the Service and
              as described in our <Link href="/privacy" className="text-[#0F4C81] underline">Privacy Policy</Link>.
              You can export your data at any time from the Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">8. Intellectual Property</h2>
            <p>
              All software, designs, and content comprising the Service are owned by IEBC and protected by
              intellectual property laws. These Terms do not grant you any rights in our IP except the limited right
              to use the Service as described herein.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, IEBC&apos;s total liability to you for any claim arising from
              or related to the Service is limited to the amount you paid us in the 12 months preceding the claim.
            </p>
            <p className="mt-2">
              IEBC is not liable for indirect, incidental, consequential, or punitive damages, including loss of
              profits or data, even if advised of the possibility of such damages.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">10. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or
              implied, including fitness for a particular purpose or uninterrupted availability.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">11. Termination</h2>
            <p>
              We may suspend or terminate your account if you violate these Terms or if your subscription lapses.
              You may terminate by canceling your subscription and deleting your account from Settings.
              Upon termination, your data is retained for 90 days before deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Texas, United States, without regard to conflict-of-law
              principles. Any disputes shall be resolved in the courts of Harris County, Texas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">13. Changes to Terms</h2>
            <p>
              We may update these Terms. We will notify you by email at least 14 days before material changes take
              effect. Continued use of the Service after that date constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">14. Contact</h2>
            <p>
              Questions about these Terms? Email{' '}
              <a href="mailto:info@iebusinessconsultants.com" className="text-[#0F4C81] underline">
                info@iebusinessconsultants.com
              </a>.
            </p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white mt-12 py-6 px-6 text-center text-xs text-gray-400">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          <a href="mailto:info@iebusinessconsultants.com" className="hover:text-gray-600">Contact</a>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} IEBC. All rights reserved.</p>
      </div>
    </main>
  )
}

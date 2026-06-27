import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCanonical } from "@/hooks/useCanonical";

export default function Terms() {
  useCanonical("/terms");
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: June 26, 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <p>
            Welcome to Donmac Data Hub. By accessing or using our website{" "}
            <a href="https://donmacdatahub.com" className="text-primary underline">https://donmacdatahub.com</a>{" "}
            ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree, please do not
            use the Service.
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-2">1. Eligibility</h2>
            <p>
              You must be at least 18 years old (or the legal age in your jurisdiction) to create an account and use
              the Service. By registering, you confirm that the information you provide is accurate and belongs to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Account & Security</h2>
            <p>
              You are responsible for keeping your login credentials confidential and for all activity that occurs
              under your account. Notify us immediately at donmacdatahub@gmail.com if you suspect unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Services Offered</h2>
            <p>
              We provide the purchase of mobile data bundles, airtime, and related digital services for MTN, Telecel,
              and AirtelTigo networks in Ghana. Bundle availability, pricing, and validity periods may change at any
              time without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Payments & Wallet</h2>
            <p>
              All transactions are denominated in Ghana Cedis (₵). Payments may be made via Paystack or by topping up
              your wallet through approved Mobile Money channels. You are responsible for entering the correct
              recipient phone number — orders placed to the wrong number cannot be reversed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Delivery</h2>
            <p>
              Most orders are delivered instantly; MTN orders may take between 3 minutes and 4 hours. Orders placed
              between 10:00 PM and 5:00 AM UTC may be queued and processed at 5:00 AM. Delivery times depend on
              network operators and are not guaranteed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Refunds</h2>
            <p>
              If an order fails, the amount is automatically refunded to your wallet. We do not refund successfully
              delivered orders or orders placed to a wrong number provided by you. Disputes must be reported via the
              Complaints section within 48 hours of the order.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any unlawful, fraudulent, or abusive purpose.</li>
              <li>Attempt to bypass security, exploit vulnerabilities, or interfere with normal operations.</li>
              <li>Resell or redistribute services outside the official Agent / Reseller programs.</li>
              <li>Submit false information or impersonate another person.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Account Suspension & Termination</h2>
            <p>
              We reserve the right to suspend or permanently delete any account that violates these Terms, engages in
              fraud, or attempts to abuse promotions, referrals, or our payment systems.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Privacy</h2>
            <p>
              Your use of the Service is also governed by our{" "}
              <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Limitation of Liability</h2>
            <p>
              Donmac Data Hub is not liable for indirect, incidental, or consequential damages resulting from
              network operator delays, downtime, or failed deliveries beyond our control. Our maximum liability for
              any claim is limited to the amount you paid for the affected order.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">11. Changes to These Terms</h2>
            <p>
              We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance
              of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">12. Contact Us</h2>
            <p>
              For any questions about these Terms, contact us at:{" "}
              <a href="mailto:donmacdatahub@gmail.com" className="text-primary underline">donmacdatahub@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

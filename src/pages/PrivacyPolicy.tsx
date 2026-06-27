import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCanonical } from "@/hooks/useCanonical";

export default function PrivacyPolicy() {
  useCanonical("/privacy");
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: June 26, 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <p>
            This Privacy Policy describes how Donmac Data Hub ("we") collects, uses, and protects your data on our
            website <a href="https://donmacdatahub.com" className="text-primary underline">https://donmacdatahub.com</a>.
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-2">1. Data We Collect</h2>
            <p>We collect the following data: Name, Email, Phone number.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Use of Data</h2>
            <p>Collected data is used to provide services, improve the website, and for analytics purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Data Protection</h2>
            <p>We implement technical and organizational measures to protect your data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Sharing Data with Third Parties</h2>
            <p>We do not share your data with third parties, except as required by law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Your Rights</h2>
            <p>
              You may request access, correction, or deletion of your data by contacting us at:{" "}
              <a href="mailto:donmacdatahub@gmail.com" className="text-primary underline">donmacdatahub@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Contact Us</h2>
            <p>
              If you have any questions, please contact us at:{" "}
              <a href="mailto:donmacdatahub@gmail.com" className="text-primary underline">donmacdatahub@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { useCanonical } from "@/hooks/useCanonical";
import { Wifi, Zap, Shield, Clock, Star, ChevronRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const networks = [
  { name: "MTN", color: "bg-yellow-500", desc: "Cheapest MTN data bundles in Ghana – from 1GB to 100GB+" },
  { name: "Telecel", color: "bg-red-500", desc: "Affordable Telecel (Vodafone) data packages at unbeatable prices" },
  { name: "AirtelTigo", color: "bg-blue-500", desc: "Budget-friendly AirtelTigo data bundles for everyone" },
];

const features = [
  { icon: Zap, title: "Fast Delivery", desc: "Data bundles delivered to your phone within 3–30 minutes of purchase" },
  { icon: Shield, title: "Secure Payments", desc: "Pay safely via Mobile Money (MoMo) or Paystack. 100% secure" },
  { icon: Clock, title: "24/7 Availability", desc: "Buy cheap data bundles anytime, day or night, from anywhere in Ghana" },
  { icon: Star, title: "Lowest Prices", desc: "We guarantee the cheapest data bundle prices in Ghana. Save more!" },
];

const faqs = [
  {
    q: "How do I buy cheap MTN data bundles?",
    a: "Simply register on Donmac Data Hub, top up your wallet via MoMo or Paystack, choose your MTN data bundle size, enter your phone number, and get instant delivery. It's the easiest way to buy cheap MTN data in Ghana.",
  },
  {
    q: "What networks do you support?",
    a: "We support all major Ghana networks: MTN, Telecel (formerly Vodafone), and AirtelTigo. All at the cheapest data bundle prices you'll find online.",
  },
  {
    q: "Is it safe to buy data bundles online?",
    a: "Absolutely! Donmac Data Hub uses secure payment processing via Paystack and Mobile Money. Your transactions are encrypted and your data is protected.",
  },
  {
    q: "How fast is the data delivery?",
    a: "Data bundles are delivered instantly – usually within 5-30 seconds after payment confirmation. No waiting, no delays.",
  },
  {
    q: "Can I become a data reseller/agent?",
    a: "Yes! Donmac Data Hub offers an agent program where you can buy data at even cheaper wholesale prices and resell for profit. Apply through your dashboard.",
  },
];

export default function Landing() {
  useCanonical("/");

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "landing-jsonld";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          name: "Donmac Data Hub",
          url: "https://donmacdatahub.com",
          description: "Buy the cheapest data bundles in Ghana. MTN, Telecel & AirtelTigo data at the lowest prices with instant delivery.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://donmacdatahub.com/?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        },
        {
          "@type": "Organization",
          name: "Donmac Data Hub",
          url: "https://donmacdatahub.com",
          logo: "https://donmacdatahub.com/favicon.png",
          description: "Ghana's most affordable data bundle platform. Buy cheap MTN, Telecel & AirtelTigo data online.",
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            availableLanguage: "English",
          },
          sameAs: [],
        },
        {
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
      ],
    });
    document.head.appendChild(script);
    return () => {
      document.getElementById("landing-jsonld")?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-90" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="flex justify-center mb-6">
            <img src="/favicon.png" alt="Donmac Data Hub logo" className="w-16 h-16 rounded-xl" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-primary-foreground mb-4 leading-tight">
            Cheap Data Bundles Ghana – Buy MTN, Telecel &amp; AirtelTigo Data Online
          </h1>
          <p className="text-lg sm:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-8">
            Donmac Data Hub offers the <strong>cheapest data bundles in Ghana</strong>. Buy affordable MTN data, Telecel data, and AirtelTigo data with <strong>instant delivery</strong>. Save up to 40% on every purchase!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" variant="secondary" className="text-base font-semibold px-8">
              <Link to="/register">
                Get Started – Buy Cheap Data <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
            <Button asChild size="lg" className="text-base bg-white text-primary font-semibold hover:bg-white/90 border-0">
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Networks */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
          Cheapest Data Bundles for All Ghana Networks
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {networks.map((n) => (
            <article key={n.name} className="bg-card border border-border rounded-xl p-6 text-center">
              <div className={`w-12 h-12 ${n.color} rounded-full mx-auto mb-3 flex items-center justify-center`}>
                <Wifi className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{n.name} Cheap Data Bundles</h3>
              <p className="text-sm text-muted-foreground">{n.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="bg-muted/50 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
            Why Buy Data from Donmac Data Hub?
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-5 text-center">
                <f.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
          How to Buy Cheap Data Bundles Online in Ghana
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Create Free Account", desc: "Register on Donmac Data Hub in 30 seconds. No fees, no hidden charges." },
            { step: "2", title: "Top Up Your Wallet", desc: "Add funds via Mobile Money (MoMo) or Paystack. Quick and secure." },
            { step: "3", title: "Buy & Receive Data Instantly", desc: "Choose your network & bundle size. Data delivered to your phone in seconds!" },
          ].map((s) => (
            <div key={s.step} className="bg-card border border-border rounded-xl p-6 text-center">
              <div className="w-10 h-10 gradient-primary rounded-full mx-auto mb-3 flex items-center justify-center text-primary-foreground font-bold">
                {s.step}
              </div>
              <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-muted/50 py-12">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
            Frequently Asked Questions – Cheap Data Ghana
          </h2>
          <div className="space-y-4">
            {faqs.map((f, i) => (
              <details key={i} className="bg-card border border-border rounded-xl p-4 group">
                <summary className="font-semibold text-foreground cursor-pointer list-none flex items-center justify-between">
                  {f.q}
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-sm text-muted-foreground mt-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          Ready to Buy the Cheapest Data in Ghana?
        </h2>
        <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
          Join thousands of Ghanaians saving money on MTN, Telecel, and AirtelTigo data bundles every day.
        </p>
        <Button asChild size="lg" className="gradient-primary border-0 text-base font-semibold px-8">
          <Link to="/register">
            Sign Up Now – It's Free <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>© 2026 Donmac Data Hub. Ghana's #1 platform for cheap data bundles online.</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link to="/login" className="hover:text-primary">Login</Link>
          <Link to="/register" className="hover:text-primary">Register</Link>
        </div>
      </footer>
    </div>
  );
}

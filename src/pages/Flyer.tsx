import { formatCurrency } from "@/lib/data";
import { useCustomBundles } from "@/hooks/useCustomBundles";
import { useActivePromo } from "@/hooks/useActivePromo";
import { useCanonical } from "@/hooks/useCanonical";

import mtnLogo from "@/assets/networks/mtn.png";
import telecelLogo from "@/assets/networks/telecel.png";
import airteltigoLogo from "@/assets/networks/airteltigo.png";

const networkConfig: Record<string, { gradient: string; textColor: string; logo: string }> = {
  mtn: {
    gradient: "from-yellow-400 to-amber-500",
    textColor: "text-white",
    logo: mtnLogo,
  },
  telecel: {
    gradient: "from-red-500 to-red-600",
    textColor: "text-white",
    logo: telecelLogo,
  },
  "at-bigtime": {
    gradient: "from-sky-500 to-sky-700",
    textColor: "text-white",
    logo: airteltigoLogo,
  },
  "at-premium": {
    gradient: "from-sky-600 to-sky-800",
    textColor: "text-white",
    logo: airteltigoLogo,
  },
};

export default function Flyer() {
  useCanonical("/flyer");
  const { networks } = useCustomBundles();
  const { promo, applyDiscount } = useActivePromo("general");

  return (
    <div className="min-h-screen bg-gray-100 p-4 print:p-2 print:bg-white">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
          DONMAC DATA HUB
        </h1>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          Affordable Data Bundles • Fast Delivery • All Networks
        </p>
        {promo && (
          <div className="mt-2 inline-block bg-green-100 text-green-800 rounded-full px-4 py-1 font-bold text-sm">
            🎉 {promo.discount_percent}% OFF all prices! {promo.description}
          </div>
        )}
      </div>

      {/* Networks */}
      {networks.map((network) => {
        const config = networkConfig[network.id];
        if (!config || network.bundles.length === 0) return null;

        return (
          <div key={network.id} className="mb-8">
            {/* Network header with logo */}
            <div className="flex items-center gap-3 mb-3">
              <img
                src={config.logo}
                alt={`${network.name} logo`}
                className="w-10 h-10 rounded-full object-contain bg-white shadow-sm"
              />
              <h2 className="text-xl font-bold text-gray-800">{network.name}</h2>
            </div>

            {/* Bundle cards grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {network.bundles.map((bundle) => {
                const finalPrice = promo
                  ? applyDiscount(bundle.generalPrice)
                  : bundle.generalPrice;

                return (
                  <div
                    key={bundle.size}
                    className={`bg-gradient-to-br ${config.gradient} rounded-2xl p-4 flex flex-col items-center justify-center aspect-square shadow-md relative overflow-hidden`}
                  >
                    {/* Subtle logo watermark */}
                    <img
                      src={config.logo}
                      alt=""
                      className="absolute top-2 right-2 w-6 h-6 opacity-30 rounded-full"
                    />

                    {/* Size number */}
                    <span className={`text-4xl md:text-5xl font-extrabold ${config.textColor} drop-shadow-sm`}>
                      {bundle.sizeGB}
                    </span>
                    <span className={`text-xs font-bold ${config.textColor} tracking-widest uppercase mt-1`}>
                      GIGABYTES
                    </span>

                    {/* Price */}
                    <div className="mt-3">
                      {promo ? (
                        <div className="flex flex-col items-center">
                          <span className={`text-xs ${config.textColor} opacity-60 line-through`}>
                            {formatCurrency(bundle.generalPrice)}
                          </span>
                          <span className={`text-lg font-extrabold ${config.textColor}`}>
                            {formatCurrency(finalPrice)}
                          </span>
                        </div>
                      ) : (
                        <span className={`text-lg font-extrabold ${config.textColor}`}>
                          {formatCurrency(bundle.generalPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div className="text-center mt-6 py-4 border-t border-gray-200">
        <p className="text-lg font-bold text-gray-800">📞 WhatsApp: 0549358359</p>
        <p className="text-gray-500 text-xs mt-1">
          MTN: 3 mins – 4hrs+ • Telecel, AT Big Time & AT Premium: Instant
        </p>
        <p className="text-gray-400 text-[10px] mt-2">© Donmac Data Hub</p>
      </div>

      <button
        onClick={() => window.print()}
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg font-bold hover:opacity-90 transition print:hidden"
      >
        🖨️ Print / Save as PDF
      </button>
    </div>
  );
}

import { networks, formatCurrency } from "@/lib/data";
import { useHiddenBundles } from "@/hooks/useHiddenBundles";

const networkStyles: Record<string, { bg: string; header: string; text: string }> = {
  mtn: { bg: "bg-yellow-400", header: "bg-yellow-500", text: "text-yellow-900" },
  telecel: { bg: "bg-red-500", header: "bg-red-600", text: "text-white" },
  "at-bigtime": { bg: "bg-sky-500", header: "bg-sky-600", text: "text-white" },
  "at-premium": { bg: "bg-sky-700", header: "bg-sky-800", text: "text-white" },
};

const deliveryInfo: Record<string, string> = {
  mtn: "3 mins – 4hrs+",
  telecel: "Instant",
  "at-bigtime": "Instant",
  "at-premium": "Instant",
};

export default function Flyer() {
  const { isHidden } = useHiddenBundles();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 print:p-0 print:bg-white">
      <div
        className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-[900px] print:rounded-none print:shadow-none"
        style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white text-center py-6 px-4">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            DONMAC DATA HUB
          </h1>
          <p className="text-indigo-200 text-sm mt-1 font-medium">
            Affordable Data Bundles • Fast Delivery • All Networks
          </p>
        </div>

        {/* Networks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 md:p-6">
          {networks.map((network) => {
            const style = networkStyles[network.id];
            const visibleBundles = network.bundles.filter(b => !isHidden(network.id, b.size));
            if (visibleBundles.length === 0) return null;
            return (
              <div key={network.id} className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                {/* Network Header */}
                <div className={`${style.header} ${style.text} py-3 px-4 flex items-center justify-between`}>
                  <div>
                    <h2 className="text-lg font-bold">{network.name}</h2>
                    <p className="text-xs opacity-80">
                      Delivery: {deliveryInfo[network.id]}
                    </p>
                  </div>
                  <span className="text-xs font-semibold bg-white/20 rounded-full px-2 py-0.5">
                    {visibleBundles.length} bundles
                  </span>
                </div>

                {/* Price Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600">
                      <th className="py-1.5 px-3 text-left font-semibold">Data</th>
                      <th className="py-1.5 px-3 text-right font-semibold">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {network.bundles.map((bundle, i) => (
                      <tr
                        key={bundle.size}
                        className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="py-1.5 px-3 font-medium text-gray-800">
                          {bundle.size}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-gray-900">
                          {formatCurrency(bundle.generalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white text-center py-5 px-4">
          <p className="text-lg font-bold">📞 WhatsApp: 0549358359</p>
          <p className="text-indigo-200 text-xs mt-1">
            MTN delivery: 3 minutes to 4 hours or more (depending on the network) • Telecel, AT Big Time & AT Premium: Instant delivery
          </p>
          <p className="text-indigo-300 text-[10px] mt-2">© Donmac Data Hub • Affordable data for everyone</p>
        </div>
      </div>

      {/* Print button - hidden on print */}
      <button
        onClick={() => window.print()}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-lg font-bold hover:bg-indigo-700 transition print:hidden"
      >
        🖨️ Print / Save as PDF
      </button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useProductToggles() {
  const [mashupEnabled, setMashupEnabled] = useState(true);
  const [airtimeEnabled, setAirtimeEnabled] = useState(true);
  const [vsEnabled, setVsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchToggles = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["mashup_enabled", "airtime_enabled", "vs_enabled"]);
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.mashup_enabled !== undefined) setMashupEnabled(map.mashup_enabled !== false);
      if (map.airtime_enabled !== undefined) setAirtimeEnabled(map.airtime_enabled !== false);
      if (map.vs_enabled !== undefined) setVsEnabled(map.vs_enabled !== false);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchToggles();
    const ch = supabase
      .channel(`app-settings-toggles-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => fetchToggles(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return { mashupEnabled, airtimeEnabled, vsEnabled, loading, refresh: fetchToggles };
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TOGGLE_KEYS = [
  "mashup_enabled",
  "airtime_enabled",
  "vs_enabled",
  "mashup_data_enabled",
  "mtn_enabled",
  "telecel_enabled",
  "at_premium_enabled",
  "at_bigtime_enabled",
] as const;

export function useProductToggles() {
  const [mashupEnabled, setMashupEnabled] = useState(true);
  const [airtimeEnabled, setAirtimeEnabled] = useState(true);
  const [vsEnabled, setVsEnabled] = useState(true);
  const [mashupDataEnabled, setMashupDataEnabled] = useState(true);
  const [mtnEnabled, setMtnEnabled] = useState(true);
  const [telecelEnabled, setTelecelEnabled] = useState(true);
  const [atPremiumEnabled, setAtPremiumEnabled] = useState(true);
  const [atBigtimeEnabled, setAtBigtimeEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchToggles = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", TOGGLE_KEYS as unknown as string[]);
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.mashup_enabled !== undefined) setMashupEnabled(map.mashup_enabled !== false);
      if (map.airtime_enabled !== undefined) setAirtimeEnabled(map.airtime_enabled !== false);
      if (map.vs_enabled !== undefined) setVsEnabled(map.vs_enabled !== false);
      if (map.mashup_data_enabled !== undefined) setMashupDataEnabled(map.mashup_data_enabled !== false);
      if (map.mtn_enabled !== undefined) setMtnEnabled(map.mtn_enabled !== false);
      if (map.telecel_enabled !== undefined) setTelecelEnabled(map.telecel_enabled !== false);
      if (map.at_premium_enabled !== undefined) setAtPremiumEnabled(map.at_premium_enabled !== false);
      if (map.at_bigtime_enabled !== undefined) setAtBigtimeEnabled(map.at_bigtime_enabled !== false);
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

  return {
    mashupEnabled,
    airtimeEnabled,
    vsEnabled,
    mashupDataEnabled,
    mtnEnabled,
    telecelEnabled,
    atPremiumEnabled,
    atBigtimeEnabled,
    loading,
    refresh: fetchToggles,
  };
}

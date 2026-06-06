import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "donmac_reseller_ref";

/** Parses the standard URL for a ?ref=R001 query and persists it. Runs once on app boot. */
export function useCaptureResellerRef() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && ref.trim().length > 0 && ref.trim().length < 32) {
        window.localStorage.setItem(STORAGE_KEY, ref.trim().toUpperCase());
      }
    } catch {
      // ignore
    }
  }, []);
}

export function getStoredResellerRef(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredResellerRef() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Attempts to bind the currently-signed-in user to the stored reseller code. Safe to call repeatedly. */
export async function bindStoredResellerRef(): Promise<boolean> {
  const code = getStoredResellerRef();
  if (!code) return false;
  try {
    const { data, error } = await (supabase as any).rpc("bind_reseller", { p_code: code });
    if (error) {
      console.warn("bind_reseller failed:", error.message);
      return false;
    }
    // Whether or not the bind happened (e.g. already bound), clear the ref so we stop retrying.
    clearStoredResellerRef();
    return data === true;
  } catch (e) {
    console.warn("bind_reseller exception:", e);
    return false;
  }
}

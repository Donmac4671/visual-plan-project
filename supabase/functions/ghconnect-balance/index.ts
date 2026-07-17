import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
    
    if (!GH_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "GHDATACONNECT_API_KEY missing",
          message: "Server configuration error"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Get the auth token from the request
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing authorization",
          message: "Please log in to access this feature"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Verify the user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid session",
          message: "Your session has expired. Please log in again."
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Call the GHDataConnect API
    const response = await fetch(
      "https://ghdataconnect.com/api/v1/getWalletBalance",
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${GH_API_KEY}`,
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GHConnect API error:", response.status, errorText);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: "External API error",
          message: `Failed to fetch balance: ${response.status}`
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const result = await response.json();
    console.log("GHConnect API response:", result);

    // Return the balance data
    return new Response(
      JSON.stringify({
        success: true,
        data: result
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Balance error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {

    const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");

    console.log(
      "GH API Key exists:",
      !!GH_API_KEY
    );

    if (!GH_API_KEY) {
      throw new Error(
        "GHDATACONNECT_API_KEY missing"
      );
    }


    // Verify logged-in user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );


    const authHeader =
      req.headers.get("Authorization");


    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success:false,
          message:"Missing user authorization"
        }),
        {
          status:401,
          headers:{
            ...corsHeaders,
            "Content-Type":"application/json"
          }
        }
      );
    }


    const token =
      authHeader.replace("Bearer ", "");


    const {
      data:{user},
      error
    } =
      await supabase.auth.getUser(token);


    if (error || !user) {

      return new Response(
        JSON.stringify({
          success:false,
          message:"Invalid user session"
        }),
        {
          status:401,
          headers:{
            ...corsHeaders,
            "Content-Type":"application/json"
          }
        }
      );
    }



    const response =
      await fetch(
        "https://ghdataconnect.com/api/v1/getWalletBalance",
        {
          method:"GET",
          headers:{
            "Authorization":
              `Bearer ${GH_API_KEY}`,
            "Accept":
              "application/json"
          }
        }
      );


    console.log(
      "GH status:",
      response.status
    );


    const raw =
      await response.text();


    console.log(
      "GH raw response:",
      raw
    );


    let result;

    try {
      result = JSON.parse(raw);
    } catch {
      result = {
        message: raw
      };
    }


    return new Response(
      JSON.stringify({
        success:true,
        data:result
      }),
      {
        headers:{
          ...corsHeaders,
          "Content-Type":
          "application/json"
        }
      }
    );


  } catch(error){

    console.error(
      "Balance error:",
      error
    );


    return new Response(
      JSON.stringify({
        success:false,
        message:
        error instanceof Error
        ? error.message
        : "Unknown error"
      }),
      {
        status:500,
        headers:{
          ...corsHeaders,
          "Content-Type":
          "application/json"
        }
      }
    );
  }

});

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)


export async function GET() {
    return Response.redirect("https://cal-afrik.vercel.app/scanner")
}

export async function POST(req: Request) {
    try {
        const body = await req.json()

        const transaction = body?.["v1/transaction"]

        // ✅ si paiement validé
        if (transaction?.status === "approved") {
            const email = transaction?.customer?.email

            if (!email) return NextResponse.json({ success: false })

            // 🔥 trouver utilisateur
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("email", email)
                .single()

            if (profile) {
                // 🔥 activer premium
                await supabase
                    .from("user_profiles")
                    .update({ plan: "premium" })
                    .eq("user_id", profile.user_id)
            }
        }

        return NextResponse.json({ received: true })

    } catch (err) {
        return NextResponse.json({ success: false })
    }
}
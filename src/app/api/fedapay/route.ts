import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        const body = await req.json()

        const FEDAPAY_KEY = process.env.FEDAPAY_SECRET_KEY

        // 🔥 créer transaction
        const transactionRes = await fetch("https://api.fedapay.com/v1/transactions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${FEDAPAY_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                description: "Abonnement Cal-Afrik",
                amount: 1500,
                currency: { iso: "XOF" },

                // 🔥 IMPORTANT
                callback_url: "https://cal-afrik.vercel.app/api/fedapay/webhook",

                return_url: "https://cal-afrik.vercel.app/success",
                cancel_url: "https://cal-afrik.vercel.app/scanner",

                customer: {
                    firstname: "User",
                    lastname: "CalAfrik",
                    email: body.email
                },
                // ✅ Ajout des métadonnées pour que le webhook puisse mettre à jour la base de données
                metadata: {
                    user_id: body.userId || body.user_id,
                    tier: body.tier
                },
                custom_metadata: {
                    user_id: body.userId || body.user_id,
                    tier: body.tier
                }
            })
        })

        const transactionData = await transactionRes.json()

        // 🔥 récupérer transaction même si status faux
        const transaction = transactionData?.["v1/transaction"]

        if (!transaction?.id) {
            return NextResponse.json({
                success: false,
                error: transactionData
            })
        }

        const transactionId = transaction.id

        // 🔥 créer token paiement
        const tokenRes = await fetch(
            `https://api.fedapay.com/v1/transactions/${transactionId}/token`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${FEDAPAY_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        )

        const tokenData = await tokenRes.json()

        const paymentUrl =
            tokenData?.url ||
            tokenData?.v1_url ||
            tokenData?.data?.url

        if (!paymentUrl) {
            return NextResponse.json({
                success: false,
                error: tokenData
            })
        }

        return NextResponse.json({
            success: true,
            data: { url: paymentUrl }
        })

    } catch (err) {
        return NextResponse.json({
            success: false,
            error: "Erreur serveur"
        })
    }
}
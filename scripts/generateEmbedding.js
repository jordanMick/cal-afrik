import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import fetch from "node-fetch"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function generateEmbeddings() {
    console.log("🚀 START EMBEDDINGS")

    const { data: foods, error } = await supabase
        .from("food_items")
        .select("*")

    if (error) {
        console.error("❌ DB ERROR:", error)
        return
    }

    for (const food of foods) {
        if (!food.image_url) continue
        if (food.embedding) {
            console.log(`⏭️ Skip ${food.name_fr}`)
            continue
        }

        console.log(`🧠 Processing: ${food.name_fr}`)

        try {
            const res = await fetch("http://127.0.0.1:8000/embed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image_url: food.image_url
                })
            })

            const json = await res.json()

            if (!json.success) {
                console.log("❌ EMBED ERROR:", json.error)
                continue
            }

            const { error: updateError } = await supabase
                .from("food_items")
                .update({
                    embedding: json.embedding
                })
                .eq("id", food.id)

            if (updateError) {
                console.log("❌ UPDATE ERROR:", updateError)
            } else {
                console.log(`✅ Done: ${food.name_fr}`)
            }

        } catch (err) {
            console.error("❌ FETCH ERROR:", err)
        }
    }

    console.log("🎉 FINISHED")
}

generateEmbeddings()
import supabase from "../supabaseClient";
import { getTodayPrompts } from "../lib/dbHelpers";  // ← add this

export async function getDailyPrompt() {
  const today = new Date().toISOString().split("T")[0];
  console.log("Using date:", today);

  // NEW CORRECT LOGIC:
  const { prompts, error } = await getTodayPrompts({ dateString: today });

  if (error) {
    console.error("Error loading today's prompts:", error);
    return null;
  }

  if (!prompts.length) {
    console.warn("No prompts found for today.");
    return null;
  }

  return {
    id: prompts[0].id,
    prompt_text: prompts[0].prompt_text,
  };
}
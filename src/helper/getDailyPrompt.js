import supabase from "../supabaseClient";

export async function getDailyPrompt() {
    const today = new Date().toISOString().split("T")[0];
  console.log("Using date:", today);

  // 1. Check if today's global prompt exists
  const { data: existingPrompt, error: fetchError } = await supabase
    .from("user_daily_prompts")
    .select("*")
    .eq("date", today)
    .is("user_id", null)
    .maybeSingle();  // FIXED

  if (fetchError) {
    console.error("Error fetching today's prompt:", fetchError);
    return null;
  }

  if (existingPrompt) {
    console.log("Existing prompt found:", existingPrompt);

    const { data: promptData, error: joinError } = await supabase
      .from("prompts")
      .select("*")
      .eq("id", existingPrompt.prompt_id)
      .single();

    if (joinError) {
      console.error("Error loading prompt text:", joinError);
      return null;
    }

    return {
      id: existingPrompt.id,
      prompt_text: promptData.prompt_text,
    };
  }

  // 2. No prompt yet → pick a random one
  const { data: randomPrompt, error: randomError } = await supabase
    .from("prompts")
    .select("id, prompt_text")
    .order("id") // this doesn't randomize but avoids breaking. We'll fix later.
    .limit(1)
    .maybeSingle();

  if (randomError || !randomPrompt) {
    console.error("Error selecting random prompt:", randomError);
    return null;
  }

  console.log("Selected random prompt:", randomPrompt);

  // 3. Insert global prompt
  const { error: insertError } = await supabase
    .from("user_daily_prompts")
    .insert({
      user_id: null,
      prompt_id: randomPrompt.id,
      date: today,
      source: "system",
    });

  if (insertError) {
    console.error("Insert error:", insertError);
    return null;
  }

  return {
    id: randomPrompt.id,
    prompt_text: randomPrompt.prompt_text,
  };
}

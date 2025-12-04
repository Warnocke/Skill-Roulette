// src/lib/dbHelpers.js
// Centralized helper functions for talking to Supabase.
// This file is meant to be used by ALL teammates so everyone uses
// the same patterns and the same queries.
//
// All helpers follow the pattern:
//   - Return an object: { data, error } or { user, error }, etc.
//   - Never throw — callers should check `if (error)` then handle it.
//
// NOTE: This assumes you already have `supabaseClient.js` that exports
//   `export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`
import  supabase  from "../supabaseClient";

/* --------------------------------------------------------------------------
 * SECTION 1: AUTH & PROFILES
 *
 * Tables involved:
 *   - auth.users   (managed by Supabase Auth)
 *   - public.profiles (your custom profile table with RLS)
 *
 * Important DB behavior:
 *   - When a new user signs up, a trigger on `auth.users` auto-inserts a
 *     matching row into `public.profiles`. Frontend does NOT insert into
 *     `profiles` directly. It only reads/updates.
 * ------------------------------------------------------------------------ */

/**
 * Sign up a user using email + password.
 *
 * This helper:
 *   - Calls Supabase Auth to create a new user.
 *   - Optionally sends `display_name` as metadata so your trigger can use it.
 *
 * INPUT:
 *   params: {
 *     email: string,       // e.g. "student@ufl.edu"
 *     password: string,    // must meet Supabase password policy
 *     displayName?: string // optional; if omitted, profile.display_name = null
 *   }
 *
 * RETURN:
 *   Promise<{ user: User | null, error: AuthError | null }>
 *
 * USAGE EXAMPLE:
 *   const { user, error } = await signUpWithEmail({
 *     email: "test@example.com",
 *     password: "Test1234!",
 *     displayName: "Charan"
 *   });
 */
export async function signUpWithEmail({ email, password, displayName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // `options.data` goes into raw_user_meta_data, which your trigger
    // can read to prefill display_name if you want.
    options: {
      data: {
        display_name: displayName ?? null,
      },
    },
  });

  // data.user is the created user (or null if error)
  return { user: data?.user ?? null, error };
}

/**
 * Sign in an existing user using email + password.
 *
 * INPUT:
 *   params: {
 *     email: string,
 *     password: string
 *   }
 *
 * RETURN:
 *   Promise<{ user: User | null, error: AuthError | null }>
 *
 * Note:
 *   - On success, Supabase stores a session (access token + refresh token)
 *     in memory/storage.
 *   - The session will be used automatically for subsequent authenticated
 *     requests (e.g., to RLS-protected tables).
 */
export async function signInWithEmail({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // For most frontend use cases, you may care only that `error` is null.
  // `data.user` is the logged-in user; `data.session` is the auth session.
  return { user: data?.user ?? null, error };
}

/**
 * Sign out the current user.
 *
 * INPUT:
 *   none
 *
 * RETURN:
 *   Promise<{ error: AuthError | null }>
 *
 * USAGE:
 *   const { error } = await signOut();
 *   if (error) { /* show error message *\/ }
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get the currently authenticated user (from session).
 *
 * This uses Supabase Auth and does NOT query your `profiles` table.
 * Useful when you just need the user id, email, etc.
 *
 * INPUT:
 *   none
 *
 * RETURN:
 *   Promise<{ user: User | null, error: AuthError | null }>
 *
 * USAGE:
 *   const { user, error } = await getCurrentUser();
 *   if (user) {
 *     console.log("User id:", user.id, "email:", user.email);
 *   }
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  return { user: data?.user ?? null, error };
}

/**
 * Fetch the current user's profile row from public.profiles.
 *
 * This function:
 *   1. Gets the current auth user (supabase.auth.getUser())
 *   2. Uses user.id to look up the matching row in `profiles`
 *
 * INPUT:
 *   none
 *
 * RETURN:
 *   Promise<{ profile: ProfileRow | null, error: PostgrestError | AuthError | null }>
 *
 *   - profile has fields: id, display_name, avatar_url, bio,
 *     created_at, updated_at
 *
 * USAGE:
 *   const { profile, error } = await getCurrentUserProfile();
 *   if (profile) {
 *     console.log("Display name:", profile.display_name);
 *   }
 */
export async function getCurrentUserProfile() {
  // Step 1: get auth user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { profile: null, error: userError };
  }
  const user = userData?.user;
  if (!user) {
    return { profile: null, error: new Error("No authenticated user") };
  }

  // Step 2: try to fetch existing profile
  let { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, bio, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle(); // returns null if no row, WITHOUT error

  if (error) {
    // Some actual DB error (not "0 rows")
    return { profile: null, error };
  }

  if (data) {
    // Profile already exists
    return { profile: data, error: null };
  }

  // Step 3: no profile yet -> create one
  const initialProfile = {
    id: user.id, // must match auth.uid()
    display_name: user.user_metadata?.display_name ?? null,
    avatar_url: null,
    bio: null,
  };

  const insertResult = await supabase
    .from("profiles")
    .insert(initialProfile)
    .select("id, display_name, avatar_url, bio, created_at, updated_at")
    .single();

  if (insertResult.error) {
    return { profile: null, error: insertResult.error };
  }

  return { profile: insertResult.data, error: null };
}


/**
 * Update the current user's profile.
 *
 * This updates the row in `public.profiles` where `id = auth.uid()`.
 * RLS policy on the table must allow UPDATE only for that row.
 *
 * INPUT:
 *   params: {
 *     displayName?: string | null,
 *     bio?: string | null,
 *     avatarUrl?: string | null
 *   }
 *
 *   - All fields are optional; only provided keys will be updated.
 *   - Pass `null` explicitly to clear a value (e.g., set avatar_url = null).
 *
 * RETURN:
 *   Promise<{ profile: ProfileRow | null, error: PostgrestError | AuthError | null }>
 *
 * USAGE:
 *   const { profile, error } = await updateCurrentUserProfile({
 *     displayName: "New Name",
 *     bio: "CS Student @ UF",
 *   });
 */
export async function updateCurrentUserProfile({
  displayName,
  bio,
  avatarUrl,
}) {
  // First, get the current user id
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { profile: null, error: userError };
  }
  const user = userData?.user;
  if (!user) {
    return { profile: null, error: new Error("No authenticated user") };
  }

  // Build an update payload with only the fields that are provided
  const updatePayload = {};
  if (displayName !== undefined) updatePayload.display_name = displayName;
  if (bio !== undefined) updatePayload.bio = bio;
  if (avatarUrl !== undefined) updatePayload.avatar_url = avatarUrl;

  // If nothing to update, just return current profile
  if (Object.keys(updatePayload).length === 0) {
    const { profile, error } = await getCurrentUserProfile();
    return { profile, error };
  }

  // Perform the update
  const { data, error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id)
    .select("id, display_name, avatar_url, bio, created_at, updated_at")
    .single();

  return { profile: data ?? null, error };
}

/* --------------------------------------------------------------------------
 * SECTION 2: DAILY PROMPTS & ROULETTE
 *
 * Tables involved:
 *   - public.prompts
 *       id: bigint
 *       prompt_text: text
 *       active_on: date (YYYY-MM-DD)
 *       created_at: timestamptz
 *       updated_at: timestamptz
 *
 *   - public.user_daily_prompts
 *       id: bigint
 *       user_id: uuid (FK to profiles.id / auth.users.id)
 *       prompt_id: bigint (FK to prompts.id)
 *       date: date (YYYY-MM-DD)
 *       source: text ('spin' | 'manual_select' | null)
 *       created_at: timestamptz
 *       updated_at: timestamptz
 *
 * Behavior:
 *   - For each (user_id, date) there should be AT MOST ONE row in
 *     user_daily_prompts (enforced by a unique constraint in the DB).
 *   - These helpers use `YYYY-MM-DD` strings for dates.
 *   - If date is omitted, we default to "today" using the client's clock.
 * ------------------------------------------------------------------------ */

/**
 * Get today's date in "YYYY-MM-DD" format.
 *
 * This is a small internal helper used by the prompt functions.
 */
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; // YYYY-MM-DD in LOCAL time
}


/**
 * Fetch all prompts for a given date (default: today).
 *
 * INPUT:
 *   params (optional): {
 *     dateString?: string  // "YYYY-MM-DD". If omitted, uses today's date.
 *   }
 *
 * RETURN:
 *   Promise<{ prompts: Array<PromptRow>, error: PostgrestError | null }>
 *
 *   PromptRow fields:
 *     - id: number
 *     - prompt_text: string
 *     - active_on: string (YYYY-MM-DD)
 *     - created_at: string (ISO timestamp)
 *     - updated_at: string (ISO timestamp)
 *
 * USAGE EXAMPLE:
 *   const { prompts, error } = await getTodayPrompts();
 *   // or:
 *   const { prompts, error } = await getTodayPrompts({ dateString: "2025-03-15" });
 */
export async function getTodayPrompts({ dateString } = {}) {
  const targetDate = dateString ?? getTodayDateString();

  const { data, error } = await supabase
    .from("prompts")
    .select("id, prompt_text, active_on, created_at, updated_at")
    .eq("active_on", targetDate)
    .order("created_at", { ascending: false });

  return { prompts: data ?? [], error };
}

/**
 * Fetch the current user's chosen prompt for a given date (default: today).
 *
 * This joins user_daily_prompts with prompts so teammates can easily show
 * prompt text and metadata.
 *
 * INPUT:
 *   params (optional): {
 *     dateString?: string  // "YYYY-MM-DD". Defaults to today if omitted.
 *   }
 *
 * RETURN:
 *   Promise<{
 *     record: {
 *       id: number,           // user_daily_prompts.id
 *       date: string,         // "YYYY-MM-DD"
 *       source: string | null,
 *       prompt: {
 *         id: number,
 *         prompt_text: string,
 *         active_on: string   // "YYYY-MM-DD"
 *       }
 *     } | null,
 *     error: PostgrestError | AuthError | null
 *   }>
 *
 * USAGE:
 *   const { record, error } = await getUserPromptForDate();
 *   if (record) {
 *     console.log("Today's prompt text:", record.prompt.prompt_text);
 *   }
 */
export async function getUserPromptForDate({ dateString } = {}) {
  const targetDate = dateString ?? getTodayDateString();

  // First, get the current user id
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { record: null, error: userError };
  }
  const user = userData?.user;
  if (!user) {
    return { record: null, error: new Error("No authenticated user") };
  }

  // Query user_daily_prompts joined with prompts
  const { data, error } = await supabase
    .from("user_daily_prompts")
    .select(
      `
      id,
      date,
      source,
      prompt:prompt_id (
        id,
        prompt_text,
        active_on
      )
    `
    )
    .eq("user_id", user.id)
    .eq("date", targetDate)
    .maybeSingle(); // returns null if no row instead of throwing

  return { record: data ?? null, error };
}

/**
 * Set (or change) the current user's prompt for a given date.
 *
 * This handles both:
 *   - first time choosing a prompt for the day
 *   - changing the prompt for the same day
 *
 * It uses an UPSERT on user_daily_prompts with the unique constraint:
 *   (user_id, date)
 *
 * INPUT:
 *   params: {
 *     promptId: number,           // id of the prompt from `prompts` table
 *     dateString?: string,        // "YYYY-MM-DD". Defaults to today if omitted.
 *     source?: "spin" | "manual_select" | string // optional, defaults to "spin"
 *   }
 *
 * RETURN:
 *   Promise<{
 *     record: {
 *       id: number,
 *       user_id: string,
 *       prompt_id: number,
 *       date: string,
 *       source: string | null,
 *       created_at: string,
 *       updated_at: string
 *     } | null,
 *     error: PostgrestError | AuthError | null
 *   }>
 *
 * USAGE EXAMPLE:
 *   const { record, error } = await setUserPromptForDate({
 *     promptId: 42,
 *     source: "spin", // or "manual_select"
 *   });
 */
export async function setUserPromptForDate({
  promptId,
  dateString,
  source = "spin",
}) {
  const targetDate = dateString ?? getTodayDateString();

  // Get current user id
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { record: null, error: userError };
  }
  const user = userData?.user;
  if (!user) {
    return { record: null, error: new Error("No authenticated user") };
  }

  const payload = {
    user_id: user.id,
    prompt_id: promptId,
    date: targetDate,
    source,
  };

  // Use UPSERT so we don't create duplicates when user changes their choice
  const { data, error } = await supabase
    .from("user_daily_prompts")
    .upsert(payload, {
      onConflict: "user_id,date", // must match your DB unique constraint
      ignoreDuplicates: false,
    })
    .select("*")
    .single();

  return { record: data ?? null, error };
}

/* --------------------------------------------------------------------------
 * SECTION 3: POSTS (PHOTO + CAPTION + PROMPT)
 *
 * Tables involved:
 *   - public.posts
 *       id: int8
 *       user_id: uuid (FK -> profiles.id)
 *       prompt_id: int8 (FK -> prompts.id)
 *       image_url: text (path inside "post-images" bucket)
 *       caption: text
 *       created_at: timestamptz
 *       updated_at: timestamptz
 *       is_active: boolean
 *
 * Storage:
 *   - Bucket: "post-images"
 *   - We store the OBJECT PATH (e.g. "user-id/2025-03-15T12-34-56Z.jpg")
 *     in posts.image_url, not the full public URL.
 *
 *   - The full public URL can be built via:
 *       supabase.storage.from('post-images').getPublicUrl(path)
 * ------------------------------------------------------------------------ */

/**
 * Upload a single post image to the "post-images" bucket.
 *
 * This helper is for WEB (React) usage where `file` is a File or Blob
 * from an <input type="file"> element.
 *
 * INPUT:
 *   params: {
 *     file: File | Blob,     // image chosen by the user
 *     userId?: string | null // optional; if omitted we get it from auth
 *   }
 *
 * BEHAVIOR:
 *   - If userId is not provided, it calls supabase.auth.getUser().
 *   - Constructs a storage path like: `${userId}/${timestamp}_${file.name}`
 *   - Uploads the file to bucket "post-images" under that path.
 *
 * RETURN:
 *   Promise<{ path: string | null, error: StorageError | AuthError | null }>
 *
 *   - `path` is the storage object path (e.g. "user-uuid/2025-03-15_abc.jpg")
 *   - Frontend should store this path in posts.image_url.
 *
 * USAGE EXAMPLE:
 *   const { path, error } = await uploadPostImage({ file });
 *   if (!error) {
 *     // now call createPost({ promptId, imagePath: path, caption })
 *   }
 */
export async function uploadPostImage({ file, userId = null }) {
  // 1. Determine user id (for organizing images by user folder)
  let effectiveUserId = userId;
  if (!effectiveUserId) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return { path: null, error: userError };
    }
    if (!userData?.user) {
      return { path: null, error: new Error("No authenticated user") };
    }
    effectiveUserId = userData.user.id;
  }

  // 2. Build a unique-ish filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const originalName = (file && file.name) ? file.name : "image";
  const fileExt = originalName.includes(".")
    ? originalName.substring(originalName.lastIndexOf("."))
    : "";
  const objectPath = `${effectiveUserId}/${timestamp}${fileExt}`;

  // 3. Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from("post-images")
    .upload(objectPath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    return { path: null, error };
  }

  // data.path is the storage object path relative to the bucket
  return { path: data?.path ?? objectPath, error: null };
}

/**
 * Create a new post row in `public.posts`.
 *
 * This helper assumes:
 *   - The image has already been uploaded with `uploadPostImage`.
 *   - You have a valid `promptId` and `imagePath`.
 *
 * INPUT:
 *   params: {
 *     promptId: number,     // id from `prompts` table
 *     imagePath: string,    // path returned by uploadPostImage (e.g. "user-uuid/...")
 *     caption?: string | null
 *   }
 *
 * BEHAVIOR:
 *   - Gets the current auth user id.
 *   - Inserts into `posts`:
 *       { user_id, prompt_id, image_url, caption }
 *
 * RETURN:
 *   Promise<{ post: PostRow | null, error: PostgrestError | AuthError | null }>
 *
 *   PostRow fields:
 *     - id, user_id, prompt_id, image_url, caption,
 *       created_at, updated_at, is_active
 *
 * USAGE:
 *   const uploadResult = await uploadPostImage({ file });
 *   if (!uploadResult.error) {
 *     const { post, error } = await createPost({
 *       promptId: chosenPrompt.id,
 *       imagePath: uploadResult.path,
 *       caption: "My caption here"
 *     });
 *   }
 */
export async function createPost({ promptId, imagePath, caption = null }) {
  // 1. Get current user id
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { post: null, error: userError };
  }
  const user = userData?.user;
  if (!user) {
    return { post: null, error: new Error("No authenticated user") };
  }

  // 2. Build insert payload
  const payload = {
    user_id: user.id,
    prompt_id: promptId,
    image_url: imagePath,
    caption,
  };

  // 3. Insert into posts
  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("id, user_id, prompt_id, image_url, caption, created_at, updated_at, is_active")
    .single();

  return { post: data ?? null, error };
}

/**
 * Fetch the global feed of posts.
 *
 * This returns posts from all users where `is_active = true`,
 * ordered by newest first. It also joins:
 *   - prompt: prompt_text
 *   - user: display_name, avatar_url
 *
 * INPUT:
 *   params (optional): {
 *     limit?: number,         // max number of posts to fetch (default 50)
 *     offset?: number         // for pagination; number of posts to skip (default 0)
 *   }
 *
 * RETURN:
 *   Promise<{ posts: Array<FeedPost>, error: PostgrestError | null }>
 *
 *   Each FeedPost has:
 *     - id: number
 *     - image_url: string      // path in storage
 *     - caption: string | null
 *     - created_at: string
 *     - prompt: {
 *         id: number,
 *         prompt_text: string,
 *         active_on: string    // "YYYY-MM-DD"
 *       }
 *     - user: {
 *         id: string,          // uuid
 *         display_name: string | null,
 *         avatar_url: string | null
 *       }
 *
 * NOTE:
 *   - Frontend can convert image_url to a full URL using:
 *       supabase.storage.from("post-images").getPublicUrl(image_url)
 *
 * USAGE:
 *   const { posts, error } = await getGlobalFeed({ limit: 20 });
 */
export async function getGlobalFeed({ limit = 50, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      image_url,
      caption,
      created_at,
      prompt:prompt_id (
        id,
        prompt_text,
        active_on
      ),
      user:user_id (
        id,
        display_name,
        avatar_url
      )
    `
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return { posts: data ?? [], error };
}

/* --------------------------------------------------------------------------
 * SECTION 4: REACTIONS & COMMENTS
 *
 * Tables involved:
 *   - public.reactions
 *       id: int8
 *       post_id: int8 (FK -> posts.id)
 *       user_id: uuid (FK -> profiles.id)
 *       type: text (e.g., 'like')
 *       created_at: timestamptz
 *
 *   - public.comments
 *       id: int8
 *       post_id: int8 (FK -> posts.id)
 *       user_id: uuid (FK -> profiles.id)
 *       body: text
 *       created_at: timestamptz
 *       updated_at: timestamptz
 *
 * Behavior:
 *   - Users can like/unlike posts (1 like per user per post).
 *   - Users can add comments to posts and read comments.
 * ------------------------------------------------------------------------ */

/**
 * Like a post for the current user.
 *
 * This uses an UPSERT on (post_id, user_id), so:
 *   - If the user hasn't liked the post yet -> inserts a new reaction row.
 *   - If they already liked it -> updates existing row (no duplicate).
 *
 * INPUT:
 *   params: {
 *     postId: number,        // id from `posts` table
 *     type?: string          // reaction type, default 'like'
 *   }
 *
 * RETURN:
 *   Promise<{ reaction: ReactionRow | null, error: PostgrestError | AuthError | null }>
 *
 * ReactionRow fields:
 *   - id, post_id, user_id, type, created_at
 *
 * USAGE:
 *   const { reaction, error } = await likePost({ postId: post.id });
 */
export async function likePost({ postId, type = "like" }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { reaction: null, error: userError };
  }
  const user = userData?.user;
  if (!user) {
    return { reaction: null, error: new Error("No authenticated user") };
  }

  const payload = {
    post_id: postId,
    user_id: user.id,
    type,
  };

  const { data, error } = await supabase
    .from("reactions")
    .upsert(payload, {
      onConflict: "post_id,user_id", // must match DB unique constraint
      ignoreDuplicates: false,
    })
    .select("id, post_id, user_id, type, created_at")
    .single();

  return { reaction: data ?? null, error };
}

/**
 * Unlike a post for the current user.
 *
 * This deletes the reaction row with (post_id, user_id) for the current user.
 *
 * INPUT:
 *   params: {
 *     postId: number
 *   }
 *
 * RETURN:
 *   Promise<{ success: boolean, error: PostgrestError | AuthError | null }>
 *
 * USAGE:
 *   const { success, error } = await unlikePost({ postId: post.id });
 */
export async function unlikePost({ postId }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { success: false, error: userError };
  }
  const user = userData?.user;
  if (!user) {
    return { success: false, error: new Error("No authenticated user") };
  }

  const { error } = await supabase
    .from("reactions")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);

  return { success: !error, error };
}

/**
 * Check if the current user has liked a given post.
 *
 * INPUT:
 *   params: {
 *     postId: number
 *   }
 *
 * RETURN:
 *   Promise<{
 *     hasLiked: boolean,
 *     reaction: ReactionRow | null,
 *     error: PostgrestError | AuthError | null
 *   }>
 *
 * USAGE:
 *   const { hasLiked, error } = await hasUserLikedPost({ postId: post.id });
 */
export async function hasUserLikedPost({ postId }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { hasLiked: false, reaction: null, error: userError };
  }
  const user = userData?.user;
  if (!user) {
    return { hasLiked: false, reaction: null, error: new Error("No authenticated user") };
  }

  const { data, error } = await supabase
    .from("reactions")
    .select("id, post_id, user_id, type, created_at")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { hasLiked: false, reaction: null, error };
  }

  if (!data) {
    return { hasLiked: false, reaction: null, error: null };
  }

  return { hasLiked: true, reaction: data, error: null };
}

/**
 * Get the like count and (optionally) basic info about users who liked a post.
 *
 * INPUT:
 *   params: {
 *     postId: number,
 *     withUsers?: boolean   // if true, returns user display names & avatars too
 *   }
 *
 * RETURN:
 *   Promise<{
 *     count: number,
 *     reactions: Array<{
 *       id: number,
 *       created_at: string,
 *       user?: { id: string, display_name: string | null, avatar_url: string | null }
 *     }>,
 *     error: PostgrestError | null
 *   }>
 *
 * USAGE:
 *   const { count, reactions, error } = await getPostLikes({ postId: post.id, withUsers: true });
 */
export async function getPostLikes({ postId, withUsers = false }) {
  let query = supabase
    .from("reactions")
    .select(
      withUsers
        ? `
          id,
          created_at,
          user:user_id (
            id,
            display_name,
            avatar_url
          )
        `
        : `
          id,
          created_at
        `
    )
    .eq("post_id", postId);

  const { data, error } = await query;

  if (error) {
    return { count: 0, reactions: [], error };
  }

  return { count: data.length, reactions: data, error: null };
}

/**
 * Add a comment to a post for the current user.
 *
 * INPUT:
 *   params: {
 *     postId: number,
 *     body: string        // the comment text
 *   }
 *
 * RETURN:
 *   Promise<{ comment: CommentRow | null, error: PostgrestError | AuthError | null }>
 *
 * CommentRow fields:
 *   - id, post_id, user_id, body, created_at, updated_at
 *
 * USAGE:
 *   const { comment, error } = await addComment({
 *     postId: post.id,
 *     body: "Nice post!"
 *   });
 */
export async function addComment({ postId, body }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { comment: null, error: userError };
  }
  const user = userData?.user;
  if (!user) {
    return { comment: null, error: new Error("No authenticated user") };
  }

  const payload = {
    post_id: postId,
    user_id: user.id,
    body,
  };

  const { data, error } = await supabase
    .from("comments")
    .insert(payload)
    .select("id, post_id, user_id, body, created_at, updated_at")
    .single();

  return { comment: data ?? null, error };
}

/**
 * Get comments for a specific post.
 *
 * INPUT:
 *   params: {
 *     postId: number,
 *     limit?: number,        // max comments to fetch (default 50)
 *     offset?: number        // number of comments to skip (default 0)
 *   }
 *
 * RETURN:
 *   Promise<{
 *     comments: Array<{
 *       id: number,
 *       body: string,
 *       created_at: string,
 *       user: {
 *         id: string,
 *         display_name: string | null,
 *         avatar_url: string | null
 *       }
 *     }>,
 *     error: PostgrestError | null
 *   }>
 *
 * USAGE:
 *   const { comments, error } = await getCommentsForPost({ postId: post.id });
 */
export async function getCommentsForPost({ postId, limit = 50, offset = 0 }) {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `
      id,
      body,
      created_at,
      user:user_id (
        id,
        display_name,
        avatar_url
      )
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return { comments: data ?? [], error };
}

/**
 * Delete a comment owned by the current user.
 *
 * INPUT:
 *   params: {
 *     commentId: number
 *   }
 *
 * RETURN:
 *   Promise<{ success: boolean, error: PostgrestError | AuthError | null }>
 *
 * NOTE:
 *   - RLS on `comments` ensures users can only delete their own comments.
 *
 * USAGE:
 *   const { success, error } = await deleteComment({ commentId: comment.id });
 */
export async function deleteComment({ commentId }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { success: false, error: userError };
  }
  const user = userData?.user;
  if (!user) {
    return { success: false, error: new Error("No authenticated user") };
  }

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  return { success: !error, error };
}

// ===============================
//  AVATARS / PROFILE PICTURES
// ===============================

/**
 * Uploads a new avatar image for the current user to the `avatars` bucket.
 * - Uses path: `${user.id}/${timestamp}.${ext}`
 * - Updates `profiles.avatar_url` with that path.
 *
 * @param {File} file - The image file selected from an <input type="file" />
 * @returns {Promise<{ path: string | null, profile: object | null, error: any }>}
 */
export async function uploadAvatarImage({ file }) {
  if (!file) {
    return { path: null, profile: null, error: new Error("No file provided") };
  }

  const { user, error: authError } = await getCurrentUser();
  if (authError || !user) {
    return {
      path: null,
      profile: null,
      error: authError || new Error("No authenticated user"),
    };
  }

  const userId = user.id;
  const ext = (file.name && file.name.split(".").pop()) || "jpg";
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${timestamp}.${safeExt}`;
  const filePath = `${userId}/${fileName}`;

  const { data, error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      upsert: true,
    });

  if (uploadError) {
    return { path: null, profile: null, error: uploadError };
  }

  const { profile, error: profileError } = await updateCurrentUserProfile({
    avatarUrl: filePath,
  });

  return {
    path: filePath,
    profile: profile || null,
    error: profileError || null,
  };
}

/**
 * Returns a public URL for an avatar `path` stored in the `avatars` bucket.
 *
 * @param {string | null} path - The `avatar_url` stored in `profiles`.
 * @returns {string | null} - A public URL usable in an <img src={...} /> tag.
 */
export function getAvatarPublicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || null;
}

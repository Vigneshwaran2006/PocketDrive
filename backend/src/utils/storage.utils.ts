import supabase from "../config/supabase";

const BUCKET = "pocketdrive-files";

export const uploadToStorage = async (
  path: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> => {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return path;
};

export const deleteFromStorage = async (path: string): Promise<void> => {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
};

export const getSignedUrl = async (
  path: string,
  expiresIn: number = 3600
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data) {
    throw new Error(`Failed to get signed URL: ${error?.message}`);
  }

  return data.signedUrl;
};

export const updateStorageUsed = async (
  userId: string,
  sizeChange: number
): Promise<void> => {
  // Get current storage used
  const { data: user } = await supabase
    .from("users")
    .select("storage_used")
    .eq("id", userId)
    .single();

  if (!user) return;

  const newStorageUsed = Math.max(0, (user.storage_used || 0) + sizeChange);

  await supabase
    .from("users")
    .update({
      storage_used: newStorageUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
};
import supabase from "../config/supabase";

interface LogActivityParams {
  user_id: string;
  action: string;
  item_type?: "file" | "folder";
  item_id?: string;
  item_name?: string;
  metadata?: Record<string, any>;
}

export const logActivity = async (params: LogActivityParams): Promise<void> => {
  try {
    await supabase.from("activity_logs").insert({
      user_id: params.user_id,
      action: params.action,
      item_type: params.item_type ?? null,
      item_id: params.item_id ?? null,
      item_name: params.item_name ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (error) {
    console.error("Activity log error:", error);
  }
};
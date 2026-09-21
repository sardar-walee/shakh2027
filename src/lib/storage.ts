import { storageBucket } from "./platform";
import { supabase } from "./supabase";

export type UploadProgress = (percent: number) => void;

function safeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

export async function uploadImage(
  file: File,
  userId: string,
  onProgress: UploadProgress,
): Promise<{ path: string; publicUrl: string }> {
  const client = supabase;
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!client || !baseUrl || !anonKey) throw new Error("storage_not_configured");

  const path = `${userId}/drafts/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const session = (await client.auth.getSession()).data.session;
  if (!session) throw new Error("authentication_required");

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${baseUrl}/storage/v1/object/${storageBucket}/${path}`);
    request.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    request.setRequestHeader("apikey", anonKey);
    request.setRequestHeader("Content-Type", file.type);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("upload_failed"));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("upload_failed"));
    };
    request.send(file);
  });

  const { data } = client.storage.from(storageBucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

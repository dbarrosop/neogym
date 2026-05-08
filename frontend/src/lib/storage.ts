import { nhost } from "./nhost/client";

export async function fetchFileBlob(fileId: string): Promise<Blob> {
  const res = await nhost.storage.getFile(fileId);
  return res.body;
}

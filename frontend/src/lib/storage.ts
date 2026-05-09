import { nhost } from "./nhost/client";

export function fileUrl(fileId: string): string {
  return `${nhost.storage.baseURL}/files/${fileId}`;
}

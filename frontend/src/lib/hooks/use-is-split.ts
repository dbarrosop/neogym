import { useEffect, useState } from "react";

/** Width from which list + detail layouts show both panes side by side. */
export const SPLIT_MEDIA_QUERY = "(min-width: 1100px)";

/** True when the viewport is wide enough for the list + detail split view. */
export function useIsSplit(): boolean {
  const [split, setSplit] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(SPLIT_MEDIA_QUERY);
    setSplit(media.matches);
    const onChange = () => setSplit(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return split;
}

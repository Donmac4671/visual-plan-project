import { useEffect } from "react";

export function useCanonical(path: string) {
  useEffect(() => {
    const url = `https://donmacdatahub.com${path}`;
    let link = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", url);
    return () => {
      link?.remove();
    };
  }, [path]);
}

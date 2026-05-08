import { THEME_STORAGE_KEY } from "./theme-provider";

export const themeInitScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var d=document.documentElement;if(t==="dark"){d.classList.add("dark");}d.style.colorScheme=t;}catch(e){}})();`;

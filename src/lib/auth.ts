const KEY = "vm-store-auth";

export const auth = {
  isAuthed: () => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(KEY) === "1";
  },
  login: () => localStorage.setItem(KEY, "1"),
  logout: () => localStorage.removeItem(KEY),
};

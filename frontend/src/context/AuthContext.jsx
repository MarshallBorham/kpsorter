import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem("token") || null);
  const [username, setUsername] = useState(() => sessionStorage.getItem("username") || null);

  function login(newToken, newUsername) {
    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("username", newUsername);
    setToken(newToken);
    setUsername(newUsername);
  }

  function logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    setToken(null);
    setUsername(null);
  }

  function authFetch(url, options = {}) {
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return (
    <AuthContext.Provider value={{ token, username, login, logout, authFetch, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
export interface User {
  id: string; // uuid; es el claim `sub` del access token
  email: string; // normalizado (trim + minúsculas)
  passwordHash: string; // Argon2id (cadena PHC)
  createdAt: Date;
  updatedAt: Date;
}

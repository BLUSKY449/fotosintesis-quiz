import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GANTI '/REPO_NAME/' fotosintesis-quiz
export default defineConfig({
  base: "/fotosintesis-quiz/",
  plugins: [react()],
});

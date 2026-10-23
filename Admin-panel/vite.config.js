import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://15.135.215.62:5000",
      "/socket.io": {
        target: "http://15.135.215.62:5000",
        ws: true,
      },
    },
  },
});

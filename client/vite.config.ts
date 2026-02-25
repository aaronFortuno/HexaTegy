import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./", // "/HexaTegy/", // si no funciona amb "./"
  server: {
    host: true, // només per proves en xarxa local!
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: './client',
  build: {
    outDir: '../dist',
    rollupOptions: {
      external: [
        '@mediapipe/face_mesh',
        '@mediapipe/pose', 
        '@mediapipe/hands'
      ]
    }
  }
})

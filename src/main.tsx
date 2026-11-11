import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <App />
      </LazyMotion>
    </MotionConfig>
  </ThemeProvider>
);

import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster richColors position="top-right" theme="system" />
      </BrowserRouter>
    </AuthProvider>
  );
}

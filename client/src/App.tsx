import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { NotificationCenter } from "./components/shared/NotificationCenter";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <NotificationCenter />
      </BrowserRouter>
    </AuthProvider>
  );
}

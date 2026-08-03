import CompleteProfilePage from "./CompleteProfilePage";
import StaffProfileSetupPage from "./StaffProfileSetupPage";
import { useAuth } from "../../context/AuthContext";

export default function ProfileSetupPage() {
  const { user } = useAuth();
  return user?.role === "ROLE_EMPLOYEE" || user?.role === "ROLE_BRANCH_MANAGER" || user?.role === "ROLE_PROGRAMMING_OPERATOR"
    ? <StaffProfileSetupPage />
    : <CompleteProfilePage />;
}

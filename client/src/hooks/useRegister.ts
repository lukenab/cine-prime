import { useState, useEffect } from "react";
import { authApi } from "../api/authApi";

export function useRegister() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) {
      setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
    }
    // Clear confirmPassword error when either password field changes
    if (e.target.name === "password" || e.target.name === "confirmPassword") {
      setErrors((prev) => ({ ...prev, confirmPassword: "" }));
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.username.trim()) errs.username = "Username is required";
    else if (form.username.trim().length < 5) errs.username = "At least 5 characters";
    else if (!/^[a-zA-Z0-9_]+$/.test(form.username.trim())) errs.username = "Only letters, digits and underscores";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = "Invalid email format";
    if (!form.password) errs.password = "Password is required";
    else if (form.password.length < 8) errs.password = "At least 8 characters";
    if (!form.confirmPassword) errs.confirmPassword = "Please confirm your password";
    else if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords do not match";
setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await authApi.initiateRegister({
        username: form.username,
        email: form.email,
        password: form.password,
      });
      setCountdown(60);
      setStep(2);
    } catch (error: any) {
      const backendMessage = error.response?.data?.message || "Registration failed.";
      const low = backendMessage.toLowerCase();
      if (low.includes("username")) setErrors((prev) => ({ ...prev, username: backendMessage }));
      else if (low.includes("email")) setErrors((prev) => ({ ...prev, email: backendMessage }));
      else setGeneralError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!otp || otp.length < 6) {
      setGeneralError("Please enter a valid 6-digit OTP.");
      return;
    }
    setLoading(true);
    try {
      await authApi.verifyRegister({ email: form.email, otp });
      setStep(3);
    } catch (error: any) {
      setGeneralError(error.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResendMessage(null);
    setResendLoading(true);
    try {
      await authApi.resendOtp({ email: form.email });
      setResendMessage("New OTP sent to your email.");
      setCountdown(60);
    } catch (error: any) {
      setResendMessage(error.response?.data?.message || "Unable to resend OTP right now.");
    } finally {
      setResendLoading(false);
    }
  };

  return {
    step, setStep,
    otp, setOtp,
    loading,
    resendLoading, resendMessage,
    countdown,
    errors,
    generalError,
    form,
    handleChange,
    handleInitiate,
    handleVerifyOtp,
    handleResendOtp,
  };
}

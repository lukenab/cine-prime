import { useState } from "react";
import { authApi } from "../api/authApi"; 

export function useRegister() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    phone: "",
    dob: "",
    gender: "",
    identityCard: "",
    address: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) {
      setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
    }
  };

  const validateClientForm = () => {
    const clientErrors: Record<string, string> = {};
    if (!form.fullName.trim()) clientErrors.fullName = "Full name must not be blank";
    if (!form.username.trim()) clientErrors.username = "Username must not be blank";
    if (!form.email.trim()) clientErrors.email = "Email address must not be blank";
    if (!form.password.trim()) clientErrors.password = "Password must not be blank";
    if (!form.phone.trim()) clientErrors.phone = "Phone number must not be blank";
    if (!form.dob) clientErrors.dob = "Date of birth must not be null";
    if (!form.gender) clientErrors.gender = "Gender must not be blank";
    if (!form.identityCard.trim()) clientErrors.identityCard = "Identity card must not be blank";
    if (!form.address.trim()) clientErrors.address = "Address must not be blank";

    setErrors(clientErrors);
    return Object.keys(clientErrors).length === 0;
  };

  const getPayload = () => ({
    username: form.username,
    password: form.password,
    email: form.email,
    fullName: form.fullName,
    phoneNumber: form.phone,
    dateOfBirth: form.dob,
    gender: form.gender,
    address: form.address,
    identityCard: form.identityCard,
  });

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    if (!validateClientForm()) return;
    setLoading(true);

    try {
      const res: any = await authApi.initiateRegister(getPayload());
      const responseData = res?.data || res;
      if (responseData && responseData.code && responseData.code !== 1000) {
        throw { response: { data: responseData } };
      }
      setStep(2);
    } catch (error: any) {
      console.error("Initiate failed:", error);
      const backendMessage = error.response?.data?.message || error.message || "Registration failed.";
      const lowMessage = backendMessage.toLowerCase();

      if (lowMessage.includes("username") || lowMessage.includes("tồn tại")) {
        setErrors((prev) => ({ ...prev, username: backendMessage }));
      } else if (lowMessage.includes("email")) {
        setErrors((prev) => ({ ...prev, email: backendMessage }));
      } else if (lowMessage.includes("identity card") || lowMessage.includes("cccd")) {
        setErrors((prev) => ({ ...prev, identityCard: backendMessage }));
      } else if (lowMessage.includes("phone") || lowMessage.includes("điện thoại")) {
        setErrors((prev) => ({ ...prev, phone: backendMessage }));
      } else {
        setGeneralError(backendMessage);
      }
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
      const res: any = await authApi.verifyRegister({
        otp: otp,
        registerRequest: getPayload(),
      });
      const responseData = res?.data || res;
      if (responseData && responseData.code && responseData.code !== 1000) {
        throw { response: { data: responseData } };
      }
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
      const res: any = await authApi.resendOtp({ email: form.email });
      const responseData = res?.data || res;
      if (responseData && responseData.code && responseData.code !== 1000) {
        throw { response: { data: responseData } };
      }
      setResendMessage(responseData?.message || "New OTP has been sent to your email.");
    } catch (error: any) {
      setResendMessage(error.response?.data?.message || "Unable to resend OTP right now.");
    } finally {
      setResendLoading(false);
    }
  };

  return {
    step,
    setStep,
    otp,
    setOtp,
    loading,
    resendLoading,
    resendMessage,
    errors,
    generalError,
    form,
    handleChange,
    handleInitiate,
    handleVerifyOtp,
    handleResendOtp,
  };
}
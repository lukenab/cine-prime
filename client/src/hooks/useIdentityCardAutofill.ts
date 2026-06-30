import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { ParsedIdentityCard, parseIdentityCard } from "../utils/identityCard.ts";

type RegisterForm = {
  identityCard: string;
  gender: string;
  dobYear: string;
};

// Frontend parsing is only for UX hints/autofill. Backend validation remains the source of truth.
export function useIdentityCardAutofill<TForm extends RegisterForm>(
  identityCardValue: string,
  setForm: Dispatch<SetStateAction<TForm>>
) {
  const [identityCardHint, setIdentityCardHint] = useState<string | null>(null);
  const [parsedIdentityCard, setParsedIdentityCard] = useState<ParsedIdentityCard | null>(null);

  useEffect(() => {
    const identityCard = identityCardValue.replace(/\D/g, "");
    if (identityCard.length !== 12) {
      setIdentityCardHint(null);
      setParsedIdentityCard(null);
      return;
    }

    const parsed = parseIdentityCard(identityCard);
    if (!parsed) {
      setParsedIdentityCard(null);
      setIdentityCardHint("Unable to read this citizen ID. Please check the 12 digits.");
      return;
    }

    setParsedIdentityCard(parsed);
    setForm((prev) => ({
      ...prev,
      identityCard,
      gender: prev.gender || parsed.gender,
      dobYear: prev.dobYear || String(parsed.birthYear),
    }));
    setIdentityCardHint(null);
  }, [identityCardValue, setForm]);

  return {
    identityCardHint,
    parsedIdentityCard,
  };
}

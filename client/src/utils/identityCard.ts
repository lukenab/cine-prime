import provinceCodes from "../data/province-codes.json";

export type ParsedIdentityCard = {
  provinceCode: string;
  provinceName: string;
  gender: "Male" | "Female";
  birthYear: number;
};

const provinceCodeMap = provinceCodes as Record<string, string>;

export function parseIdentityCard(identityCard: string): ParsedIdentityCard | null {
  if (!/^[0-9]{12}$/.test(identityCard)) {
    return null;
  }

  const provinceCode = identityCard.slice(0, 3);
  const provinceName = provinceCodeMap[provinceCode];
  if (!provinceName) {
    return null;
  }

  const centuryGenderCode = Number(identityCard[3]);
  const yearInCentury = Number(identityCard.slice(4, 6));
  const centuryStart = resolveCenturyStart(centuryGenderCode);
  if (centuryStart === null) {
    return null;
  }

  return {
    provinceCode,
    provinceName,
    gender: centuryGenderCode % 2 === 0 ? "Male" : "Female",
    birthYear: centuryStart + yearInCentury,
  };
}

function resolveCenturyStart(centuryGenderCode: number): number | null {
  if (centuryGenderCode <= 1) return 1900;
  if (centuryGenderCode <= 3) return 2000;
  if (centuryGenderCode <= 5) return 2100;
  if (centuryGenderCode <= 7) return 2200;
  if (centuryGenderCode <= 9) return 2300;
  return null;
}

export type MockOffer = {
  offerId: number;
  title: string;
  description: string;
  discount: string;
  validUntil: string;
  code: string;
  accentColor: string;
};

export const mockOffers: MockOffer[] = [
  {
    offerId: 1,
    title: "Weekday Combo",
    description: "Save on two standard tickets and one shared popcorn combo from Monday to Thursday.",
    discount: "20% OFF",
    validUntil: "2026-08-31",
    code: "WEEKDAY20",
    accentColor: "#38bdf8",
  },
  {
    offerId: 2,
    title: "Student Night",
    description: "Show a valid student ID at the counter and get a reduced evening ticket price.",
    discount: "15% OFF",
    validUntil: "2026-09-15",
    code: "STUDENT15",
    accentColor: "#60a5fa",
  },
  {
    offerId: 3,
    title: "Family Pack",
    description: "Four tickets, two drinks, and a large popcorn bundle for weekend morning shows.",
    discount: "SAVE 25%",
    validUntil: "2026-08-20",
    code: "FAMILY25",
    accentColor: "#2563eb",
  },
];

export type MockEvent = {
  eventId: number;
  title: string;
  subtitle: string;
  description: string;
  date: string;
  time: string;
  cluster: string;
  tag: string;
  accentColor: string;
  image: string;
};

export const mockEvents: MockEvent[] = [
  {
    eventId: 1,
    title: "Premiere Night",
    subtitle: "First screening with cast greeting",
    description: "A premium opening-night experience with reserved seating and a limited collector ticket.",
    date: "2026-07-12",
    time: "19:30",
    cluster: "CinePrime District 1",
    tag: "Premiere",
    accentColor: "#38bdf8",
    image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=900&h=600&fit=crop",
  },
  {
    eventId: 2,
    title: "Weekend Marathon",
    subtitle: "Three fan favorites back to back",
    description: "Bring your crew for a curated marathon package with combo discounts between screenings.",
    date: "2026-07-18",
    time: "13:00",
    cluster: "CinePrime Hoan Kiem",
    tag: "Marathon",
    accentColor: "#60a5fa",
    image: "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=900&h=600&fit=crop",
  },
  {
    eventId: 3,
    title: "Family Morning",
    subtitle: "Early showtime for all ages",
    description: "A softer-volume screening with kid-friendly snacks and flexible seating support.",
    date: "2026-07-20",
    time: "09:30",
    cluster: "CinePrime Thu Duc",
    tag: "Family",
    accentColor: "#34d399",
    image: "https://images.unsplash.com/photo-1517602302552-471fe67acf66?w=900&h=600&fit=crop",
  },
];

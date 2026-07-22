export type MockTestimonial = {
  id: number;
  name: string;
  role: string;
  quote: string;
  rating: number;
  avatar: string;
};

export const mockTestimonials: MockTestimonial[] = [
  {
    id: 1,
    name: "Minh Anh",
    role: "Regular Member",
    quote: "The Dolby Atmos screens at CinePrime are unmatched — booking online takes seconds and the seats are always comfortable.",
    rating: 5,
    avatar: "https://i.pravatar.cc/100?img=5",
  },
  {
    id: 2,
    name: "David Tran",
    role: "Family Pass Holder",
    quote: "We take the kids every weekend for the family morning shows. Clean rooms, friendly staff, and the combo deals save us a lot.",
    rating: 5,
    avatar: "https://i.pravatar.cc/100?img=12",
  },
  {
    id: 3,
    name: "Linh Pham",
    role: "Student",
    quote: "Student night pricing is a lifesaver. Great picture quality for the price, and the app makes picking seats really easy.",
    rating: 4,
    avatar: "https://i.pravatar.cc/100?img=32",
  },
  {
    id: 4,
    name: "Hoang Nguyen",
    role: "Film Enthusiast",
    quote: "Premiere nights here feel like a real event — reserved seating and the collector tickets are a nice touch.",
    rating: 5,
    avatar: "https://i.pravatar.cc/100?img=51",
  },
  {
    id: 5,
    name: "Thu Ha",
    role: "First-time Visitor",
    quote: "Booking was simple and the cinema was spotless. Will definitely be coming back for the IMAX screens.",
    rating: 4,
    avatar: "https://i.pravatar.cc/100?img=45",
  },
  {
    id: 6,
    name: "Quang Vu",
    role: "Weekend Regular",
    quote: "Best popcorn in town, honestly. The weekend marathon events are a great way to catch up with friends.",
    rating: 5,
    avatar: "https://i.pravatar.cc/100?img=60",
  },
];

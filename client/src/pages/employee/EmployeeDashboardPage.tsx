import { ClipboardList, Popcorn, ShoppingCart, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const operations = [
  {
    title: "Sell tickets",
    description: "Create counter bookings and confirm ticket sales.",
    path: "/employee/sell",
    icon: ShoppingCart,
  },
  {
    title: "Booking lookup",
    description: "Find bookings and assist customers at the cinema.",
    path: "/employee/bookings",
    icon: ClipboardList,
  },
  {
    title: "Concession fulfillment",
    description: "Prepare paid food and beverage orders for pickup.",
    path: "/employee/concessions/fulfillment",
    icon: Popcorn,
  },
];

export default function EmployeeDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: "#3b82f6", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>
          Employee workspace
        </div>
        <h1 style={{ color: "var(--text-main)", fontSize: 28, lineHeight: 1.2, fontWeight: 700, margin: 0 }}>
          Welcome, {user?.username ?? "team member"}
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: 14, margin: "8px 0 0" }}>
          Choose an operational task to start your shift.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {operations.map(({ title, description, path, icon: Icon }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            style={{
              minHeight: 180,
              padding: 22,
              borderRadius: 16,
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              color: "var(--text-main)",
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              transition: "border-color 0.2s ease, transform 0.2s ease",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = "rgba(59,130,246,0.55)";
              event.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = "var(--border-color)";
              event.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <span style={{ width: 42, height: 42, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>
              <Icon size={20} />
            </span>
            <span style={{ fontSize: 17, fontWeight: 700, marginTop: 18 }}>{title}</span>
            <span style={{ color: "var(--text-sub)", fontSize: 13, lineHeight: 1.55, marginTop: 6 }}>{description}</span>
            <span style={{ color: "#3b82f6", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginTop: "auto", paddingTop: 16 }}>
              Open <ArrowRight size={14} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../layouts/Sidebar";
import { Header } from "../layouts/Header";
import StaffOnboardingGate from "../components/staff/StaffOnboardingGate";
import { useAuth } from "../context/AuthContext";

export default function AdminLayout() {
  const { user, needsProfileSetup } = useAuth();
  // 1. Logic tự động nhận diện trang hiện tại để bôi sáng Menu
  const location = useLocation();
  const activeNav = location.pathname.split("/")[2] || "dashboard";

  // 2. Logic Theme Dark/Light
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("admin-theme");
    return savedTheme ? savedTheme === "dark" : true;
  });

  const isIncompleteStaff = needsProfileSetup && [
    "ROLE_EMPLOYEE",
    "ROLE_BRANCH_MANAGER",
    "ROLE_PROGRAMMING_OPERATOR",
  ].includes(user?.role ?? "");

  useEffect(() => {
    localStorage.setItem("admin-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    const background = isDarkMode ? "#050505" : "#f4f5f7";
    const root = document.getElementById("root");
    const previous = {
      htmlBackground: document.documentElement.style.backgroundColor,
      bodyBackground: document.body.style.backgroundColor,
      rootBackground: root?.style.backgroundColor ?? "",
    };

    document.documentElement.style.backgroundColor = background;
    document.body.style.backgroundColor = background;
    if (root) root.style.backgroundColor = background;

    return () => {
      document.documentElement.style.backgroundColor = previous.htmlBackground;
      document.body.style.backgroundColor = previous.bodyBackground;
      if (root) root.style.backgroundColor = previous.rootBackground;
    };
  }, [isDarkMode]);

  return (
    <div
      className={isDarkMode ? "theme-dark" : "theme-light"}
      style={{
        minHeight: "100vh",
        background: "var(--bg-main)", 
        display: "flex",
        fontFamily: "Inter, sans-serif",
        transition: "background 0.25s ease",
      }}
    >
      {/* Sidebar cố định bên trái */}
      <Sidebar isDarkMode={isDarkMode} />

      {/* Vùng chứa nội dung chính */}
      <div
        style={{
          marginLeft: "240px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          minWidth: 0,
        }}
      >
        <Header activePage={activeNav} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />

        <main
          style={{
            flex: 1,
            padding: "28px 32px 40px",
            overflowX: "hidden",
            minWidth: 0,
          }}
        >
          {/* 🌟 ĐÂY LÀ ĐIỂM ĂN TIỀN: Nội dung các trang sẽ được nhét vào đây */}
          {/* Truyền isDarkMode xuống cho các trang con qua context */}
          {isIncompleteStaff ? (
            <div aria-hidden="true" className="space-y-5 opacity-45 blur-[1px]">
              <div className="h-8 w-64 rounded-lg bg-[var(--bg-card)]" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]" />)}
              </div>
              <div className="h-72 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]" />
            </div>
          ) : <Outlet context={{ isDarkMode }} />}
        </main>
      </div>

      {isIncompleteStaff && <StaffOnboardingGate />}

      {/* Hệ biến màu tập trung */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .theme-dark {
          --bg-main: #050505;
          --bg-card: #141414;
          --border-color: rgba(255, 255, 255, 0.07);
          --text-main: #f0f0f0;
          --text-muted: #ccc;
          --text-sub: #555;
          --progress-track: rgba(255, 255, 255, 0.05);
          --modal-surface: #171a21;
          --modal-surface-highlight: #202633;
          --modal-option: #10141b;
          --modal-border: rgba(148, 163, 184, 0.20);
          --modal-text-sub: #9ca3af;
          --modal-backdrop: rgba(2, 6, 23, 0.60);
        }

        .theme-light {
          --bg-main: #f4f5f7;
          --bg-card: #ffffff;
          --border-color: rgba(0, 0, 0, 0.08);
          --text-main: #1a1a1a;
          --text-muted: #333333;
          --text-sub: #7a7a7a;
          --progress-track: rgba(0, 0, 0, 0.06);
          --modal-surface: #ffffff;
          --modal-surface-highlight: #f5f8ff;
          --modal-option: #f8fafc;
          --modal-border: rgba(15, 23, 42, 0.12);
          --modal-text-sub: #64748b;
          --modal-backdrop: rgba(15, 23, 42, 0.42);
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
          box-sizing: border-box;
        }
        *:hover, *:focus-within, *:active {
          scrollbar-color: rgba(59,130,246,0.35) transparent;
        }
        *::-webkit-scrollbar { width: 4px; height: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; transition: background 0.2s ease; }
        *:hover::-webkit-scrollbar-thumb,
        *:focus-within::-webkit-scrollbar-thumb,
        *:active::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.35); }
        *::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.6); }
        html, body, #root { min-height: 100%; }
        body { margin: 0; }
        input::placeholder { color: var(--text-sub); }
      `}</style>
    </div>
  );
}

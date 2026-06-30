import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../layouts/Sidebar";
import { Header } from "../layouts/Header";

export default function AdminLayout() {
  // 1. Logic tự động nhận diện trang hiện tại để bôi sáng Menu
  const location = useLocation();
  const activeNav = location.pathname.split("/")[2] || "dashboard";

  // 2. Logic Theme Dark/Light
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("admin-theme");
    return savedTheme ? savedTheme === "dark" : true;
  });

  useEffect(() => {
    localStorage.setItem("admin-theme", isDarkMode ? "dark" : "light");
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
        }}
      >
        <Header activePage={activeNav} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />

        <main
          style={{
            flex: 1,
            padding: "28px 32px 40px",
            overflowX: "hidden",
          }}
        >
          {/* 🌟 ĐÂY LÀ ĐIỂM ĂN TIỀN: Nội dung các trang sẽ được nhét vào đây */}
          {/* Truyền isDarkMode xuống cho các trang con qua context */}
          <Outlet context={{ isDarkMode }} />
        </main>
      </div>

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
        }

        .theme-light {
          --bg-main: #f4f5f7;
          --bg-card: #ffffff;
          --border-color: rgba(0, 0, 0, 0.08);
          --text-main: #1a1a1a;
          --text-muted: #333333;
          --text-sub: #7a7a7a;
          --progress-track: rgba(0, 0, 0, 0.06);
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,215,0,0.15) transparent;
          box-sizing: border-box;
        }
        *::-webkit-scrollbar { width: 4px; height: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(255,215,0,0.15); border-radius: 2px; }
        *::-webkit-scrollbar-thumb:hover { background: rgba(255,215,0,0.3); }
        body { margin: 0; background: var(--bg-main); }
        input::placeholder { color: var(--text-sub); }
      `}</style>
    </div>
  );
}
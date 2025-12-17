import React from "react";

const Header = ({ onToggleSidebar, isMobile }) => {
  const username = JSON.parse(sessionStorage.getItem("Username")) || "User";

  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

  return (
    <header className="custom-header d-flex align-items-center justify-content-between px-3">
      {/* LEFT: Mobile toggle button */}
      <div className="d-md-none">
        <button
          id="toggle-sidebar"
          className="btn toggle-btn border-0"
          onClick={onToggleSidebar}
        >
          <i className="bi bi-list fs-3 mobiletoggle-icon"></i>
        </button>
      </div>

      {/* CENTER: Title */}
      <div className="flex-grow-1 text-center d-flex justify-content-center">
        <div
          className="d-flex align-items-center gap-2 flex-wrap"
          style={{ maxWidth: "80%" }}
        >
          <img
            src="/images/agri.jpg"
            alt="AGRI Logo"
            className="header-logo-img"
            style={{ height: "30px", width: "30px", objectFit: "cover" }}
          />

          <span
            className="header-title mb-0 text-truncate"
            style={{ fontSize: "14px", minWidth: "0" }}
          >
            AGRICULTURAL ENGINEERING COLLEGE & RESEARCH INSTITUTE - KUMULUR -
            620005
          </span>
        </div>
      </div>

      {/* RIGHT: Profile */}
      <div className="profile-icon d-flex justify-content-center flex-column align-items-center ms-2">
        <img
          src="../images/headerprofileimgsrm.png"
          alt="Profile"
          className="rounded-circle"
          style={{ width: "30px", height: "30px", objectFit: "cover" }}
          title={displayName}
        />
        <div
          style={{ fontSize: "15px", minWidth: "80px", textAlign: "center" }}
          className="text-black"
        >
          {displayName}
        </div>
      </div>
    </header>
  );
};

export default Header;

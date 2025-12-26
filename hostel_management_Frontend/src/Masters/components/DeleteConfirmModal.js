import React, { useEffect } from "react";

const DeleteConfirmModal = ({ setMasterChanges, masterChanges, onDelete }) => {
  const isDeleting = masterChanges.delete.loading;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isDeleting && e.key === "Escape") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting]);

  const handleClose = () => {
    if (!isDeleting) {
      setMasterChanges((pre) => ({
        ...pre,
        delete: {
          show: false,
          ids: [],
          loading: false,
        },
      }));
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        className="modal-content"
        style={{
          background: "white",
          padding: "34px 15px 25px 15px",
          borderRadius: "8px",
          maxWidth: "400px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          position: "relative",
        }}
      >
        {/* Cancel (X) Button */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "-7px",
            right: "4px",
            background: "transparent",
            border: "none",
            fontSize: "30px",
            cursor: isDeleting ? "not-allowed" : "pointer",
            opacity: isDeleting ? 0.5 : 1,
          }}
          aria-label="Close modal"
          disabled={isDeleting}
        >
          &times;
        </button>

        <h5 style={{ marginBottom: "16px" }}>
          Are you sure you want to delete?
        </h5>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              backgroundColor: "#ccc",
              border: "none",
              fontSize: "14px",
              marginRight: "10px",
              cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.5 : 1,
            }}
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </button>

          <button
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              backgroundColor: "red",
              color: "white",
              border: "none",
              fontSize: "14px",
              cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: 1,
            }}
            onClick={onDelete}
            disabled={isDeleting}
            cursor={isDeleting ? "not-allowed" : "pointer"}
            opacity={isDeleting ? 0.5 : 1}
          >
            <span>Delete</span>
            {isDeleting && (
              <span
                className="spinner-border spinner-border-sm ms-2"
                role="status"
                aria-hidden="true"
              ></span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;

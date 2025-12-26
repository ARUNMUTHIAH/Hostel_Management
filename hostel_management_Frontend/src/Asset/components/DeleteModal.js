import React from "react";

const DeleteModal = ({ assetManager, setAssetManager, handleDelete }) => {
  const isDeleting = assetManager.isDeleting;

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
          padding: "24px",
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
          onClick={() => {
            if (!isDeleting) {
              setAssetManager((prev) => ({
                ...prev,
                deleteModal: { show: false, id: null },
              }));
            }
          }}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
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

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "10px",
          }}
        >
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
            onClick={() => {
              if (!isDeleting) {
                setAssetManager((prev) => ({
                  ...prev,
                  deleteModal: { show: false, id: null },
                }));
              }
            }}
            disabled={isDeleting}
          >
            Cancel
          </button>

          <button
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              backgroundColor: isDeleting ? "#888" : "red",
              color: "white",
              border: "none",
              fontSize: "14px",
              cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.7 : 1,
            }}
            onClick={() => handleDelete(assetManager.deleteModal.id)}
            disabled={isDeleting}
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

export default DeleteModal;

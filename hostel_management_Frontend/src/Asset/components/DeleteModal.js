import React from 'react'

const DeleteModal = ({assetManager, setAssetManager, handleDelete}) => {
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
                }}
            >
                {/* Cancel (X) Button */}
                <button
                    onClick={() =>
                        setAssetManager((prev) => ({ ...prev, deleteModal: { show: false, id: null } }))
                    }
                    style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        background: "transparent",
                        border: "none",
                        fontSize: "30px",
                        cursor: "pointer",
                    }}
                    aria-label="Close modal"
                >
                    &times;
                </button>
                <h5 style={{ marginBottom: "16px" }}>
                    Are you sure you want to delete?
                </h5>
                <div style={{ display: "flex", justifyContent: "right" }}>
                    <button
                        style={{
                            padding: "8px 16px",
                            borderRadius: "4px",
                            backgroundColor: "#ccc",
                            border: "none",
                            fontSize: "14px",
                            marginRight: "10px",
                        }}
                        onClick={() => setAssetManager((prev) => ({ ...prev, deleteModal: { show: false, id: null } }))}
                    >
                        Cancel
                    </button>
                    <button
                        style={{
                            padding: "8px 16px",
                            borderRadius: "4px",
                            backgroundColor: assetManager.isDeleting ? "#888" : "red",
                            color: "white",
                            border: "none",
                            fontSize: "14px",
                            cursor: assetManager.isDeleting ? "not-allowed" : "pointer",
                            opacity: assetManager.isDeleting ? 0.7 : 1,
                        }}
                        onClick={() => handleDelete(assetManager.deleteModal.id)}
                        disabled={assetManager.isDeleting}
                    >
                        <span>Delete</span>
                        {assetManager.isDeleting && (
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
    )
}

export default DeleteModal
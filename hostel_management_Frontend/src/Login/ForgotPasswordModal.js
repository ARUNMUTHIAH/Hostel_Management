import React from 'react'

const ForgotPasswordModal = () => {
    return (
        <div
            className="modal fade"
            id="infoModal"
            tabIndex="-1"
            aria-labelledby="infoModalLabel"
            aria-hidden="true"
        >
            <div
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: '300px' }}
            >
                <div
                    className="modal-content"
                    style={{
                        borderRadius: '8px',
                        textAlign: 'center',
                        padding: '15px',
                        position: 'relative',
                    }}
                >
                    <button
                        type="button"
                        className="btn-close"
                        data-bs-dismiss="modal"
                        aria-label="Close"
                        style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 5 }}
                    ></button>
                    <div className="modal-body">
                        <div
                            className="info-icon"
                            style={{
                                fontSize: '28px',
                                color: '#000',
                                marginBottom: '10px',
                            }}
                        >
                            <i className="bi bi-exclamation-circle"></i>
                        </div>
                        <img
                            src="images/adminlogoforgotpassword.png"
                            alt="Info Illustration"
                            style={{ width: '120px', marginBottom: '20px' }}
                        />
                        <p
                            style={{
                                fontSize: '14px',
                                fontWeight: 500,
                                color: '#333',
                            }}
                        >
                            Please reach out to admin for the assistance for the password
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ForgotPasswordModal
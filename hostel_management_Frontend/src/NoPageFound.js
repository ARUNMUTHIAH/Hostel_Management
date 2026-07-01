import React from 'react'
import SidebarDashboard from './Sidebar/sidebar'

const NoPageFound = () => {
    return (
        <div className="d-flex" style={{ minHeight: '100vh' }}>
            <SidebarDashboard />
            <div className="main-content flex-grow-1 d-flex align-items-center justify-content-center hms-page">
                <img
                    src="/images/noPageFound.png"
                    alt="No Page Logo"
                    className="header-logo-img "
                    style={{width: "65%", height: "85%"}}
                />
            </div>
        </div>
    )
}

export default NoPageFound
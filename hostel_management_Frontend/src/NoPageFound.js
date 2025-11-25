import React from 'react'
import Header from './Header/header'
import SidebarDashboard from './Sidebar/sidebar'


const NoPageFound = () => {
    return (
        <div className="d-flex " style={{ height: '100vh' }}>
            <Header />
            <SidebarDashboard />
            <div className="main-content flex-grow-1 d-flex align-items-center justify-content-center" style={{ marginTop: "56px" }}>
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
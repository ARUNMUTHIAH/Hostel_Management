import React from "react";

const StatCards = ({ dashboardData }) => {
  const totalStudents = dashboardData?.totalRegisteredStudent ?? 0;
  const todayInOut =
    (dashboardData?.inStudent ?? 0) + (dashboardData?.outStudent ?? 0);
  const studentsOutside = dashboardData?.studentStillOutside ?? 0;
  const overdueStudents = dashboardData?.OverdueStudentsOutside ?? 0;

  return (
    <div className="row g-3">
      {/* Card 1 */}
      <div className="col-12 col-md-6">
        <div className="carddashboardsrm-custom card-purpledashboardsrm d-flex align-items-center gap-4 p-3">
          <div className="icondashboardcards-circle">
            <i className="bi bi-file-earmark-text"></i>
          </div>
          <div>
            <div className="icondashboardcard-number">{totalStudents}</div>
            <div className="icondashboardcard-label">
              Total Registered Students
            </div>
          </div>
        </div>
      </div>

      {/* Card 2 */}
      <div className="col-12 col-md-6">
        <div className="carddashboardsrm-custom card-bluedashboardsrm d-flex align-items-center gap-4 p-3">
          <div className="icondashboardcards-circle">
            <i className="bi bi-arrow-left-right"></i>
          </div>
          <div>
            <div className="icondashboardcard-number">{todayInOut}</div>
            <div className="icondashboardcard-label">Today IN / OUT</div>
          </div>
        </div>
      </div>

      {/* Card 3 */}
      <div className="col-12 col-md-6">
        <div className="carddashboardsrm-custom card-orangedashboardsrm d-flex align-items-center gap-4 p-3">
          <div className="icondashboardcards-circle">
            <i className="bi bi-person-walking"></i>
          </div>
          <div>
            <div className="icondashboardcard-number">{studentsOutside}</div>
            <div className="icondashboardcard-label">
              Students Still Outside
            </div>
          </div>
        </div>
      </div>

      {/* Card 4 */}
      <div className="col-12 col-md-6">
        <div className="carddashboardsrm-custom card-reddashboardsrm d-flex align-items-center gap-4 p-3">
          <div className="icondashboardcards-circle">
            <i className="bi bi-exclamation-circle"></i>
          </div>
          <div>
            <div className="icondashboardcard-number">{overdueStudents}</div>
            <div className="icondashboardcard-label">
              Overdue Students Outside
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatCards;

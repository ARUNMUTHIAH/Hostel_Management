import React from "react";

const StatCards = ({ dashboardData }) => {
  const totalStudents = dashboardData?.totalRegisteredStudent ?? 0;
  const studentsOutside = dashboardData?.studentStillOutside ?? 0;
  const overdueStudents = dashboardData?.OverdueStudentsOutside ?? 0;

  const cards = [
    {
      cls: "card-indigo",
      icon: "bi-people-fill",
      value: totalStudents,
      label: "Registered Students",
    },
    {
      cls: "card-blue",
      icon: "bi-arrow-left-right",
      value: `${dashboardData?.outStudent ?? 0} / ${dashboardData?.inStudent ?? 0}`,
      label: "OUT / IN (Today)",
    },
    {
      cls: "card-amber",
      icon: "bi-person-walking",
      value: studentsOutside,
      label: "Still Outside (Today)",
    },
    {
      cls: "card-rose",
      icon: "bi-exclamation-triangle-fill",
      value: overdueStudents,
      label: "Overdue Outside (Today)",
    },
  ];

  return (
    <>
      {cards.map((card) => (
        <div key={card.label} className="col-6 col-lg-3">
          <div className={`carddashboardsrm-custom ${card.cls}`}>
            <div className="icondashboardcards-circle">
              <i className={`bi ${card.icon}`}></i>
            </div>
            <div className="stat-card-body">
              <div className="icondashboardcard-number">{card.value}</div>
              <div className="icondashboardcard-label">{card.label}</div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export default StatCards;

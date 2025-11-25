import React from 'react';

const FilterSection = ({ reportConfig, fetchCategoryList, setTrackingState, trackingState }) => {
  const formData = trackingState.formData || {};
  const dropdownList = trackingState.dropdownList || {};

  const handleInputChange = (bkname, value) => {
    setTrackingState(prev => ({
      ...prev,
      formData: { ...prev.formData, [bkname]: value },
      showTable: false,
      tableData: null,
    }));
  };

  const handleDropdownChange = (field, value) => {
    const { bkname, isCategoryRoot } = field;
    handleInputChange(bkname, value);

    if (isCategoryRoot) {
      fetchCategoryList(value);
      setTrackingState(prev => ({
        ...prev,
        dropdownList: { ...prev.dropdownList, categories: [] },
      }));
    }
  };

  const renderInput = (field) => {
    const { dpname, bkname, type } = field;
    const value = formData[bkname] || "";

    return (
      <input
        onChange={(e) => handleInputChange(bkname, e.target.value)}
        type={type}
        min={type === "date" && bkname === "toDate" && formData.fromDate ? formData.fromDate : undefined}
        max={type === "date" ? new Date().toISOString().split("T")[0] : undefined}
        value={value}
        className="form-control"
        placeholder={`Enter ${dpname}`}
      />
    );
  };

  const renderDropdown = (field) => {
    const { dpname, bkname, backendAccessKey } = field;
    const value = formData[bkname] || "";

    return (
      <select
        className="form-select bg-white"
        value={value}
        onChange={(e) => handleDropdownChange(field, e.target.value)}
      >
        <option value="">Select {dpname}</option>
        {dropdownList[bkname]?.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt[backendAccessKey] ?? opt.name}
          </option>
        ))}
      </select>
    );
  };

  const renderTextarea = (field) => {
    const { dpname, bkname } = field;
    const value = formData[bkname] || "";

    return (
      <textarea
        className="form-control"
        rows={3}
        placeholder={`Enter ${dpname}`}
        value={value}
        onChange={(e) => handleInputChange(bkname, e.target.value)}
      />
    );
  };

  // Renderer map for field types
  const renderers = {
    dropdown: renderDropdown,
    textarea: renderTextarea,
    text: renderInput,
    date: renderInput,
    number: renderInput,
    email: renderInput,
  };

  const renderField = (field) => {
    const { dpname, bkname, type } = field;
    const Renderer = renderers[type] || renderInput;

    return (
      <div className="col-md-3" key={bkname}>
        <label className="input-label inputlabellastassettracking">{dpname}</label>
        {Renderer(field)}
      </div>
    );
  };

  const renderSubCategorySection = () => {
    return dropdownList?.categories?.map((list, index) => {
      const hasAllValues = list.option?.every(opt => opt.value);
      return (
        <React.Fragment key={`cat-${index}`}>
          {hasAllValues ? (
            list.option.map((opt, i) => (
              <div className="col-md-4" key={opt.id || i}>
                <label className="input-label inputlabellastassettracking">
                  Sub Category {i + 1}
                </label>
                <input
                  className="form-control mb-2"
                  type="text"
                  value={opt.value}
                  readOnly
                />
              </div>
            ))
          ) : (
            <div className="col-md-4" key={`dropdown-${index}`}>
              <label className="input-label inputlabellastassettracking">
                Category {index + 1}
              </label>
              <select
                className="form-select bg-white"
                onChange={(e) => {
                  const selectedId = e.target.value;
                  fetchCategoryList(selectedId);

                  setTrackingState((prev) => {
                    const newCategories = [...prev.dropdownList.categories];
                    newCategories.splice(index + 1); // remove items after selected index

                    newCategories[index] = {
                      ...newCategories[index],
                      option: newCategories[index].option.map((item) => ({
                        ...item,
                        active: item.id == selectedId,
                      })),
                    };

                    return {
                      ...prev,
                      dropdownList: { ...prev.dropdownList, categories: newCategories },
                      showTable: false,
                    };
                  });
                }}
              >
                <option value="">Select Category</option>
                {list.option?.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name || opt.value}
                  </option>
                ))}
              </select>
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <>
      {reportConfig?.fields.map(renderField)}
      {dropdownList.categories?.length > 0 && renderSubCategorySection()}
    </>
  );
};

export default FilterSection;

export const validateStudentInput = async (bodydata) => {
  if (!bodydata.memberid || bodydata.memberid.trim() === "") {
    return { error: true, message: "Member ID is required", statusCode: 400 };
  }

  if (!bodydata.name) {
    return { error: true, message: "Name is required", statusCode: 400 };
  }

  if (!bodydata.department) {
    return { error: true, message: "Department is required", statusCode: 400 };
  }

  if (!bodydata.degree) {
    return { error: true, message: "Degree is required", statusCode: 400 };
  }

  if (!bodydata.gender) {
    return { error: true, message: "Gender is required", statusCode: 400 };
  }

  if (!Array.isArray(bodydata.locations)) {
    return {
      error: true,
      message: "Locations array is required",
      statusCode: 400,
    };
  }

  if (bodydata.locations.length < 1) {
    return { error: true, message: "Room is required", statusCode: 400 };
  }

  return { error: false };
};

export function validateImage(file) {
  if (!file || !file.size) return;
  if (!file.type.startsWith("image/")) {
    const error = new Error("Sirf image files upload karo.");
    error.code = "storage/invalid-format";
    throw error;
  }
  if (file.size > 5 * 1024 * 1024) {
    const error = new Error("Image 5MB se chhoti honi chahiye.");
    error.code = "storage/invalid-size";
    throw error;
  }
}

export function getUploadErrorMessage(error) {
  const messages = {
    "storage/unauthorized": "Firebase Storage rules image upload allow nahi kar rahe.",
    "storage/canceled": "Image upload cancel ho gaya.",
    "storage/retry-limit-exceeded": "Image upload network timeout hua.",
    "storage/invalid-format": "Sirf image files upload karo.",
    "storage/invalid-size": "Image 5MB se chhoti honi chahiye.",
  };
  return messages[error.code] || error.message || "Image upload fail hua.";
}

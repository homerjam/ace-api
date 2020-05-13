class ErrorCode {
  constructor(code, message) {
    const error = Error(message);
    error.code = code;
    return error;
  }
}

module.exports = ErrorCode;

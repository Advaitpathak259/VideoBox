// Use environment variable for API URL, fallback to local dev backend
const server = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default server;

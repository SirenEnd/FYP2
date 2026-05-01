import axios from 'axios'

const api = axios.create({
  baseURL: 'https://restrohrms-backend.onrender.com/api',  // Live backend
  // baseURL: 'http://localhost:5000/api',  // Local development
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    console.log('Token being sent:', token ? 'Yes (exists)' : 'No') // Debug
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('API Error Status:', error.response?.status)
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ??
      error.message ??
      'Something went wrong. Please try again.'
    return Promise.reject({
      message,
      status: error.response?.status,
      data: error.response?.data,
    })
  }
)

export async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const response = await promise
  return response.data
}

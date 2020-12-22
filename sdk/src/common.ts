import Axios from "axios";

Axios.interceptors.response.use(
  data => data,
  error => {
    throw error;
  }
);

Axios.interceptors.request.use(config => {
  config.baseURL =
    process.env.QORE_SERVER ||
    "https://p-qore-dot-pti-feedloop.et.r.appspot.com";
  return config;
});

export async function callApi<T>(
  params: {
    method: "get" | "post" | "put" | "delete" | "patch";
    url: string;
    data?: { [key: string]: any };
    params?: { [key: string]: any };
  },
  token?: string
) {
  const headers: { [key: string]: any } = {};
  if (token) {
    headers["Authorization"] = token;
  }
  return (await Axios({ ...params, headers, url: params.url })).data as T;
}

export class UnauthorizedError extends Error {}
